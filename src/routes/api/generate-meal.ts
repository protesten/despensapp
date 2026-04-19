import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5";

interface AvailableProductPayload {
  product_id: string;
  name: string;
  brand?: string | null;
  available_grams: number;
  kcal_per_100g: number | null;
  carbs_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
}

interface GenerateMealRequest {
  meal_name: string;
  target: { hc: number; prot: number; fat: number };
  products: AvailableProductPayload[];
  /** Productos a evitar (usados el día anterior en la misma comida). */
  avoid_product_names?: string[];
  /** Si se está regenerando, nombres usados ahora mismo en esa comida a evitar. */
  exclude_product_names?: string[];
  model?: string;
}

interface GeneratedMealItem {
  product_name: string;
  grams: number;
}

interface GeneratedMeal {
  recipe_name: string;
  items: GeneratedMealItem[];
}

export const Route = createFileRoute("/api/generate-meal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as GenerateMealRequest;

          if (!body.meal_name || !body.target || !Array.isArray(body.products)) {
            return Response.json(
              { error: "Payload inválido" },
              { status: 400 },
            );
          }
          if (body.products.length === 0) {
            return Response.json(
              { error: "No hay productos disponibles en el stock" },
              { status: 400 },
            );
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return Response.json(
              { error: "LOVABLE_API_KEY no configurado" },
              { status: 500 },
            );
          }

          const productLines = body.products
            .map((p) => {
              const brand = p.brand ? ` (${p.brand})` : "";
              return `- "${p.name}"${brand} | kcal/100g: ${p.kcal_per_100g ?? 0}, HC: ${p.carbs_per_100g ?? 0}g, Prot: ${p.protein_per_100g ?? 0}g, Grasa: ${p.fat_per_100g ?? 0}g | disponible: ${Math.round(p.available_grams)}g`;
            })
            .join("\n");

          const exactNamesList = body.products
            .map((p) => `"${p.name}"`)
            .join(", ");

          const avoidLine =
            body.avoid_product_names && body.avoid_product_names.length > 0
              ? `\nNo repitas estos productos usados el día anterior en esta misma comida: ${body.avoid_product_names.map((n) => `"${n}"`).join(", ")}.`
              : "";
          const excludeLine =
            body.exclude_product_names && body.exclude_product_names.length > 0
              ? `\nQueremos una alternativa diferente. NO uses estos productos que ya están en la comida actual: ${body.exclude_product_names.map((n) => `"${n}"`).join(", ")}.`
              : "";

          const systemPrompt =
            "Eres un nutricionista experto en el sistema de intercambios. Devuelves SIEMPRE únicamente JSON válido siguiendo el esquema indicado, sin texto adicional.";

          const userPrompt = `Tengo estos productos disponibles en mi despensa:
${productLines}

Para la comida "${body.meal_name}" necesito cumplir este objetivo:
${body.target.hc} intercambios de Hidratos + ${body.target.prot} intercambios de Proteína + ${body.target.fat} intercambios de Grasa. Tolerancia ±0.3 por macro.

Selecciona 2-4 alimentos que formen una comida culinariamente coherente y realista para "${body.meal_name}".${avoidLine}${excludeLine}

Reglas:
- Los nombres deben coincidir EXACTAMENTE con los de la lista (mismas mayúsculas/acentos).
- No uses productos que no estén en la lista.
- La combinación debe tener sentido como plato real.
- No excedas la cantidad disponible de cada producto.
- "grams" debe ser un número entero positivo.

Devuelve la respuesta llamando a la herramienta "propose_meal".`;

          const aiResponse = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: body.model || DEFAULT_MODEL,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "propose_meal",
                    description:
                      "Propone una receta culinaria coherente con los ingredientes disponibles.",
                    parameters: {
                      type: "object",
                      properties: {
                        recipe_name: {
                          type: "string",
                          description: "Nombre descriptivo del plato.",
                        },
                        items: {
                          type: "array",
                          minItems: 1,
                          maxItems: 6,
                          items: {
                            type: "object",
                            properties: {
                              product_name: { type: "string" },
                              grams: { type: "number" },
                            },
                            required: ["product_name", "grams"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["recipe_name", "items"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "propose_meal" },
              },
            }),
          });

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              return Response.json(
                {
                  error:
                    "Has alcanzado el límite de peticiones a la IA. Inténtalo en unos segundos.",
                },
                { status: 429 },
              );
            }
            if (aiResponse.status === 402) {
              return Response.json(
                {
                  error:
                    "Sin créditos de IA. Añade saldo en Settings → Workspace → Usage.",
                },
                { status: 402 },
              );
            }
            const txt = await aiResponse.text();
            console.error("AI gateway error", aiResponse.status, txt);
            return Response.json(
              { error: "Error del servicio de IA" },
              { status: 500 },
            );
          }

          const aiJson = (await aiResponse.json()) as {
            choices?: Array<{
              message?: {
                tool_calls?: Array<{
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };

          const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
          const argsStr = toolCall?.function?.arguments;
          if (!argsStr) {
            console.error("AI response missing tool call", aiJson);
            return Response.json(
              { error: "La IA no devolvió una propuesta válida" },
              { status: 502 },
            );
          }

          let parsed: GeneratedMeal;
          try {
            parsed = JSON.parse(argsStr) as GeneratedMeal;
          } catch (e) {
            console.error("AI tool call args parse error", e, argsStr);
            return Response.json(
              { error: "La IA devolvió JSON inválido" },
              { status: 502 },
            );
          }

          // Map de productos por nombre normalizado
          const norm = (s: string) => s.trim().toLowerCase();
          const byName = new Map<string, AvailableProductPayload>();
          for (const p of body.products) byName.set(norm(p.name), p);

          const validatedItems: Array<{
            product_id: string;
            product_name: string;
            grams: number;
          }> = [];
          for (const item of parsed.items ?? []) {
            const match = byName.get(norm(item.product_name));
            if (!match) continue; // descartar items que no encajen con el catálogo
            const grams = Math.max(1, Math.round(Number(item.grams) || 0));
            if (grams <= 0) continue;
            validatedItems.push({
              product_id: match.product_id,
              product_name: match.name,
              grams,
            });
          }

          if (validatedItems.length === 0) {
            return Response.json(
              {
                error:
                  "La IA propuso productos que no están en tu stock. Inténtalo de nuevo.",
              },
              { status: 502 },
            );
          }

          return Response.json({
            recipe_name: parsed.recipe_name || body.meal_name,
            items: validatedItems,
          });
        } catch (e) {
          console.error("generate-meal error", e);
          return Response.json(
            {
              error:
                e instanceof Error ? e.message : "Error desconocido",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

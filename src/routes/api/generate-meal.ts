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

async function fetchWithRetries(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  timeoutMs = 60000,
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      // Reintentar solo en errores transitorios del servidor
      if (res.status >= 500 && res.status <= 599 && attempt < maxRetries) {
        console.warn(
          `[generate-meal] intento ${attempt + 1} falló con ${res.status}, reintentando...`,
        );
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"));
      console.warn(
        `[generate-meal] intento ${attempt + 1} ${isAbort ? "timeout" : "error"}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (attempt >= maxRetries) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      attempt++;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Fallo tras reintentos");
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

          const userPrompt = `Tengo estos productos disponibles en mi despensa (nombres EXACTOS):
${productLines}

Lista de nombres exactos permitidos: ${exactNamesList}.
Usa los nombres de producto EXACTAMENTE como aparecen en esta lista, sin modificarlos (mismas mayúsculas, acentos, espacios y signos).

Para la comida "${body.meal_name}" necesito cumplir este objetivo:
${body.target.hc} intercambios de Hidratos + ${body.target.prot} intercambios de Proteína + ${body.target.fat} intercambios de Grasa. Tolerancia ±0.3 por macro.

Selecciona 2-4 alimentos que formen una comida culinariamente coherente y realista para "${body.meal_name}".${avoidLine}${excludeLine}

CÁLCULO OBLIGATORIO DE GRAMOS:
Para cada alimento seleccionado, calcula los gramos necesarios para que la suma total de intercambios de todos los ingredientes se aproxime LO MÁXIMO POSIBLE al objetivo indicado. No uses cantidades arbitrarias. Usa esta fórmula para calcular los gramos de cada ingrediente:

  gramos = (intercambios_deseados_de_ese_ingrediente × 10000) / kcal_por_100g

Reparte los intercambios entre los ingredientes según su perfil nutricional dominante:
- Asigna los intercambios de HC a los alimentos ricos en hidratos (pan, cereales, fruta, legumbres...).
- Asigna los intercambios de Proteína a los alimentos ricos en proteína (carne, pescado, huevo, lácteos...).
- Asigna los intercambios de Grasa a los alimentos ricos en grasa (aceite, frutos secos, aguacate...).

El objetivo es que la SUMA de todos los ingredientes llegue a:
- HC total: ${body.target.hc} intercambios
- Proteína total: ${body.target.prot} intercambios
- Grasa total: ${body.target.fat} intercambios

Con tolerancia máxima de ±0.3 por macro. Si no llegas al objetivo con 3 ingredientes, añade un cuarto.

Recuerda que los intercambios de un ingrediente se calculan así:
  hc_ingrediente   = (carbs_per_100g   × 4 × gramos) / 10000
  prot_ingrediente = (protein_per_100g × 4 × gramos) / 10000
  fat_ingrediente  = (fat_per_100g     × 9 × gramos) / 10000

Reglas:
- Los nombres deben coincidir EXACTAMENTE con los de la lista (mismas mayúsculas/acentos/espacios). No inventes ni traduzcas nombres.
- No uses productos que no estén en la lista.
- La combinación debe tener sentido como plato real.
- No excedas la cantidad disponible de cada producto.
- "grams" debe ser un número entero positivo.
- Antes de responder, SUMA mentalmente los intercambios de cada ingrediente y verifica que el total cuadra con el objetivo dentro de ±0.3 por macro. Si no cuadra, ajusta los gramos.

Devuelve la respuesta llamando a la herramienta "propose_meal".`;

          const aiResponse = await fetchWithRetries(GATEWAY_URL, {
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

          // Matching: exacto normalizado → parcial (includes en ambas direcciones)
          const norm = (s: string) =>
            s
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
          const byName = new Map<string, AvailableProductPayload>();
          for (const p of body.products) byName.set(norm(p.name), p);

          const findMatch = (
            proposedName: string,
          ): AvailableProductPayload | null => {
            const key = norm(proposedName);
            if (!key) return null;
            const exact = byName.get(key);
            if (exact) return exact;
            let best: AvailableProductPayload | null = null;
            let bestScore = 0;
            for (const p of body.products) {
              const n = norm(p.name);
              if (!n) continue;
              if (key.includes(n) || n.includes(key)) {
                const score = Math.min(n.length, key.length);
                if (score > bestScore) {
                  bestScore = score;
                  best = p;
                }
              }
            }
            return best;
          };

          const validatedItems: Array<{
            product_id: string;
            product_name: string;
            grams: number;
          }> = [];
          for (const item of parsed.items ?? []) {
            const match = findMatch(item.product_name);
            if (!match) {
              console.warn(
                `[generate-meal] producto ignorado (sin match en stock): "${item.product_name}"`,
              );
              continue;
            }
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

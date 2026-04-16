import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchInputSchema = z.object({
  query: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Remove diacritics (tildes, ñ→n, ü→u, etc.) */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normalise: lowercase, strip accents, collapse whitespace, trim */
function normalise(s: string): string {
  return stripAccents(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Spanish → English food dictionary (keys MUST be normalised – no accents, lowercase)
// ---------------------------------------------------------------------------

const ES_EN_DICT: Record<string, string> = {
  // ── Frutas ──
  naranja: "orange", naranjas: "orange",
  manzana: "apple", manzanas: "apple",
  platano: "banana", platanos: "banana", banana: "banana", banano: "banana",
  fresa: "strawberry", fresas: "strawberry", frutilla: "strawberry", frutillas: "strawberry",
  uva: "grape", uvas: "grape",
  pera: "pear", peras: "pear",
  melocoton: "peach", melocotones: "peach", durazno: "peach", duraznos: "peach",
  pina: "pineapple", anana: "pineapple", ananas: "pineapple",
  sandia: "watermelon", sandias: "watermelon",
  melon: "melon", melones: "melon",
  limon: "lemon", limones: "lemon",
  lima: "lime", limas: "lime",
  cereza: "cherry", cerezas: "cherry",
  ciruela: "plum", ciruelas: "plum",
  mango: "mango", mangos: "mango",
  papaya: "papaya", papayas: "papaya",
  kiwi: "kiwi", kiwis: "kiwi",
  higo: "fig", higos: "fig",
  granada: "pomegranate", granadas: "pomegranate",
  coco: "coconut",
  aguacate: "avocado", aguacates: "avocado", palta: "avocado", paltas: "avocado",
  mandarina: "tangerine", mandarinas: "tangerine",
  pomelo: "grapefruit", toronja: "grapefruit",
  frambuesa: "raspberry", frambuesas: "raspberry",
  mora: "blackberry", moras: "blackberry", zarzamora: "blackberry",
  arandano: "blueberry", arandanos: "blueberry",
  guayaba: "guava",
  maracuya: "passion fruit",
  "fruta de la pasion": "passion fruit",

  // ── Verduras y hortalizas ──
  tomate: "tomato", tomates: "tomato", jitomate: "tomato",
  papa: "potato", papas: "potato", patata: "potato", patatas: "potato",
  cebolla: "onion", cebollas: "onion",
  ajo: "garlic", ajos: "garlic",
  zanahoria: "carrot", zanahorias: "carrot",
  pimiento: "bell pepper", pimientos: "bell pepper",
  "pimiento rojo": "red bell pepper",
  "pimiento verde": "green bell pepper",
  "pimiento amarillo": "yellow bell pepper",
  chile: "chili pepper", chiles: "chili pepper", aji: "chili pepper",
  espinaca: "spinach", espinacas: "spinach",
  brocoli: "broccoli",
  coliflor: "cauliflower",
  lechuga: "lettuce",
  pepino: "cucumber", pepinos: "cucumber",
  calabaza: "squash", calabazas: "squash",
  calabacin: "zucchini", calabacines: "zucchini",
  berenjena: "eggplant", berenjenas: "eggplant",
  apio: "celery",
  champinon: "mushroom", champinones: "mushroom", seta: "mushroom", setas: "mushroom", hongo: "mushroom", hongos: "mushroom",
  "boniato": "sweet potato", batata: "sweet potato", camote: "sweet potato",
  rabano: "radish", rabanos: "radish",
  nabo: "turnip", nabos: "turnip",
  col: "cabbage", repollo: "cabbage",
  "col rizada": "kale", kale: "kale",
  alcachofa: "artichoke", alcachofas: "artichoke",
  esparrago: "asparagus", esparragos: "asparagus",
  "judia verde": "green bean", "judias verdes": "green bean",
  ejote: "green bean", ejotes: "green bean",
  habichuela: "green bean",
  puerro: "leek", puerros: "leek",
  rucula: "arugula",
  berro: "watercress",
  "acelga": "chard", acelgas: "chard",
  remolacha: "beet", betabel: "beet",
  "maiz dulce": "sweet corn", elote: "sweet corn", choclo: "sweet corn",

  // ── Legumbres ──
  lentejas: "lentils", lenteja: "lentils",
  garbanzos: "chickpeas", garbanzo: "chickpeas",
  frijoles: "beans", frijol: "beans",
  "frijoles negros": "black beans",
  "frijoles rojos": "red kidney beans",
  "frijoles pintos": "pinto beans",
  judias: "beans", "judias blancas": "white beans", "alubias": "white beans",
  habas: "fava beans", haba: "fava beans",
  guisantes: "peas", guisante: "peas", chicharos: "peas", arveja: "peas", arvejas: "peas",
  soja: "soybean", soya: "soybean",
  "poroto": "beans", porotos: "beans",

  // ── Cereales y granos ──
  arroz: "rice",
  "arroz integral": "brown rice",
  "arroz blanco": "white rice",
  "arroz basmati": "basmati rice",
  trigo: "wheat",
  avena: "oats", "copos de avena": "rolled oats",
  maiz: "corn",
  cebada: "barley",
  centeno: "rye",
  quinoa: "quinoa", quinua: "quinoa",
  mijo: "millet",
  "trigo sarraceno": "buckwheat", alforfon: "buckwheat",
  cuscus: "couscous",
  bulgur: "bulgur",

  // ── Carnes ──
  pollo: "chicken",
  "pechuga de pollo": "chicken breast",
  "muslo de pollo": "chicken thigh",
  "ala de pollo": "chicken wing",
  pavo: "turkey",
  cerdo: "pork",
  "lomo de cerdo": "pork loin",
  "costilla de cerdo": "pork rib",
  ternera: "beef", res: "beef", vacuno: "beef", vaca: "beef",
  "carne molida": "ground beef", "carne picada": "ground beef",
  "filete de ternera": "beef steak", bistec: "beef steak", bistek: "beef steak",
  cordero: "lamb",
  conejo: "rabbit",
  pato: "duck",
  jamon: "ham",
  "jamon serrano": "serrano ham",
  tocino: "bacon", beicon: "bacon", bacón: "bacon",
  salchicha: "sausage", salchichas: "sausage",
  chorizo: "chorizo",
  mortadela: "mortadella", "bologna": "bologna",

  // ── Pescados y mariscos ──
  salmon: "salmon",
  atun: "tuna",
  sardina: "sardine", sardinas: "sardine",
  merluza: "hake",
  bacalao: "cod",
  lubina: "sea bass",
  dorada: "sea bream",
  trucha: "trout",
  anchoa: "anchovy", anchoas: "anchovy", boqueron: "anchovy",
  caballa: "mackerel",
  "pez espada": "swordfish",
  camaron: "shrimp", camarones: "shrimp", gamba: "shrimp", gambas: "shrimp",
  langostino: "prawn", langostinos: "prawn",
  calamar: "squid", calamares: "squid",
  pulpo: "octopus",
  mejillon: "mussel", mejillones: "mussel",
  almeja: "clam", almejas: "clam",
  cangrejo: "crab",
  langosta: "lobster",
  tilapia: "tilapia",

  // ── Lácteos ──
  leche: "milk",
  "leche entera": "whole milk",
  "leche desnatada": "skim milk",
  "leche semidesnatada": "reduced fat milk",
  "leche de cabra": "goat milk",
  queso: "cheese",
  "queso fresco": "fresh cheese",
  "queso cheddar": "cheddar cheese",
  "queso mozzarella": "mozzarella cheese",
  "queso parmesano": "parmesan cheese",
  "queso crema": "cream cheese",
  yogur: "yogurt", yogurt: "yogurt",
  "yogur griego": "greek yogurt",
  nata: "cream", crema: "cream",
  "nata montada": "whipped cream",
  mantequilla: "butter",
  requeson: "cottage cheese",
  cuajada: "curd",
  kefir: "kefir",

  // ── Huevos ──
  huevo: "egg", huevos: "egg",
  "clara de huevo": "egg white",
  "yema de huevo": "egg yolk",

  // ── Frutos secos y semillas ──
  almendra: "almond", almendras: "almond",
  nuez: "walnut", nueces: "walnut",
  cacahuete: "peanut", cacahuetes: "peanut", mani: "peanut", cacahuate: "peanut",
  avellana: "hazelnut", avellanas: "hazelnut",
  pistacho: "pistachio", pistachos: "pistachio",
  anacardo: "cashew", anacardos: "cashew", "nuez de la india": "cashew",
  castana: "chestnut", castanas: "chestnut",
  "nuez de brasil": "brazil nut",
  pipa: "sunflower seed", pipas: "sunflower seed",
  "semilla de girasol": "sunflower seed",
  "semilla de calabaza": "pumpkin seed",
  "semilla de chia": "chia seed", chia: "chia seed",
  "semilla de lino": "flaxseed", linaza: "flaxseed",
  sesamo: "sesame seed", ajonjoli: "sesame seed",
  "semilla de amapola": "poppy seed",

  // ── Panadería y cereales procesados ──
  pan: "bread",
  "pan blanco": "white bread",
  "pan integral": "whole wheat bread",
  "pan de centeno": "rye bread",
  tortilla: "tortilla",
  "tortilla de maiz": "corn tortilla",
  "tortilla de trigo": "flour tortilla",
  pasta: "pasta",
  espagueti: "spaghetti", espaguetis: "spaghetti",
  macarrones: "macaroni",
  fideos: "noodles", "fideo": "noodles",
  harina: "flour",
  "harina de trigo": "wheat flour",
  "harina integral": "whole wheat flour",
  "harina de maiz": "corn flour", maicena: "cornstarch",
  galleta: "cookie", galletas: "cookies",
  "galleta salada": "cracker",

  // ── Aceites y grasas ──
  aceite: "oil",
  "aceite de oliva": "olive oil",
  "aceite de girasol": "sunflower oil",
  "aceite de coco": "coconut oil",
  "aceite de canola": "canola oil", "aceite de colza": "canola oil",
  margarina: "margarine",
  manteca: "lard",

  // ── Condimentos y especias ──
  sal: "salt",
  azucar: "sugar",
  "azucar moreno": "brown sugar",
  miel: "honey",
  vinagre: "vinegar",
  "salsa de soja": "soy sauce", "salsa de soya": "soy sauce",
  mostaza: "mustard",
  ketchup: "ketchup",
  mayonesa: "mayonnaise",
  oregano: "oregano",
  comino: "cumin",
  canela: "cinnamon",
  pimienta: "black pepper", "pimienta negra": "black pepper",
  pimenton: "paprika",
  curcuma: "turmeric",
  jengibre: "ginger",
  perejil: "parsley",
  albahaca: "basil",
  cilantro: "coriander",
  romero: "rosemary",
  tomillo: "thyme",
  laurel: "bay leaf",
  "nuez moscada": "nutmeg",
  clavo: "clove", clavos: "clove",
  azafran: "saffron",
  eneldo: "dill",
  menta: "mint", hierbabuena: "mint",

  // ── Bebidas ──
  cafe: "coffee",
  te: "tea",
  "te verde": "green tea",
  "te negro": "black tea",
  cacao: "cocoa",
  chocolate: "chocolate",
  "chocolate negro": "dark chocolate",
  "leche de almendra": "almond milk",
  "leche de soja": "soy milk", "leche de soya": "soy milk",
  "leche de avena": "oat milk",
  "leche de coco": "coconut milk",
  zumo: "juice", jugo: "juice",
  "zumo de naranja": "orange juice", "jugo de naranja": "orange juice",

  // ── Otros ──
  tofu: "tofu",
  tempeh: "tempeh",
  "crema de cacahuete": "peanut butter", "mantequilla de mani": "peanut butter",
  mermelada: "jam",
  gelatina: "gelatin",
  levadura: "yeast",
  "bicarbonato": "baking soda",
  "polvo de hornear": "baking powder",
};

// ---------------------------------------------------------------------------
// Search-strategy helpers
// ---------------------------------------------------------------------------

/**
 * Multi-step translation:
 * 1. Exact match on normalised full phrase
 * 2. Partial: try removing trailing "s" (simple plural)
 * 3. Word-by-word translation for multi-word queries
 */
function translateQuery(normalised: string): { translated: string; wasTranslated: boolean } {
  // 1. Exact match
  if (ES_EN_DICT[normalised]) {
    return { translated: ES_EN_DICT[normalised], wasTranslated: true };
  }

  // 2. Simple singular fallback (remove trailing "s" or "es")
  const singular = normalised.endsWith("es") && normalised.length > 3
    ? normalised.slice(0, -2)
    : normalised.endsWith("s") && normalised.length > 2
      ? normalised.slice(0, -1)
      : null;
  if (singular && ES_EN_DICT[singular]) {
    return { translated: ES_EN_DICT[singular], wasTranslated: true };
  }

  // 3. Word-by-word for multi-word queries
  const words = normalised.split(" ");
  if (words.length > 1) {
    const mapped = words.map((w) => {
      if (ES_EN_DICT[w]) return ES_EN_DICT[w];
      // try singular of each word
      const ws = w.endsWith("es") && w.length > 3 ? w.slice(0, -2) : w.endsWith("s") && w.length > 2 ? w.slice(0, -1) : null;
      if (ws && ES_EN_DICT[ws]) return ES_EN_DICT[ws];
      return w;
    });
    const anyChanged = mapped.some((m, i) => m !== words[i]);
    if (anyChanged) {
      return { translated: mapped.join(" "), wasTranslated: true };
    }
  }

  return { translated: normalised, wasTranslated: false };
}

// ---------------------------------------------------------------------------
// USDA types
// ---------------------------------------------------------------------------

export interface USDAFoodResult {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  foodNutrients: {
    nutrientName: string;
    nutrientNumber: string;
    value: number;
    unitName: string;
  }[];
}

export interface NutritionSuggestion {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  saturated_fat: number | null;
  fiber: number | null;
  sugars: number | null;
  salt: number | null;
}

function extractNutrient(nutrients: USDAFoodResult["foodNutrients"], nutrientNumber: string): number | null {
  const n = nutrients.find((x) => x.nutrientNumber === nutrientNumber);
  return n ? n.value : null;
}

function mapToSuggestion(food: USDAFoodResult): NutritionSuggestion {
  const n = food.foodNutrients;
  const sodiumMg = extractNutrient(n, "307");
  const salt = sodiumMg != null ? Math.round(sodiumMg * 2.5 / 1000 * 100) / 100 : null;

  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner,
    kcal: extractNutrient(n, "208"),
    protein: extractNutrient(n, "203"),
    carbs: extractNutrient(n, "205"),
    fat: extractNutrient(n, "204"),
    saturated_fat: extractNutrient(n, "606"),
    fiber: extractNutrient(n, "291"),
    sugars: extractNutrient(n, "269"),
    salt,
  };
}

// ---------------------------------------------------------------------------
// USDA fetch
// ---------------------------------------------------------------------------

async function fetchUSDA(query: string, apiKey: string): Promise<USDAFoodResult[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      dataType: ["Foundation", "SR Legacy"],
      pageSize: 8,
      sortBy: "dataType.keyword",
      sortOrder: "asc",
    }),
  });

  if (!res.ok) {
    console.error("USDA API error:", res.status, await res.text());
    throw new Error(`Error de la API USDA (${res.status})`);
  }

  const json = await res.json() as { foods: USDAFoodResult[] };
  return json.foods ?? [];
}

// ---------------------------------------------------------------------------
// Exported server function
// ---------------------------------------------------------------------------

export const searchUSDAFoods = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const raw = data.query.trim();
    const norm = normalise(raw);

    try {
      // Step 1: Try original query as-is
      let foods = await fetchUSDA(raw, apiKey);
      let searchedAs: string = raw;
      let usedTranslation = false;

      // Step 2: If empty and normalised differs, try normalised
      if (foods.length === 0 && norm !== raw.toLowerCase()) {
        foods = await fetchUSDA(norm, apiKey);
        if (foods.length > 0) {
          searchedAs = norm;
        }
      }

      // Step 3: Dictionary translation (on normalised form)
      if (foods.length === 0) {
        const { translated, wasTranslated } = translateQuery(norm);
        if (wasTranslated) {
          foods = await fetchUSDA(translated, apiKey);
          if (foods.length > 0) {
            usedTranslation = true;
            searchedAs = translated;
          }
        }
      }

      // Step 4: If multi-word and still empty, try longest matching sub-phrase
      if (foods.length === 0) {
        const words = norm.split(" ");
        if (words.length > 1) {
          for (let len = words.length - 1; len >= 1; len--) {
            for (let start = 0; start <= words.length - len; start++) {
              const sub = words.slice(start, start + len).join(" ");
              if (ES_EN_DICT[sub]) {
                foods = await fetchUSDA(ES_EN_DICT[sub], apiKey);
                if (foods.length > 0) {
                  usedTranslation = true;
                  searchedAs = ES_EN_DICT[sub];
                  break;
                }
              }
            }
            if (foods.length > 0) break;
          }
        }
      }

      const results = foods.map(mapToSuggestion);
      return {
        results,
        error: null,
        usedTranslation,
        translatedTerm: usedTranslation ? searchedAs : null,
        searchedAs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al buscar datos nutricionales";
      return { results: [] as NutritionSuggestion[], error: msg, usedTranslation: false, translatedTerm: null, searchedAs: raw };
    }
  });

import { Type } from "@google/genai";
import {
  client, TEXT_MODEL, TEXT_FALLBACK_MODEL, withModelFailover, isTransient, BUDGET,
  authorized, unauthorized, badRequest, serverError,
} from "../lib/shared.js";
import { rateLimited, LIMITS } from "../lib/rate-limit.js";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recipes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short dish name, 1-3 words" },
          summary: {
            type: Type.STRING,
            description: "One warm, appetizing sentence (~25-40 words) describing the finished dish",
          },
          calories: { type: Type.INTEGER, description: "Estimated calories per serving" },
          proteinGrams: { type: Type.INTEGER, description: "Estimated protein grams per serving" },
          ingredientNames: { type: Type.ARRAY, items: { type: Type.STRING } },
          minutes: { type: Type.INTEGER, description: "Estimated total cook time in minutes" },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Imperative step title, 2-4 words" },
                body: {
                  type: Type.STRING,
                  description: "2-3 confident, beginner-friendly sentences",
                },
              },
              required: ["title", "body"],
            },
          },
        },
        // `minutes` is required of the MODEL, but the app decodes it as an
        // optional and hides the time chip when absent — so an app talking to
        // an old proxy (no minutes) keeps working, and AI recipes finally
        // stop losing every "faster dinner" tie-break to the bundled book.
        required: ["title", "summary", "calories", "proteinGrams", "ingredientNames", "steps", "minutes"],
      },
    },
  },
  required: ["recipes"],
};

/** POST /api/recipes — { ingredients: [string], count?: number } → { recipes: [...] } */
export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return unauthorized();
  // After the secret, before anything that spends: see lib/rate-limit.ts.
  const limited = rateLimited(req, LIMITS.recipes);
  if (limited) return limited;
  try {
    // A body that will not parse is the caller's fault, not the kitchen's —
    // answer 400 here, not the 502 the catch below reserves for real upstream
    // failures.
    let body: { ingredients?: unknown; count?: number };
    try {
      body = (await req.json()) as { ingredients?: unknown; count?: number };
    } catch {
      return badRequest("malformed body");
    }
    const count = body.count;
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return badRequest("missing ingredients");
    }
    // User-reachable input joined straight into a paid prompt, so bound it.
    // The caps sit far past any real kitchen (the app sends a shelf, dozens at
    // most) while keeping a secret-holder from mailing a novel at input-token
    // prices.
    const ingredients = body.ingredients.slice(0, 150).map((i) => String(i).slice(0, 120));
    // How many dishes to write. The app asks for two — they lead a deck whose
    // remaining eight come from the bundled book — but the number belongs to
    // the caller, not to this prompt, so changing the shape of that deck never
    // needs a proxy deploy. Clamped because it is user-reachable input and
    // each extra dish is output tokens somebody pays for.
    const wanted = Math.min(Math.max(Math.round(count ?? 2) || 2, 1), 4);

    // The parse lives INSIDE the retried closure: a truncated or malformed
    // JSON body is as transient as a 503, and both deserve another attempt
    // before the kitchen hears about it.
    const { value: parsed, trace } = await withModelFailover(
      [TEXT_MODEL, TEXT_FALLBACK_MODEL],
      async (model, abortSignal, plain) => {
        const result = await client().models.generateContent({
          model,
          contents:
            `Available ingredients: ${ingredients.join(", ")}. Assume basic staples ` +
            `(oil, salt, pepper, water) are on hand. Propose exactly ${wanted} distinct ` +
            "dishes a beginner cook would actually want to make tonight, using ONLY the available " +
            "ingredients plus staples. Every dish must break into 3-5 simple steps. " +
            "Every entry in ingredientNames MUST be copied character-for-character from " +
            "the available ingredients list above — never invent, rename, pluralize, or " +
            "singularize an ingredient. Set minutes to an honest total cook time. " +
            // TITLES ARE AN ADDRESS, NOT A FLOURISH, and this sentence is what
            // makes dish art affordable. Every title is the cache key, the CDN
            // key and the render-store key, so an adjective the model felt
            // like adding buys a whole new $0.067 drawing of a dish already on
            // disk — measured live, one burger became four separate purchases
            // as "Classic"/"Juicy"/"Loaded" variants. `DishTitle.canonical`
            // deliberately will not strip these (they can change what is
            // drawn), so the fix has to be here: don't emit them.
            "TITLE RULES: name the dish plainly in 1-3 words, the way a menu " +
            "would — \"Pesto Salad\", \"Beef Tacos\", \"Fried Rice\". No " +
            "adjectives and no adverbs of any kind (not \"Creamy\", \"Crispy\", " +
            "\"Loaded\", \"Cheesy\", \"Easy\", \"Quick\", \"Classic\", " +
            "\"Hearty\", \"Ultimate\"). Two different shelves that produce the " +
            "same dish must produce the same title.",
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.8,
            // Recipe prose doesn't benefit from a hidden reasoning pass either.
            // Skipping the hidden reasoning pass is pure latency win on a
            // rigid schema — but only where the model still accepts the flag.
            // `plain` is the failover loop telling us this one answered 400 to
            // it, in which case a slower answer beats none.
            ...(plain ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            // A recipe's summary + 3-5 steps runs ~450 tokens, so this covers
            // the clamped ceiling of four with room to spare; the cap is a
            // runaway brake, not a target.
            maxOutputTokens: plain ? 8192 : 4096,
            abortSignal,
          },
        });
        return JSON.parse(result.text ?? '{"recipes":[]}');
      },
      {
        ...BUDGET.text,
        retryable: (err) => isTransient(err) || err instanceof SyntaxError,
      },
    );

    return Response.json(parsed, { headers: { "x-pp-attempts": trace } });
  } catch (err) {
    return serverError(err);
  }
}

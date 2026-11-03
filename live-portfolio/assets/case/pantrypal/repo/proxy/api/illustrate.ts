import {
  client, IMAGE_MODEL, withModelFailover, BUDGET,
  authorized, unauthorized, badRequest, serverError,
  bakeOffAuthorized, forbidden,
} from "../lib/shared.js";
import { rateLimited, LIMITS } from "../lib/rate-limit.js";

// lib/illustration-style.json is a copy of design-system/tokens/
// illustration-style.json (the canonical contract) — re-copy when tokens change.
//
// IMPORTED, not readFileSync(process.cwd()). A path computed at runtime is
// invisible to Vercel's file tracing, so the JSON was left out of the function
// bundle and the module threw ENOENT on import — taking every request to this
// endpoint down with a 500 before it could even check authorization. An import
// is a dependency the bundler can actually see, and it drops the assumption
// that cwd is the project root.
import STYLE from "../lib/illustration-style.json" with { type: "json" };
import {
  illustrationPath, isDrawableSubject, loadStored, storeRender,
} from "../lib/illustration-store.js";

/** GET /api/illustrate?ingredient=tomato[&variant=dish] → PNG bytes.
 *
 *  Three tiers, cheapest first: the CDN absorbs repeats (GET, not POST, for
 *  exactly this reason), the Blob store answers anything ever drawn before,
 *  and only a genuinely new subject reaches the image model. `X-PP-Source`
 *  says which tier answered. */
export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) return unauthorized();
  // After the secret, before anything that spends: see lib/rate-limit.ts.
  const limited = rateLimited(req, LIMITS.illustrate);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const ingredient = url.searchParams.get("ingredient")?.trim();
    const variant = url.searchParams.get("variant");
    if (!ingredient) return badRequest("missing ingredient");
    // Before the store as well as the model: a subject the model may not be
    // asked to draw has no business being looked up under a name it could
    // only collide with. See `isDrawableSubject`.
    if (!isDrawableSubject(ingredient)) return badRequest("unsupported ingredient");

    // Whitelisted override so style bake-offs can A/B image models.
    const CANDIDATE_MODELS = [
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3.1-flash-lite-image",
      "gemini-3-pro-image",
      "gemini-3-pro-image-preview",
      "imagen-4.0-fast-generate-001",
      "imagen-4.0-generate-001",
    ];
    // A bake-off is a request that actually SELECTED one of the candidates.
    // `?model=` or `?model=typo` are NOT overrides — they fall through to the
    // shipped model and the store, exactly as a request with no `model` at all
    // would; only a real selection skips the store and buys a render.
    const requested = url.searchParams.get("model");
    const override =
      requested !== null && CANDIDATE_MODELS.includes(requested) ? requested : null;
    // Every override spends, so it answers to its own secret rather than the
    // one that ships in the binary (see `bakeOffAuthorized`). 403 rather than
    // a silent fallback: a bake-off answered by the shipped model would be a
    // measurement comparing that model with itself.
    if (override !== null && !bakeOffAuthorized(req)) {
      return forbidden("model override requires the bake-off secret");
    }
    const isBakeOff = override !== null;
    const model = override ?? IMAGE_MODEL;

    // ALREADY DRAWN? Every render this proxy has ever made is kept (see
    // lib/illustration-store.ts), so a subject costs the image model exactly
    // once — globally, not once per device and not once per CDN region.
    //
    // Skipped for the `model` override, which exists to A/B image models: a
    // bake-off that answered out of the store would compare one model with
    // itself. Those requests are also not written back, so a comparison render
    // can never become the canonical art for a subject.
    const path = illustrationPath(ingredient, variant);
    if (!isBakeOff) {
      const stored = await loadStored(path);
      if (stored) {
        return new Response(stored.bytes, {
          headers: {
            "Content-Type": stored.contentType,
            "Cache-Control": "public, s-maxage=31536000, immutable",
            "X-PP-Source": "store",
          },
        });
      }
    }

    // `existing=1` — answer from the CDN or the store, or not at all.
    //
    // This was the app's cost brake: a free device whose art budget was spent
    // sent it, and the 404 landed on the ingredient-sticker cluster instead.
    // The app stopped sending it in 1.3 — drawings are uncounted for everyone
    // now — so nothing in the shipped client says it any more. Kept for
    // tooling and for any caller that wants a store-only answer.
    //
    // Below the store check on purpose: a dish somebody already paid for, or
    // one the harvest tool bundled, still gets served.
    if (url.searchParams.get("existing") === "1") {
      return new Response(null, {
        status: 404,
        headers: {
          // Briefly cacheable: the store CAN gain this subject later, so a
          // year-long immutable negative would outlive the truth.
          "Cache-Control": "public, s-maxage=600",
          "X-PP-Source": "none",
        },
      });
    }

    let prompt: string = STYLE.style_prompt_template.replace(
      "{ingredient}",
      ingredient.toLowerCase(),
    );
    // Image models can't emit alpha and render "transparent background" as a
    // literal checkerboard. Ask for clean white instead; the client/batch
    // pipeline lifts the subject to fulfill the contract's transparent-PNG
    // output.
    prompt = prompt.replace(
      "plain transparent background",
      "plain solid pure white background",
    );
    if (variant === "dish") {
      prompt += " More interior detail is permitted for this composed dish.";
    }
    prompt += ` Avoid: ${STYLE.negative_prompt}.`;

    let imageBase64: string | undefined;
    let mimeType = "image/png";
    if (model.startsWith("imagen-")) {
      // Imagen models use the predict-style generateImages API. One model in
      // the list = two attempts on it; there is no style-compatible fallback
      // for images, so a burst that outlasts the retry stays a clean 503.
      const { value: result } = await withModelFailover(
        [model],
        (m, abortSignal) =>
          client().models.generateImages({
            model: m,
            prompt,
            config: { numberOfImages: 1, abortSignal },
          }),
        BUDGET.image,
      );
      const generated = result.generatedImages?.[0]?.image;
      imageBase64 = generated?.imageBytes;
      mimeType = generated?.mimeType ?? mimeType;
    }
    let usage = "";
    if (!model.startsWith("imagen-")) {
      const { value: result } = await withModelFailover(
        [model],
        (m, abortSignal) =>
          client().models.generateContent({
            model: m,
            contents: prompt,
            config: { imageConfig: { aspectRatio: "1:1" }, abortSignal },
          }),
        BUDGET.image,
      );
      const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      imageBase64 = part?.inlineData?.data;
      mimeType = part?.inlineData?.mimeType ?? mimeType;
      // Google's own accounting, so costs can be computed from real numbers.
      usage = JSON.stringify({
        modelVersion: result.modelVersion,
        promptTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        totalTokens: result.usageMetadata?.totalTokenCount,
      });
    }
    if (!imageBase64) return serverError(new Error("no image in response"));

    const bytes = Buffer.from(imageBase64, "base64");
    // AWAITED, not fire-and-forget. A serverless function can be frozen the
    // instant its response is returned, which would abandon the write and
    // re-bill this exact subject next time — the one outcome this store exists
    // to prevent. The put is ~100ms against a render that took seconds.
    if (!isBakeOff) await storeRender(path, bytes, mimeType);

    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, s-maxage=31536000, immutable",
        "X-PP-Source": "model",
        ...(usage ? { "X-PP-Usage": usage } : {}),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

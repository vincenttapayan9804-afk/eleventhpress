/**
 * Portable LLM provider foundation.
 *
 * Wraps two real chat providers behind a single chatJSON() helper so every
 * caller (editorial triage, and every other AI feature) goes through this
 * instead of talking to an SDK/API directly:
 *
 *  1. Anthropic Messages API (@anthropic-ai/sdk) — primary, when
 *     ANTHROPIC_API_KEY is set.
 *  2. A free, open-weight model over OpenRouter's OpenAI-compatible API —
 *     when OPENROUTER_API_KEY is set. OpenRouter hosts genuinely
 *     open-weight models (Zhipu's GLM, Moonshot's Kimi, DeepSeek, Qwen,
 *     Llama, ...) with ":free"-suffixed IDs that cost $0 to call, so this
 *     tier works with no paid key at all — see OSS_MODEL below.
 *
 * chatJSON() tries tier 1, then tier 2, in order, and only throws once
 * both are unavailable or have failed. Every existing caller already
 * catches that throw and falls back to its own deterministic heuristic
 * (see triage.ts, manuscript-checks.ts, glossary.ts) — this just inserts
 * a real, free tier in between, so that heuristic fallback fires far less
 * often. ChatJSONResult.provider always says which tier actually
 * answered — never silently presented as the other.
 */
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_MODEL = "claude-sonnet-5";

// Any OpenRouter model ID ending in ":free" is $0 to call. GLM-4.5-Air
// (Zhipu AI, open-weight/MIT) is the default; override via OPENROUTER_MODEL
// to point at a different free open-weight model without a code change —
// e.g. "moonshotai/kimi-k2:free", "deepseek/deepseek-chat-v3.1:free",
// "qwen/qwen3-235b-a22b:free", "meta-llama/llama-3.3-70b-instruct:free".
const OSS_MODEL = process.env.OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// A third, genuinely airgapped tier: a small open-weight instruct model run
// in-process via @xenova/transformers (same runtime this codebase already
// uses for local embeddings — src/lib/chunk-embeddings.ts) instead of any
// external API call at all. Opt-in only (AIRGAPPED_MODE=true) — unlike the
// two API tiers above, loading a generative model has real memory/latency
// cost, so this is never attempted unless an operator has explicitly
// chosen "no manuscript text leaves this deployment" over answer quality.
// When on, chatJSON() calls ONLY this tier and never falls through to
// Anthropic or OpenRouter even if those keys happen to be set, since
// falling through would silently break the data-residency guarantee this
// mode exists for. A smaller model means weaker JSON-formatting
// reliability than the two cloud tiers — every result is honestly tagged
// provider: "local-airgapped", same as embeddingMode never presents a
// hash-fallback embedding as the real local model's output.
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || "Xenova/Qwen1.5-0.5B-Chat";

export function isAirgappedMode(): boolean {
  return process.env.AIRGAPPED_MODE === "true";
}

let localGeneratorPromise: Promise<any | null> | null = null;

/** Lazily loads the local generative model once per warm instance.
 * Resolves null (never throws) if it can't load, same fail-open contract
 * as chunk-embeddings.ts's getExtractor(). */
function getLocalGenerator(): Promise<any | null> {
  if (!localGeneratorPromise) {
    localGeneratorPromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        return await pipeline("text-generation", LOCAL_LLM_MODEL);
      } catch (e) {
        console.error("[llm] local airgapped model failed to load:", e);
        return null;
      }
    })();
  }
  return localGeneratorPromise;
}

/** Test-only: clears the cached local-model-load promise. */
export function __resetLocalGeneratorCacheForTests(): void {
  localGeneratorPromise = null;
}

let client: Anthropic | null = null;

/** True if the Anthropic tier specifically is configured. */
export function isLLMAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** True if the free open-weight (OpenRouter) tier is configured. */
export function ossLLMAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * True if chatJSON() has any real tier to try at all. Callers that gate a
 * feature on "is there some real AI available" (as opposed to
 * specifically Anthropic) should check this instead of isLLMAvailable(),
 * so the feature also lights up with just a free OPENROUTER_API_KEY.
 */
export function anyLLMAvailable(): boolean {
  return isAirgappedMode() || isLLMAvailable() || ossLLMAvailable();
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ChatJSONResult<T> {
  data: T;
  rawResponse: string;
  model: string;
  provider: "anthropic" | "oss-free" | "local-airgapped";
}

function extractJSON<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM response did not contain a JSON object");
  }
  return JSON.parse(jsonMatch[0]) as T;
}

async function chatJSONAnthropic<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ChatJSONResult<T>> {
  const response = await getClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `LLM refused the request (category: ${response.stop_details?.category ?? "unknown"})`
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  if (!text) {
    throw new Error("LLM response contained no text content");
  }

  return { data: extractJSON<T>(text), rawResponse: text, model: ANTHROPIC_MODEL, provider: "anthropic" };
}

async function chatJSONOss<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ChatJSONResult<T>> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://eleventhpress.org",
      "X-Title": "Eleventh Press",
    },
    body: JSON.stringify({
      model: OSS_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter request failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("OSS LLM response contained no text content");
  }

  return { data: extractJSON<T>(text), rawResponse: text, model: OSS_MODEL, provider: "oss-free" };
}

async function chatJSONLocal<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ChatJSONResult<T>> {
  const generator = await getLocalGenerator();
  if (!generator) {
    throw new Error(`Local airgapped model (${LOCAL_LLM_MODEL}) is not available in this deployment`);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const output = await generator(messages, {
    max_new_tokens: Math.min(maxTokens, 512),
    do_sample: false,
  });
  const generated = Array.isArray(output) ? output[0] : output;
  const generatedText = generated?.generated_text;
  const text: string =
    typeof generatedText === "string"
      ? generatedText
      : Array.isArray(generatedText)
        ? generatedText.at(-1)?.content ?? ""
        : "";

  if (!text) {
    throw new Error("Local airgapped model produced no text output");
  }

  return { data: extractJSON<T>(text), rawResponse: text, model: LOCAL_LLM_MODEL, provider: "local-airgapped" };
}

/**
 * Sends a system + user prompt pair and parses the reply as JSON.
 *
 * In airgapped mode (AIRGAPPED_MODE=true), tries ONLY the local tier and
 * never falls through to a cloud API even if one is configured — see the
 * LOCAL_LLM_MODEL comment above for why. Otherwise tries the Anthropic
 * tier then the free OSS tier in order. Throws only once every tier this
 * call is allowed to use is unavailable or has failed — callers are
 * expected to catch and fall back to a heuristic rather than treat a
 * throw as fatal.
 */
export async function chatJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number } = {}
): Promise<ChatJSONResult<T>> {
  const maxTokens = opts.maxTokens ?? 4096;

  if (isAirgappedMode()) {
    return chatJSONLocal<T>(systemPrompt, userPrompt, maxTokens);
  }

  let anthropicError: Error | undefined;

  if (isLLMAvailable()) {
    try {
      return await chatJSONAnthropic<T>(systemPrompt, userPrompt, maxTokens);
    } catch (e) {
      anthropicError = e as Error;
    }
  }

  if (ossLLMAvailable()) {
    try {
      return await chatJSONOss<T>(systemPrompt, userPrompt, maxTokens);
    } catch (e) {
      if (anthropicError) {
        throw new Error(
          `Anthropic tier failed (${anthropicError.message}) and OSS fallback tier also failed: ${(e as Error).message}`
        );
      }
      throw e;
    }
  }

  if (anthropicError) throw anthropicError;
  throw new Error("No LLM provider configured (set ANTHROPIC_API_KEY and/or OPENROUTER_API_KEY)");
}

export interface DescribeImageResult {
  altText: string;
  model: string;
}

/**
 * Vision call for figure alt-text generation (src/lib/alt-text.ts). Same
 * throw-on-unavailable/refusal/empty contract as chatJSON — callers are
 * expected to catch and fall back to a heuristic (e.g. an existing figure
 * caption) rather than treat a throw as fatal, exactly like every other
 * LLM-backed feature in this codebase.
 */
export async function describeImage(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  promptContext: string
): Promise<DescribeImageResult> {
  if (!isLLMAvailable()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await getClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    thinking: { type: "adaptive" },
    system:
      "You write concise, descriptive, screen-reader-appropriate alt text for figures in academic articles. Describe what the image actually shows — data trends, diagram structure, photographed subject — in one or two plain sentences. Never speculate beyond what's visible. Do not begin with \"Image of\" or \"Figure showing\".",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: promptContext },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `LLM refused the request (category: ${response.stop_details?.category ?? "unknown"})`
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!text) {
    throw new Error("LLM response contained no text content");
  }

  return { altText: text, model: ANTHROPIC_MODEL };
}

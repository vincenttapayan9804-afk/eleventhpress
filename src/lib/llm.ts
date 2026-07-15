/**
 * Portable LLM provider foundation.
 *
 * Wraps the real Anthropic Messages API (@anthropic-ai/sdk) behind a single
 * chatJSON() helper. Every caller (editorial triage, and future AI features)
 * goes through this instead of talking to the SDK directly, so the model
 * choice, JSON-extraction, and error handling live in one place.
 *
 * Requires ANTHROPIC_API_KEY. When it's unset, isLLMAvailable() returns
 * false and callers should fall back to a deterministic heuristic — this
 * module never silently returns fabricated data.
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function isLLMAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
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
}

/**
 * Sends a system + user prompt pair and parses the reply as JSON.
 * Throws if the API call fails, the response was refused, or the reply
 * doesn't contain a parseable JSON object — callers are expected to catch
 * and fall back to a heuristic rather than treat a throw as fatal.
 */
export async function chatJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number } = {}
): Promise<ChatJSONResult<T>> {
  if (!isLLMAvailable()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
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

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM response did not contain a JSON object");
  }

  const data = JSON.parse(jsonMatch[0]) as T;
  return { data, rawResponse: text, model: MODEL };
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
    model: MODEL,
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

  return { altText: text, model: MODEL };
}

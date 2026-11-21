/**
 * Streamed text generation with an ordered chain of model providers, for
 * features where the reader watches the answer being written (the Research
 * Assistant, src/app/api/corpus-chat/route.ts).
 *
 * The chain, tried in this order and configured only through environment
 * variables (see .env.example):
 *
 *  1. A self-hosted open-weight model on any OpenAI-compatible server
 *     (vLLM, Ollama, LM Studio, Text Generation Inference …):
 *     LLM_BASE_URL + LLM_MODEL (+ LLM_API_KEY if the server wants one).
 *  2. OpenRouter's free models: OPENROUTER_API_KEY, with OPENROUTER_MODELS
 *     (a comma-separated list of pinned ":free" models, tried in order).
 *     Pinning matters: the "openrouter/free" router picks a different model
 *     on every request, so speed and quality swing widely. It is used only
 *     when no models are pinned.
 *  3. Anthropic, only if ANTHROPIC_API_KEY is set.
 *
 * AIRGAPPED_MODE=true uses only the in-process local model (llm.ts).
 *
 * Reliability rules:
 *  - A provider that doesn't start answering within FIRST_ACTIVITY_MS is
 *    abandoned and the next one is tried.
 *  - A provider that fails is skipped for CIRCUIT_OPEN_MS on this server
 *    instance, so later questions don't wait on a server that is down. If
 *    every provider is marked down they are all tried again anyway.
 *  - Once text has started arriving the provider is kept: if it then fails,
 *    stalls or the caller's deadline passes, the text written so far is
 *    returned via StreamInterruptedError so the caller can still show it.
 *
 * Tracing: each attempt is a Sentry span ("gen_ai.chat") with the provider,
 * model, time to first token, characters written and outcome. Never the
 * prompt or the answer. Without a Sentry DSN it records nothing.
 */
import type Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import {
  ANTHROPIC_MODEL,
  DEFAULT_OSS_MODEL,
  OPENROUTER_BASE_URL,
  envValue,
  generateLocalText,
  getClient,
  isAirgappedMode,
} from "@/lib/llm";

export type StreamProvider = "self-hosted" | "oss-free" | "anthropic" | "local-airgapped";

export interface StreamCandidate {
  /** Stable key for the circuit breaker, e.g. "oss-free:meta-llama/…:free". */
  id: string;
  provider: StreamProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  openRouter?: boolean;
}

export interface StreamChatOptions {
  maxTokens: number;
  temperature?: number;
  /** Aborts everything: the reader pressed Stop, or the caller's deadline passed. */
  signal?: AbortSignal;
  /** Called with each piece of answer text as it arrives. */
  onDelta?: (text: string) => void;
}

export interface StreamChatResult {
  text: string;
  provider: StreamProvider;
  model: string;
  /** Milliseconds from the call to the first piece of answer text. */
  firstTokenMs: number | null;
  /** Providers tried before this one succeeded. */
  attempts: number;
}

/** Text had started arriving when the provider failed, stalled or the deadline passed. */
export class StreamInterruptedError extends Error {
  constructor(
    message: string,
    public readonly partial: StreamChatResult
  ) {
    super(message);
    this.name = "StreamInterruptedError";
  }
}

function numberEnv(name: string, fallback: number): number {
  const n = Number(envValue(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** No token (answer or reasoning) within this long: try the next provider. */
const FIRST_ACTIVITY_MS = () => numberEnv("LLM_FIRST_TOKEN_TIMEOUT_MS", 15_000);
/** Silence this long once a stream has started: treat it as stalled. */
const STALL_MS = () => numberEnv("LLM_STALL_TIMEOUT_MS", 20_000);
/**
 * A model that is still only thinking (no answer text) this long after the
 * request is abandoned for the next one: some free reasoning models think
 * until they run out of tokens and never write an answer.
 */
const THINK_LIMIT_MS = () => numberEnv("LLM_THINK_TIMEOUT_MS", 18_000);
/** How long a failed provider is skipped. */
const CIRCUIT_OPEN_MS = () => numberEnv("LLM_CIRCUIT_OPEN_MS", 60_000);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function trimBase(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}

/** The providers configured in this deployment, in the order they are tried. */
export function streamCandidates(): StreamCandidate[] {
  if (isAirgappedMode()) return [{ id: "local-airgapped", provider: "local-airgapped", model: "local" }];
  const out: StreamCandidate[] = [];
  const customBase = envValue("LLM_BASE_URL");
  const customIsOpenRouter = !!customBase && hostOf(customBase).endsWith("openrouter.ai");

  // 1. Self-hosted server.
  if (customBase && !customIsOpenRouter) {
    const model = envValue("LLM_MODEL");
    if (model) {
      out.push({ id: `self-hosted:${model}`, provider: "self-hosted", model, baseUrl: trimBase(customBase), apiKey: envValue("LLM_API_KEY") });
    } else {
      console.warn("[llm-stream] LLM_BASE_URL is set but LLM_MODEL is not; the self-hosted server is skipped");
    }
  }

  // 2. OpenRouter free models.
  const orKey = envValue("OPENROUTER_API_KEY") ?? (customIsOpenRouter || !customBase ? envValue("LLM_API_KEY") : undefined);
  if (orKey) {
    const pinned = (envValue("OPENROUTER_MODELS") ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const single = envValue("OPENROUTER_MODEL") ?? (customIsOpenRouter ? envValue("LLM_MODEL") : undefined);
    const models = pinned.length ? pinned : [single ?? DEFAULT_OSS_MODEL];
    for (const model of [...new Set(models)]) {
      out.push({ id: `oss-free:${model}`, provider: "oss-free", model, baseUrl: trimBase(customIsOpenRouter ? customBase! : OPENROUTER_BASE_URL), apiKey: orKey, openRouter: true });
    }
  }

  // 3. Anthropic.
  if (envValue("ANTHROPIC_API_KEY")) out.push({ id: `anthropic:${ANTHROPIC_MODEL}`, provider: "anthropic", model: ANTHROPIC_MODEL });
  return out;
}

export function anyStreamProvider(): boolean {
  return streamCandidates().length > 0;
}

// ── Circuit breaker (per server instance) ────────────────────────────────
const openUntil = new Map<string, number>();
const lastFailure = new Map<string, { at: string; message: string }>();

function markFailed(id: string, message: string) {
  openUntil.set(id, Date.now() + CIRCUIT_OPEN_MS());
  lastFailure.set(id, { at: new Date().toISOString(), message: message.slice(0, 300) });
}
function markHealthy(id: string) {
  openUntil.delete(id);
}
function isOpen(id: string): boolean {
  const until = openUntil.get(id);
  return !!until && until > Date.now();
}

/** Test-only. */
export function __resetStreamCircuitForTests(): void {
  openUntil.clear();
  lastFailure.clear();
}

/** Provider health for the editors' status view: what is configured and what last failed. */
export function streamProviderStatus(): { id: string; provider: StreamProvider; model: string; skippedUntil: string | null; lastFailure: { at: string; message: string } | null }[] {
  return streamCandidates().map((c) => ({
    id: c.id,
    provider: c.provider,
    model: c.model,
    skippedUntil: isOpen(c.id) ? new Date(openUntil.get(c.id)!).toISOString() : null,
    lastFailure: lastFailure.get(c.id) ?? null,
  }));
}

// ── One provider ─────────────────────────────────────────────────────────

interface AttemptState {
  text: string;
  firstTokenAt: number | null;
  /** Answer or reasoning tokens have arrived. */
  active: boolean;
  model: string;
  /** Reasoning tokens arrived (helps explain an empty answer). */
  reasoned?: boolean;
  /** The provider's finish_reason, when it sent one. */
  finishReason?: string;
}

/** A watchdog that aborts `controller` after `ms` of no activity; `poke()` resets it. */
function watchdog(controller: AbortController, ms: () => number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current = ms();
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new Error(`no response for ${Math.round(current / 1000)}s`)), current);
  };
  arm();
  return {
    poke(next?: () => number) {
      if (next) current = next();
      arm();
    },
    stop() {
      if (timer) clearTimeout(timer);
    },
  };
}

async function streamOpenAICompatible(c: StreamCandidate, system: string, user: string, opts: StreamChatOptions, signal: AbortSignal, state: AttemptState, onActivity: () => void) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (c.apiKey) headers.Authorization = `Bearer ${c.apiKey}`;
  if (c.openRouter) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://eleventhpress.com";
    headers["X-Title"] = "Eleventh Press";
  }
  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({
      model: c.model,
      stream: true,
      // Free reasoning models spend this budget on thinking before the answer;
      // with only the answer's budget they can stop at "length" having written
      // nothing. Leave room for both, as the Anthropic path does.
      max_tokens: c.openRouter ? Math.max(opts.maxTokens * 3, 8000) : opts.maxTokens,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      // Free reasoning models can think for a minute before writing; keep it short.
      ...(c.openRouter ? { reasoning: { effort: "low" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${c.id} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // SSE comments (": OPENROUTER PROCESSING") and blank lines
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json?.error) throw new Error(`${c.id} stream error: ${JSON.stringify(json.error).slice(0, 300)}`);
      if (typeof json?.model === "string" && json.model) state.model = json.model;
      const choice = json?.choices?.[0];
      if (typeof choice?.finish_reason === "string") state.finishReason = choice.finish_reason;
      const delta = choice?.delta ?? {};
      if (delta.reasoning || delta.reasoning_content) {
        state.reasoned = true;
        onActivity();
      }
      if (typeof delta.content === "string" && delta.content) {
        if (state.firstTokenAt === null) state.firstTokenAt = Date.now();
        state.text += delta.content;
        onActivity();
        opts.onDelta?.(delta.content);
      }
    }
    if (done) return;
  }
}

async function streamAnthropic(c: StreamCandidate, system: string, user: string, opts: StreamChatOptions, signal: AbortSignal, state: AttemptState, onActivity: () => void) {
  const client: Anthropic = getClient();
  const stream = await client.messages.create(
    {
      model: c.model,
      // Thinking shares this budget with the answer, so leave room for both.
      max_tokens: Math.max(opts.maxTokens * 3, 8000),
      system,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: user }],
      stream: true,
    },
    { signal }
  );
  for await (const ev of stream) {
    if (ev.type === "content_block_delta") {
      if (ev.delta.type === "text_delta") {
        if (state.firstTokenAt === null) state.firstTokenAt = Date.now();
        state.text += ev.delta.text;
        onActivity();
        opts.onDelta?.(ev.delta.text);
      } else {
        onActivity();
      }
    } else if (ev.type === "message_delta" && ev.delta.stop_reason === "refusal") {
      throw new Error(`${c.id} declined the request`);
    }
  }
}

/**
 * Streams one reply, trying each configured provider in turn until one
 * starts answering. Throws when none could (or the signal aborted first);
 * throws StreamInterruptedError, carrying the partial text, when a provider
 * stops part-way through.
 */
export async function streamChat(system: string, user: string, opts: StreamChatOptions): Promise<StreamChatResult> {
  const started = Date.now();
  const all = streamCandidates();
  if (all.length === 0) throw new Error("No model provider configured (LLM_BASE_URL/LLM_MODEL, OPENROUTER_API_KEY or ANTHROPIC_API_KEY)");

  if (all[0].provider === "local-airgapped") {
    const { text, model } = await generateLocalText(system, user, opts.maxTokens);
    opts.onDelta?.(text);
    return { text, provider: "local-airgapped", model, firstTokenMs: Date.now() - started, attempts: 1 };
  }

  const healthy = all.filter((c) => !isOpen(c.id));
  // The openrouter/free router picks a different free model on each request,
  // so a second try often lands on one that answers.
  const order = (healthy.length ? healthy : all).flatMap((c) => (c.openRouter && c.model === DEFAULT_OSS_MODEL ? [c, c] : [c]));
  const errors: string[] = [];
  for (let i = 0; i < order.length; i++) {
    const c = order[i];
    if (opts.signal?.aborted) break;
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort(opts.signal?.reason);
    opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
    const state: AttemptState = { text: "", firstTokenAt: null, active: false, model: c.model };
    const dog = watchdog(controller, FIRST_ACTIVITY_MS);
    const thinkLimit = setTimeout(() => {
      if (!state.text) controller.abort(new Error(`${c.id} was still thinking after ${Math.round(THINK_LIMIT_MS() / 1000)}s with no answer`));
    }, THINK_LIMIT_MS());
    const onActivity = () => {
      if (!state.active) {
        state.active = true;
        dog.poke(STALL_MS);
      } else dog.poke();
    };
    const result = (): StreamChatResult => ({
      text: state.text,
      provider: c.provider,
      model: state.model,
      firstTokenMs: state.firstTokenAt === null ? null : state.firstTokenAt - started,
      attempts: i + 1,
    });
    const span = Sentry.startInactiveSpan({
      name: `stream ${c.provider}`,
      op: "gen_ai.chat",
      attributes: { "gen_ai.system": c.provider, "gen_ai.request.model": c.model, "llm.attempt": i + 1 },
    });
    let outcome = "error";
    try {
      if (c.provider === "anthropic") await streamAnthropic(c, system, user, opts, controller.signal, state, onActivity);
      else await streamOpenAICompatible(c, system, user, opts, controller.signal, state, onActivity);
      if (!state.text.trim()) {
        const why = [state.finishReason && `finish: ${state.finishReason}`, state.reasoned && "only reasoning"].filter(Boolean).join(", ");
        throw new Error(`${c.id} returned no answer text${why ? ` (${why})` : ""}`);
      }
      markHealthy(c.id);
      outcome = "ok";
      return result();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      outcome = opts.signal?.aborted ? "aborted" : controller.signal.aborted ? (state.text.trim() ? "stalled" : "no_response") : "error";
      if (state.text.trim()) {
        // Keep what the reader has already seen rather than starting over.
        if (!opts.signal?.aborted) markFailed(c.id, message);
        throw new StreamInterruptedError(opts.signal?.aborted ? "stopped" : message, result());
      }
      if (opts.signal?.aborted) throw e;
      markFailed(c.id, message);
      errors.push(`${c.id}: ${message}`);
      console.warn(`[llm-stream] ${c.id} failed, trying the next provider:`, message);
    } finally {
      span.setAttributes({
        "llm.outcome": outcome,
        "gen_ai.response.model": state.model,
        "llm.first_token_ms": state.firstTokenAt === null ? -1 : state.firstTokenAt - started,
        "llm.output_chars": state.text.length,
      });
      span.setStatus({ code: outcome === "ok" ? 1 : 2, message: outcome });
      span.end();
      dog.stop();
      clearTimeout(thinkLimit);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }
  }
  throw new Error(`Every model provider failed: ${errors.join(" | ") || "aborted"}`);
}

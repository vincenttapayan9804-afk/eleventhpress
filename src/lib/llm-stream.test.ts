import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { __resetStreamCircuitForTests, streamCandidates, streamChat, streamProviderStatus, StreamInterruptedError } from "./llm-stream";

/**
 * streamChat() against a fake OpenAI-compatible server (fetch is replaced
 * per test): provider order from the environment, fallback when a provider
 * fails or never answers, the circuit breaker, and keeping partial text.
 */

const ENV_KEYS = [
  "LLM_BASE_URL",
  "LLM_MODEL",
  "LLM_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_MODELS",
  "ANTHROPIC_API_KEY",
  "AIRGAPPED_MODE",
  "LLM_FIRST_TOKEN_TIMEOUT_MS",
  "LLM_STALL_TIMEOUT_MS",
] as const;
const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const realWarn = console.warn;

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetStreamCircuitForTests();
  console.warn = () => {};
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
  console.warn = realWarn;
});

/** An SSE response body that sends `pieces` as content deltas (with an optional reasoning delta first). */
function sse(pieces: string[], opts: { model?: string; reasoningFirst?: boolean; failAfter?: number; delayMs?: number } = {}) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(": OPENROUTER PROCESSING\n\n"));
      if (opts.reasoningFirst) controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: "thinking" } }] })}\n\n`));
      for (let i = 0; i < pieces.length; i++) {
        if (opts.failAfter !== undefined && i === opts.failAfter) {
          // Let the reader take what was already sent, as on a real dropped connection.
          await new Promise((r) => setTimeout(r, 20));
          controller.error(new Error("connection reset"));
          return;
        }
        if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ model: opts.model ?? "served-model", choices: [{ delta: { content: pieces[i] } }] })}\n\n`));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/** A response that never sends anything until the request is aborted. */
function hanging(signal: AbortSignal | null | undefined) {
  return new Promise<Response>((_, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
}

type Handler = (url: string, body: any, init: RequestInit) => Response | Promise<Response>;
function fakeFetch(handler: Handler) {
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    return handler(url, body, init);
  }) as typeof fetch;
  return calls;
}

describe("streamCandidates", () => {
  test("self-hosted first, then each pinned free OpenRouter model, then Anthropic", () => {
    process.env.LLM_BASE_URL = "http://gpu-box:8000/v1/";
    process.env.LLM_MODEL = "qwen-72b";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "a/model:free, b/model:free";
    process.env.ANTHROPIC_API_KEY = "sk-ant";
    const c = streamCandidates();
    expect(c.map((x) => x.provider)).toEqual(["self-hosted", "oss-free", "oss-free", "anthropic"]);
    expect(c[0]).toMatchObject({ baseUrl: "http://gpu-box:8000/v1", model: "qwen-72b" });
    expect(c.slice(1, 3).map((x) => x.model)).toEqual(["a/model:free", "b/model:free"]);
  });

  test("with nothing pinned, OpenRouter uses its free router; a self-hosted server without a model is skipped", () => {
    process.env.LLM_BASE_URL = "http://gpu-box:8000/v1";
    process.env.OPENROUTER_API_KEY = "or-key";
    const c = streamCandidates();
    expect(c.map((x) => x.id)).toEqual(["oss-free:openrouter/free"]);
  });

  test("the existing single-tier setup (LLM_BASE_URL pointing at OpenRouter) keeps working", () => {
    process.env.LLM_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.LLM_API_KEY = "or-key";
    process.env.LLM_MODEL = "pinned/model:free";
    expect(streamCandidates().map((x) => x.id)).toEqual(["oss-free:pinned/model:free"]);
  });

  test("airgapped mode uses only the local model", () => {
    process.env.AIRGAPPED_MODE = "true";
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(streamCandidates().map((x) => x.provider)).toEqual(["local-airgapped"]);
  });
});

describe("streamChat", () => {
  test("streams the deltas and reports the model that answered", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "pinned/model:free";
    const calls = fakeFetch(() => new Response(sse(["Hello ", "world"], { model: "pinned/model:free", reasoningFirst: true })));
    const seen: string[] = [];
    const r = await streamChat("sys", "user", { maxTokens: 100, temperature: 0.1, onDelta: (t) => seen.push(t) });
    expect(seen).toEqual(["Hello ", "world"]);
    expect(r).toMatchObject({ text: "Hello world", provider: "oss-free", model: "pinned/model:free", attempts: 1 });
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].body).toMatchObject({ model: "pinned/model:free", stream: true, max_tokens: 8000, temperature: 0.1 });
  });

  test("a model that only reasons is skipped with the reason, and the next one answers", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "thinker/model:free,writer/model:free";
    const enc = new TextEncoder();
    const onlyReasoning = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: "hmm" } }] })}\n\n`));
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] })}\n\n`));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
    const warn = console.warn;
    const warnings: string[] = [];
    console.warn = (...a: unknown[]) => void warnings.push(a.map(String).join(" "));
    try {
      fakeFetch((_url, body) => new Response((body as { model: string }).model.startsWith("thinker") ? onlyReasoning() : sse(["answer"])));
      const r = await streamChat("s", "u", { maxTokens: 50 });
      expect(r).toMatchObject({ text: "answer", attempts: 2 });
      expect(warnings.join("\n")).toContain("returned no answer text (finish: length, only reasoning)");
    } finally {
      console.warn = warn;
    }
  });

  test("a self-hosted server that is down falls through to OpenRouter, and is then skipped for a while", async () => {
    process.env.LLM_BASE_URL = "http://gpu-box:8000/v1";
    process.env.LLM_MODEL = "qwen-72b";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "pinned/model:free";
    const calls = fakeFetch((url) => (url.startsWith("http://gpu-box") ? new Response("bad gateway", { status: 502 }) : new Response(sse(["ok"]))));
    const first = await streamChat("s", "u", { maxTokens: 50 });
    expect(first).toMatchObject({ text: "ok", provider: "oss-free", attempts: 2 });
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["gpu-box:8000", "openrouter.ai"]);
    expect(streamProviderStatus()[0]).toMatchObject({ provider: "self-hosted" });
    expect(streamProviderStatus()[0].skippedUntil).not.toBeNull();

    calls.length = 0;
    await streamChat("s", "u", { maxTokens: 50 });
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["openrouter.ai"]);
  });

  test("a provider that never starts answering is abandoned for the next one", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "slow/model:free, fast/model:free";
    process.env.LLM_FIRST_TOKEN_TIMEOUT_MS = "40";
    fakeFetch((_url, body, init) => (body.model === "slow/model:free" ? hanging(init.signal) : new Response(sse(["fast answer"]))));
    const r = await streamChat("s", "u", { maxTokens: 50 });
    expect(r).toMatchObject({ text: "fast answer", model: "served-model", attempts: 2 });
  });

  test("a provider that fails after writing keeps the partial text", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "flaky/model:free, other/model:free";
    fakeFetch(() => new Response(sse(["First part. ", "Second part."], { failAfter: 1 })));
    let caught: unknown;
    try {
      await streamChat("s", "u", { maxTokens: 50 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StreamInterruptedError);
    expect((caught as StreamInterruptedError).partial.text).toBe("First part. ");
  });

  test("the caller's deadline aborts a running stream and returns what was written", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "slow/model:free";
    fakeFetch((_u, _b, init) => hangingAfterFirst(init.signal));
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("deadline")), 60);
    let caught: unknown;
    try {
      await streamChat("s", "u", { maxTokens: 50, signal: controller.signal });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StreamInterruptedError);
    expect((caught as StreamInterruptedError).partial.text).toBe("One. ");
  });

  test("with every provider failing it reports each one", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODELS = "a:free, b:free";
    fakeFetch(() => new Response("rate limited", { status: 429 }));
    await expect(streamChat("s", "u", { maxTokens: 50 })).rejects.toThrow(/oss-free:a:free.*oss-free:b:free/);
  });
});

/** Sends one delta, then nothing until the request is aborted. */
function hangingAfterFirst(signal: AbortSignal | null | undefined): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "One. " } }] })}\n\n`));
      signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")), { once: true });
    },
  });
  return new Response(body);
}

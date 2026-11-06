import { describe, test, expect, beforeEach, afterEach } from "bun:test";

/**
 * The OpenAI-compatible LLM tier (src/lib/llm.ts): LLM_BASE_URL / LLM_API_KEY
 * / LLM_MODEL routing, the OpenRouter defaults, and the fallback order.
 *
 * Other test files replace "@/lib/llm" with mock.module(), and bun shares
 * that registry across files, so the real module is imported through a
 * query-string specifier that bypasses any registered mock.
 */
type LlmModule = typeof import("./llm");
const REAL_LLM_SPECIFIER = "./llm.ts?real=llm-compat-test";
const load = () => import(REAL_LLM_SPECIFIER) as Promise<LlmModule>;

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_VISION_MODEL",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_VISION_MODEL",
  "AIRGAPPED_MODE",
] as const;

let savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let calls: { url: string; headers: Record<string, string>; body: any }[] = [];

function stubFetch(reply: { ok?: boolean; status?: number; content?: string; text?: string }) {
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init?.headers ?? {}, body: JSON.parse(init?.body ?? "null") });
    const ok = reply.ok ?? true;
    return {
      ok,
      status: reply.status ?? (ok ? 200 : 500),
      statusText: ok ? "OK" : "Error",
      json: async () => ({ choices: [{ message: { content: reply.content ?? '{"answer":"hi"}' } }] }),
      text: async () => reply.text ?? "",
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  calls = [];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
});

describe("OpenAI-compatible tier configuration", () => {
  test("defaults to OpenRouter and its free default model", async () => {
    const llm = await load();
    expect(llm.compatBaseUrl()).toBe("https://openrouter.ai/api/v1");
    expect(llm.compatModel()).toBe("z-ai/glm-4.5-air:free");
  });

  test("is unavailable with nothing configured; blank values count as unset", async () => {
    const llm = await load();
    expect(llm.ossLLMAvailable()).toBe(false);
    process.env.LLM_BASE_URL = "   ";
    process.env.LLM_API_KEY = "";
    expect(llm.ossLLMAvailable()).toBe(false);
    expect(llm.anyLLMAvailable()).toBe(false);
  });

  test("OPENROUTER_API_KEY alone enables it (backward compatible)", async () => {
    const llm = await load();
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(llm.ossLLMAvailable()).toBe(true);
    expect(llm.compatHeaders().Authorization).toBe("Bearer or-key");
    expect(llm.compatHeaders()["X-Title"]).toBe("Eleventh Press");
  });

  test("LLM_BASE_URL alone enables a keyless self-hosted server", async () => {
    const llm = await load();
    process.env.LLM_BASE_URL = "http://gpu-box:11434/v1/";
    expect(llm.ossLLMAvailable()).toBe(true);
    expect(llm.compatBaseUrl()).toBe("http://gpu-box:11434/v1");
    const headers = llm.compatHeaders();
    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-Title"]).toBeUndefined();
  });

  test("tolerates a base URL that already ends in /chat/completions", async () => {
    const llm = await load();
    process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
    expect(llm.compatBaseUrl()).toBe("https://api.groq.com/openai/v1");
  });

  test("a non-OpenRouter server requires LLM_MODEL", async () => {
    const llm = await load();
    process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
    expect(() => llm.compatModel()).toThrow(/LLM_MODEL must be set/);
    process.env.LLM_MODEL = "llama-3.3-70b-versatile";
    expect(llm.compatModel()).toBe("llama-3.3-70b-versatile");
  });

  test("LLM_API_KEY and LLM_MODEL take precedence over the OPENROUTER_* names", async () => {
    const llm = await load();
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_MODEL = "or/model:free";
    process.env.LLM_API_KEY = "generic-key";
    process.env.LLM_MODEL = "generic/model";
    expect(llm.compatHeaders().Authorization).toBe("Bearer generic-key");
    expect(llm.compatModel()).toBe("generic/model");
  });
});

describe("chatJSON over the OpenAI-compatible tier", () => {
  test("sends the request to LLM_BASE_URL with LLM_MODEL and the bearer key", async () => {
    const llm = await load();
    process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_API_KEY = "gsk_test";
    process.env.LLM_MODEL = "llama-3.3-70b-versatile";
    stubFetch({ content: 'Sure: {"answer":"from groq"}' });

    const result = await llm.chatJSON<{ answer: string }>("sys", "user", { maxTokens: 50, priority: "cost-first" });

    expect(result.data.answer).toBe("from groq");
    expect(result.provider).toBe("oss-free");
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(calls[0].headers.Authorization).toBe("Bearer gsk_test");
    expect(calls[0].body.model).toBe("llama-3.3-70b-versatile");
    expect(calls[0].body.max_tokens).toBe(50);
  });

  test("works with only OPENROUTER_API_KEY (the free default)", async () => {
    const llm = await load();
    process.env.OPENROUTER_API_KEY = "or-key";
    stubFetch({ content: '{"answer":"free"}' });

    const result = await llm.chatJSON<{ answer: string }>("sys", "user");

    expect(result.data.answer).toBe("free");
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].body.model).toBe("z-ai/glm-4.5-air:free");
  });

  test("an upstream failure names the host, and no provider at all says how to configure one", async () => {
    const llm = await load();
    process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_MODEL = "m";
    stubFetch({ ok: false, status: 401, text: "invalid key" });
    await expect(llm.chatJSON("sys", "user")).rejects.toThrow("LLM request to api.groq.com failed (401): invalid key");

    delete process.env.LLM_BASE_URL;
    await expect(llm.chatJSON("sys", "user")).rejects.toThrow(/LLM_BASE_URL/);
  });
});

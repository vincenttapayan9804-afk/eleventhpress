/// <reference types="bun-types" />
/**
 * VirusTotal API v3 client (src/lib/virustotal.ts) — mocked fetch, no real
 * network calls. Covers live-mode detection, the small-file direct-upload
 * path, the large-file dedicated-upload-URL path (VirusTotal's 32MB direct
 * cap), and both analysis states (queued vs completed).
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { virustotalLiveMode, submitFileToVirusTotal, getVirusTotalAnalysis } from "@/lib/virustotal";

let fetchCalls: { url: string; init: any }[] = [];
let uploadUrlOverride: string | null = null;

function reset() {
  fetchCalls = [];
  uploadUrlOverride = null;
  delete process.env.VIRUSTOTAL_API_KEY;

  // @ts-expect-error test-only global fetch stub
  globalThis.fetch = mock(async (url: string, init: any) => {
    fetchCalls.push({ url, init });
    if (url.endsWith("/files/upload_url")) {
      return new Response(JSON.stringify({ data: uploadUrlOverride || "https://upload.virustotal.example/special" }), { status: 200 });
    }
    if (url.endsWith("/files") || url.includes("/special")) {
      return new Response(JSON.stringify({ data: { id: "analysis-abc" } }), { status: 200 });
    }
    if (url.includes("/analyses/completed-123")) {
      return new Response(
        JSON.stringify({ data: { attributes: { status: "completed", stats: { malicious: 0, suspicious: 0, harmless: 70, undetected: 5 } } } }),
        { status: 200 }
      );
    }
    if (url.includes("/analyses/queued-456")) {
      return new Response(JSON.stringify({ data: { attributes: { status: "queued" } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
}

beforeEach(reset);

describe("virustotalLiveMode", () => {
  test("false when VIRUSTOTAL_API_KEY is unset", () => {
    expect(virustotalLiveMode()).toBe(false);
  });

  test("true once VIRUSTOTAL_API_KEY is set", () => {
    process.env.VIRUSTOTAL_API_KEY = "key123";
    expect(virustotalLiveMode()).toBe(true);
  });
});

describe("submitFileToVirusTotal", () => {
  beforeEach(() => {
    process.env.VIRUSTOTAL_API_KEY = "key123";
  });

  test("uploads a small file directly to /files and returns the analysis id", async () => {
    const id = await submitFileToVirusTotal(Buffer.from("small file"), "manuscript.pdf");
    expect(id).toBe("analysis-abc");
    expect(fetchCalls.some((c) => c.url.endsWith("/files"))).toBe(true);
    expect(fetchCalls.some((c) => c.url.endsWith("/files/upload_url"))).toBe(false);
  });

  test("requests a dedicated upload URL for a file over the 32MB direct-upload cap", async () => {
    const big = Buffer.alloc(33 * 1024 * 1024);
    const id = await submitFileToVirusTotal(big, "big-manuscript.pdf");
    expect(id).toBe("analysis-abc");
    expect(fetchCalls.some((c) => c.url.endsWith("/files/upload_url"))).toBe(true);
    expect(fetchCalls.some((c) => c.url.includes("/special"))).toBe(true);
  });

  test("throws with the response body on a non-2xx submission response", async () => {
    // @ts-expect-error test-only global fetch stub
    globalThis.fetch = mock(async () => new Response("quota exceeded", { status: 429 }));
    await expect(submitFileToVirusTotal(Buffer.from("x"), "f.pdf")).rejects.toThrow(/429/);
  });
});

describe("getVirusTotalAnalysis", () => {
  beforeEach(() => {
    process.env.VIRUSTOTAL_API_KEY = "key123";
  });

  test("reports queued while VirusTotal hasn't finished scanning", async () => {
    const result = await getVirusTotalAnalysis("queued-456");
    expect(result.status).toBe("queued");
    expect(result.stats).toBeUndefined();
  });

  test("reports completed with stats once scanning finishes", async () => {
    const result = await getVirusTotalAnalysis("completed-123");
    expect(result.status).toBe("completed");
    expect(result.stats?.malicious).toBe(0);
    expect(result.permalink).toContain("completed-123");
  });
});

/// <reference types="bun-types" />
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  isBloggerLiveMode,
  buildAuthUrl,
  publishPost,
  getValidAccessToken,
  refreshAccessToken,
} from "@/lib/blogger";

const originalFetch = globalThis.fetch;
const originalClientId = process.env.GOOGLE_CLIENT_ID;
const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
  else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
});

describe("isBloggerLiveMode", () => {
  test("false when credentials are unset", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isBloggerLiveMode()).toBe(false);
  });

  test("true only when both client id and secret are set", () => {
    process.env.GOOGLE_CLIENT_ID = "client-1";
    process.env.GOOGLE_CLIENT_SECRET = "secret-1";
    expect(isBloggerLiveMode()).toBe(true);

    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isBloggerLiveMode()).toBe(false);
  });
});

describe("buildAuthUrl", () => {
  test("includes the client id, redirect uri, blogger scope, and state", () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    const url = buildAuthUrl("https://example.test/callback", "state-abc");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain(encodeURIComponent("https://example.test/callback"));
    expect(url).toContain(encodeURIComponent("https://www.googleapis.com/auth/blogger"));
    expect(url).toContain("state=state-abc");
    expect(url).toContain("access_type=offline");
  });
});

describe("publishPost", () => {
  test("simulated mode (sim_-prefixed token) makes no network call and returns a labeled result", async () => {
    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      throw new Error("should not be called");
    }) as any;

    const result = await publishPost("sim_access_123", "sim_blog_1", { title: "Hello World", html: "<p>hi</p>" });
    expect(fetchCalled).toBe(false);
    expect(result.simulated).toBe(true);
    expect(result.url).toContain("sim_blog_1");
    expect(result.id).toContain("sim_post_");
  });

  test("real mode posts to the Blogger API and returns the published url/id", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    globalThis.fetch = mock(async (url: string, init: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ url: "https://myblog.blogspot.com/2026/07/hello.html", id: "post-1" }), { status: 200 });
    }) as any;

    const result = await publishPost("real-token", "blog-42", { title: "Hello", html: "<p>content</p>" });
    expect(capturedUrl).toBe("https://www.googleapis.com/blogger/v3/blogs/blog-42/posts");
    expect(capturedBody).toEqual({ title: "Hello", content: "<p>content</p>" });
    expect(result).toEqual({ url: "https://myblog.blogspot.com/2026/07/hello.html", id: "post-1", simulated: false });
  });

  test("throws when the Blogger API responds with a non-OK status", async () => {
    globalThis.fetch = mock(async () => new Response("quota exceeded", { status: 429 })) as any;
    await expect(publishPost("real-token", "blog-42", { title: "x", html: "y" })).rejects.toThrow(/Blogger publish failed/);
  });
});

describe("refreshAccessToken", () => {
  test("posts the refresh_token grant and returns the new access token + expiry", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-1";
    process.env.GOOGLE_CLIENT_SECRET = "secret-1";
    let capturedBody = "";
    globalThis.fetch = mock(async (url: string, init: any) => {
      capturedBody = init.body.toString();
      return new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), { status: 200 });
    }) as any;

    const result = await refreshAccessToken("refresh-abc");
    expect(capturedBody).toContain("grant_type=refresh_token");
    expect(capturedBody).toContain("refresh_token=refresh-abc");
    expect(result.accessToken).toBe("new-token");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("getValidAccessToken", () => {
  test("returns null when no tokens are stored", async () => {
    const onRefresh = mock(async () => {});
    const result = await getValidAccessToken({ bloggerAccessToken: null, bloggerRefreshToken: null, bloggerTokenExpiry: null }, onRefresh);
    expect(result).toBeNull();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("returns the sim token directly without attempting a refresh", async () => {
    const onRefresh = mock(async () => {});
    const result = await getValidAccessToken(
      { bloggerAccessToken: "sim_access_1", bloggerRefreshToken: "sim_refresh_1", bloggerTokenExpiry: new Date(Date.now() - 1000) },
      onRefresh
    );
    expect(result).toBe("sim_access_1");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("returns the existing token when it's not near expiry", async () => {
    const onRefresh = mock(async () => {});
    const result = await getValidAccessToken(
      { bloggerAccessToken: "still-good", bloggerRefreshToken: "refresh-1", bloggerTokenExpiry: new Date(Date.now() + 10 * 60 * 1000) },
      onRefresh
    );
    expect(result).toBe("still-good");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("refreshes and persists via onRefresh when the token is expired", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-1";
    process.env.GOOGLE_CLIENT_SECRET = "secret-1";
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }), { status: 200 })) as any;

    const onRefresh = mock(async (_accessToken: string, _expiresAt: Date) => {});
    const result = await getValidAccessToken(
      { bloggerAccessToken: "stale", bloggerRefreshToken: "refresh-1", bloggerTokenExpiry: new Date(Date.now() - 1000) },
      onRefresh
    );
    expect(result).toBe("refreshed-token");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh.mock.calls[0][0]).toBe("refreshed-token");
  });
});

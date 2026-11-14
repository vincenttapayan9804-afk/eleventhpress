import { describe, expect, mock, test } from "bun:test";
import sharp from "sharp";

// In-memory storage (other test files mock this module too; be explicit).
const store = new Map<string, Buffer>();
mock.module("@/lib/storage", () => ({
  getObject: async (key: string) => store.get(key) ?? null,
  putObject: async (key: string, b: Buffer) => void store.set(key, b),
}));
mock.module("./storage", () => ({
  getObject: async (key: string) => store.get(key) ?? null,
  putObject: async (key: string, b: Buffer) => void store.set(key, b),
}));

describe("logoPngOf: every document gets the organisation's exact uploaded logo", () => {
  test("reads a logo stored as a same-site storage link", async () => {
    const { logoPngOf } = await import("./publisher-identity");
    const logo = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#0f766e" } }).png().toBuffer();
    const key = "brand-assets/test-tenant/logo-1.png";
    store.set(key, logo);
    const png = await logoPngOf(`/api/storage/download?key=${encodeURIComponent(key)}`);
    expect(png).not.toBeNull();
    const meta = await sharp(png!).metadata();
    expect(meta.format).toBe("png");
    // Same artwork: dimensions preserved (never upscaled or cropped).
    expect([meta.width, meta.height]).toEqual([40, 20]);
  });
  test("no logo → null (the renderer then uses the platform mark or tenant initials)", async () => {
    const { logoPngOf } = await import("./publisher-identity");
    expect(await logoPngOf(null)).toBeNull();
    expect(await logoPngOf("not a url")).toBeNull();
  });
});

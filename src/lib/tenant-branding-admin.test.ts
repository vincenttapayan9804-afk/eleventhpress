import { describe, expect, test } from "bun:test";
import { BrandingSchema } from "./tenant-branding-admin";

describe("branding validation", () => {
  test("accepts a full organization profile and normalizes it", () => {
    const r = BrandingSchema.safeParse({
      siteName: "UP Research",
      officialEmail: "Office@UP.edu.ph",
      phone: "+63 2 8981 8500 ext. 123",
      websiteUrl: "up.edu.ph",
      primaryColor: "#7a1f2b",
      socialLinks: { facebook: "facebook.com/upsystem", x: "", bogus: "https://evil.example" },
      logoUrl: "",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.officialEmail).toBe("office@up.edu.ph");
    expect(r.data.websiteUrl).toBe("https://up.edu.ph");
    expect(r.data.socialLinks).toEqual({ facebook: "https://facebook.com/upsystem" });
    expect(r.data.logoUrl).toBeNull();
  });

  test("rejects colours that could break out of the style block", () => {
    expect(BrandingSchema.safeParse({ primaryColor: "red;}body{display:none" }).success).toBe(false);
    expect(BrandingSchema.safeParse({ primaryColor: "</style><script>" }).success).toBe(false);
  });

  test("rejects bad emails, phones and non-http logos", () => {
    expect(BrandingSchema.safeParse({ officialEmail: "nope" }).success).toBe(false);
    expect(BrandingSchema.safeParse({ phone: "call me maybe" }).success).toBe(false);
    expect(BrandingSchema.safeParse({ logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(BrandingSchema.safeParse({ logoUrl: "/api/storage/download?key=brand-assets/x.png" }).success).toBe(true);
  });

  test("blank strings clear fields", () => {
    const r = BrandingSchema.safeParse({ tagline: "  ", address: "" });
    expect(r.success && r.data.tagline === null && r.data.address === null).toBe(true);
  });
});

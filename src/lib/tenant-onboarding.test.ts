import { describe, expect, test } from "bun:test";
import { slugify, generateTemporaryPassword, RESERVED_TENANT_SLUGS, tenantLinks, tenantRootDomain, tenantSubdomain } from "./tenant-onboarding";

describe("tenant onboarding helpers", () => {
  test("slugify makes a clean portal address", () => {
    expect(slugify("University of the Philippines — Diliman")).toBe("university-of-the-philippines-diliman");
    expect(slugify("Ateneo de Manila & Partners")).toBe("ateneo-de-manila-and-partners");
    expect(slugify("Université Côte d'Azur")).toBe("universite-cote-d-azur");
    expect(slugify("!!!")).toBe("institution");
    expect(slugify("x".repeat(80)).length).toBeLessThanOrEqual(50);
  });

  test("temporary passwords are readable and unique", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  test("route words are reserved", () => {
    expect(RESERVED_TENANT_SLUGS.has("exit")).toBe(true);
  });

  test("links point at the tenant's own subdomain", () => {
    const l = tenantLinks("up-diliman");
    expect(l.portalUrl).toBe("https://up-diliman.eleventhpress.com");
    expect(l.loginUrl).toBe("https://up-diliman.eleventhpress.com/?view=login");
  });

  test("subdomains: root domain, reserved names and overrides", () => {
    expect(tenantRootDomain()).toBe("eleventhpress.com");
    expect(tenantSubdomain("up-diliman")).toBe("up-diliman.eleventhpress.com");
    expect(tenantSubdomain("send")).toBeNull();
    expect(tenantSubdomain("www")).toBeNull();
    const prev = process.env.TENANT_ROOT_DOMAIN;
    process.env.TENANT_ROOT_DOMAIN = "*.journals.example.org.";
    try {
      expect(tenantSubdomain("up-diliman")).toBe("up-diliman.journals.example.org");
    } finally {
      if (prev === undefined) delete process.env.TENANT_ROOT_DOMAIN;
      else process.env.TENANT_ROOT_DOMAIN = prev;
    }
  });
});

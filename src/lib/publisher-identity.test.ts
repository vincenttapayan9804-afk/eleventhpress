import { describe, expect, test } from "bun:test";
import { hexOr, publisherIdentityOf, PLATFORM_IDENTITY } from "./publisher-identity";

const RON = {
  id: "t_ron",
  name: "Ron",
  isPlatform: false,
  siteName: "Ron Publishing",
  officialEmail: "office@ron.example",
  supportEmail: "help@ron.example",
  address: "1 Main St",
  websiteUrl: "https://ron.example",
  logoUrl: "https://ron.example/logo.png",
  primaryColor: "#123456",
  accentColor: "oklch(0.7 0.1 80)",
};

describe("publisherIdentityOf", () => {
  test("platform keeps Eleventh Press's identity and ISSN", () => {
    const id = publisherIdentityOf(null, null);
    expect(id.whitelabel).toBe(false);
    expect(id.publisher).toBe("Eleventh Press International Publishing");
    expect(id.issn).toBe("2945-1138");
    expect(id.email).toBe(PLATFORM_IDENTITY.email);
  });

  test("tenant journal with the schema's default publisher names the tenant instead", () => {
    const id = publisherIdentityOf(RON, {
      name: "Ron Journal of Research",
      publisher: "Eleventh Press International Publishing",
      issn: null,
      tenantId: "t_ron",
    });
    expect(id.whitelabel).toBe(true);
    expect(id.publisher).toBe("Ron Publishing");
    expect(id.journalName).toBe("Ron Journal of Research");
    expect(id.shortName).toBe("Ron Publishing");
  });

  test("a tenant never inherits the platform ISSN", () => {
    expect(publisherIdentityOf(RON, { name: "J", publisher: null, issn: null }).issn).toBeNull();
    expect(publisherIdentityOf(RON, { name: "J", publisher: null, issn: "1234-5678" }).issn).toBe("1234-5678");
  });

  test("a tenant's own publisher name is kept", () => {
    expect(publisherIdentityOf(RON, { name: "J", publisher: "Ron University Press" }).publisher).toBe("Ron University Press");
  });

  test("falls back to the tenant name when no display name is set", () => {
    const id = publisherIdentityOf({ ...RON, siteName: null }, null);
    expect(id.publisher).toBe("Ron");
    expect(id.journalName).toBe("Ron");
  });

  test("uses tenant contact details and hex colours only", () => {
    const id = publisherIdentityOf(RON, null);
    expect(id.email).toBe("office@ron.example");
    expect(id.location).toBe("1 Main St");
    expect(id.primaryHex).toBe("#123456");
    // Non-hex colours (oklch) fall back to the default palette for PDFs.
    expect(id.accentHex).toBe("#c9a55c");
  });

  test("platform-flagged tenant row is treated as the platform", () => {
    expect(publisherIdentityOf({ ...RON, isPlatform: true }, null).whitelabel).toBe(false);
  });
});

describe("hexOr", () => {
  test("expands short hex and rejects non-hex", () => {
    expect(hexOr("#abc", "#000000")).toBe("#aabbcc");
    expect(hexOr("red", "#000000")).toBe("#000000");
    expect(hexOr(null, "#111111")).toBe("#111111");
  });
});

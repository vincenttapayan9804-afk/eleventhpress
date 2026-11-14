/// <reference types="bun-types" />
/**
 * Whitelabel completeness: tenant-editable journal details, the fixed
 * "Powered by" credit, and tenant-scoped identifiers (seal references,
 * certificate serials) and galleys.
 */
import { describe, expect, mock, test } from "bun:test";
import { JournalDetailsSchema, journalFormOf } from "./tenant-branding-admin";
import { POWERED_BY_CREDIT, poweredByFor } from "./powered-by";
import { publisherIdentityOf } from "./publisher-identity";
import { sealReferenceFor } from "./article-provenance-record";
import { serialPrefixFor } from "./certificates-server";

// Other test files mock "@/lib/storage" and "@/lib/galley" for the whole
// process, so this file renders galleys with the real galley module (loaded
// under its own specifier) writing into an in-memory store of its own.
const store = new Map<string, Buffer>();
mock.module("@/lib/storage", () => ({
  putObject: async (key: string, data: Buffer) => {
    store.set(key, data);
    return { key, size: data.length, etag: "test" };
  },
  getObject: async (key: string) => store.get(key) ?? null,
}));
const { generateGalleys } = (await import("./galley.ts?real=tenant-full-config" as string)) as typeof import("./galley");
const getObject = async (key: string) => store.get(key) ?? null;

describe("Powered by credit", () => {
  test("is the fixed platform credit, shown for tenants only", () => {
    expect(POWERED_BY_CREDIT).toBe("Powered by Eleventh Press International Publishing™");
    expect(poweredByFor({ whitelabel: true })).toBe(POWERED_BY_CREDIT);
    expect(poweredByFor({ whitelabel: false })).toBeNull();
    expect(poweredByFor(null)).toBeNull();
  });
});

describe("journal & publication details", () => {
  test("normalises ISSNs and clears blank fields", () => {
    const r = JournalDetailsSchema.safeParse({ issn: "1234567x", eissn: " 2345-6789 ", publisher: "", abbreviation: "Ron J. Res." });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.issn).toBe("1234-567X");
    expect(r.data.eissn).toBe("2345-6789");
    expect(r.data.publisher).toBeNull();
    expect(r.data.abbreviation).toBe("Ron J. Res.");
  });

  test("rejects malformed ISSNs", () => {
    expect(JournalDetailsSchema.safeParse({ issn: "12-34" }).success).toBe(false);
    expect(JournalDetailsSchema.safeParse({ eissn: "ABCD-EFGH" }).success).toBe(false);
  });

  test("the schema's platform default publisher reads back as blank", () => {
    const form = journalFormOf({
      name: "Ron Journal",
      abbreviation: null,
      publisher: "Eleventh Press International Publishing™",
      issn: null,
      eissn: null,
      description: null,
      aimsScope: null,
    });
    expect(form?.publisher).toBeNull();
  });

  test("identity carries the tenant's e-ISSN and abbreviation", () => {
    const id = publisherIdentityOf(
      { id: "t", name: "Ron", isPlatform: false },
      { name: "Ron Journal", publisher: null, issn: "1234-5678", eissn: "2345-6789", abbreviation: "Ron J." }
    );
    expect(id.eissn).toBe("2345-6789");
    expect(id.abbreviation).toBe("Ron J.");
    expect(publisherIdentityOf(null, null).eissn).toBeNull();
  });
});

describe("tenant-scoped identifiers", () => {
  test("seal references drop the platform prefix for tenants", () => {
    const at = new Date("2026-03-01T00:00:00Z");
    expect(sealReferenceFor("abcdef1234", at)).toBe("EPIP-PV-2026-ABCDEF12");
    expect(sealReferenceFor("abcdef1234", at, true)).toBe("PV-2026-ABCDEF12");
  });

  test("certificate serial prefixes use the tenant's initials, never EP", () => {
    expect(serialPrefixFor("Ron Publishing")).toBe("RP");
    expect(serialPrefixFor("Acme")).toBe("ACM");
    expect(serialPrefixFor("Eleventh Press")).toBe("CERT");
    expect(serialPrefixFor("日本")).toBe("CERT");
  });
});

describe("galleys", () => {
  const meta = {
    id: "art_wl_test",
    title: "A Tenant Article",
    authors: JSON.stringify([{ name: "A. Author", affiliation: "Ron U" }]),
    abstract: "Abstract.",
    keywords: "a, b",
    discipline: "Education",
    doi: "10.5072/test.1",
    journalName: "Ron Journal of Research",
    issn: "1234-5678",
    volume: 1,
    issue: 1,
    year: 2026,
  };

  test("a tenant's galleys carry its identity and the platform credit, on a single page", async () => {
    const g = await generateGalleys(Buffer.from("# Intro\n\nBody.", "utf-8"), "m.md", {
      ...meta,
      publisher: "Ron Publishing",
      whitelabel: true,
      primaryHex: "#0f766e",
      accentHex: "#f59e0b",
      eissn: "2345-6789",
      abbreviation: "Ron J. Res.",
    });
    const html = (await getObject(g.htmlKey))!.toString("utf-8");
    expect(html).toContain("Ron Publishing");
    expect(html).toContain("e-ISSN 2345-6789");
    expect(html).toContain(POWERED_BY_CREDIT);
    expect(html).not.toContain("2945-1138");
    const jats = (await getObject(g.jatsKey!))!.toString("utf-8");
    expect(jats).toContain("<abbrev-journal-title>Ron J. Res.</abbrev-journal-title>");
    expect(jats).toContain('<issn pub-type="ppub">1234-5678</issn>');
    expect(jats).toContain('<issn pub-type="epub">2345-6789</issn>');
    const pdf = (await getObject(g.pdfKey))!;
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  }, 60_000);

  test("the platform's galleys carry no credit and no longer spill onto an extra page", async () => {
    const g = await generateGalleys(Buffer.from("# Intro\n\nBody.", "utf-8"), "m.md", { ...meta, id: "art_pl_test", journalName: "EPIP", issn: "2945-1138" });
    const html = (await getObject(g.htmlKey))!.toString("utf-8");
    expect(html).not.toContain(POWERED_BY_CREDIT);
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load((await getObject(g.pdfKey))!)).getPageCount()).toBe(1);
  }, 60_000);
});

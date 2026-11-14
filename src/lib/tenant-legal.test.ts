/// <reference types="bun-types" />
/**
 * Legal pages on a whitelabel tenant's site name the tenant as operator /
 * data controller, with its own governing law and contacts.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_CLIENT_BRANDING, legalIdentityOf, type ClientBranding } from "./tenant-branding-context";
import { faqsFor } from "@/components/views/faqs-view";
import { BrandingSchema } from "./tenant-branding-admin";

const RON: ClientBranding = {
  ...DEFAULT_CLIENT_BRANDING,
  isPlatform: false,
  tenantId: "t_ron",
  tenantSlug: "ron",
  tenantName: "Ron",
  siteName: "Ron Publishing",
  officialEmail: "office@ron.example",
  address: "1 Main St, Manila",
  source: "domain",
};

describe("legalIdentityOf", () => {
  test("the official site keeps Eleventh Press's identity", () => {
    const l = legalIdentityOf(DEFAULT_CLIENT_BRANDING);
    expect(l.whitelabel).toBe(false);
    expect(l.legalName).toBe("Eleventh Press International Publishing™");
    expect(l.governingLaw).toBe("the laws of England and Wales");
  });

  test("a tenant is the operator, with its own law and contacts", () => {
    const l = legalIdentityOf({ ...RON, legalName: "Ron Publishing Inc.", legalJurisdiction: "the Republic of the Philippines", privacyEmail: "dpo@ron.example" });
    expect(l.whitelabel).toBe(true);
    expect(l.orgName).toBe("Ron Publishing");
    expect(l.legalName).toBe("Ron Publishing Inc.");
    expect(l.governingLaw).toBe("the laws of the Republic of the Philippines");
    expect(l.privacyEmail).toBe("dpo@ron.example");
    expect(l.contactEmail).toBe("office@ron.example");
    expect(l.location).toBe("1 Main St, Manila");
  });

  test("unset legal fields fall back to the tenant's own name and email, never the platform's", () => {
    const l = legalIdentityOf(RON);
    expect(l.legalName).toBe("Ron Publishing");
    expect(l.governingLaw).toBe("the laws of the place where Ron Publishing is established");
    expect(l.privacyEmail).toBe("office@ron.example");
    expect(JSON.stringify(l)).not.toContain("England");
  });
});

describe("faqsFor", () => {
  test("tenant FAQs never mention Eleventh Press or its inbox", () => {
    const text = JSON.stringify(faqsFor(legalIdentityOf(RON)));
    expect(text).not.toContain("Eleventh Press");
    expect(text).not.toContain("editorial@eleventhpress.org");
    expect(text).toContain("Ron Publishing");
    expect(text).toContain("office@ron.example");
  });

  test("the official site's FAQs are unchanged", () => {
    expect(faqsFor(legalIdentityOf(DEFAULT_CLIENT_BRANDING))[0].q).toContain("Eleventh Press International Publishing™");
  });
});

describe("legal fields validation", () => {
  test("accepts legal details and rejects markup or bad emails", () => {
    expect(BrandingSchema.safeParse({ legalName: "Ron Publishing Inc.", legalJurisdiction: "the State of New York", privacyEmail: "DPO@ron.example" }).success).toBe(true);
    expect(BrandingSchema.safeParse({ legalJurisdiction: "<script>" }).success).toBe(false);
    expect(BrandingSchema.safeParse({ privacyEmail: "nope" }).success).toBe(false);
  });
});

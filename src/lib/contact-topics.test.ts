import { describe, expect, it } from "bun:test";
import { CONTACT_TOPICS, contactReference, contactTopic } from "./contact-topics";

describe("contact topics", () => {
  it("has unique keys and falls back to general", () => {
    const keys = CONTACT_TOPICS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(contactTopic("nope").key).toBe("general");
    expect(contactTopic(undefined).key).toBe("general");
    expect(contactTopic("security").key).toBe("security");
  });

  it("routes data-rights requests to the privacy inbox only", () => {
    expect(CONTACT_TOPICS.filter((t) => t.privacyInbox).map((t) => t.key)).toEqual(["privacy"]);
  });

  it("builds a readable, unambiguous reference", () => {
    const ref = contactReference("security", new Date("2026-11-19T10:00:00Z"), () => 0.5);
    expect(ref).toMatch(/^EP-SEC-261119-[2-9A-HJKMNP-Z]{4}$/);
    expect(contactReference("general")).toMatch(/^EP-GEN-\d{6}-[2-9A-HJKMNP-Z]{4}$/);
  });
});

/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";
import type { ArticleAuthor } from "@/lib/article";

let users: { orcid: string | null; email: string; avatarUrl: string | null }[] = [];

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findMany: mock(async () => users),
    },
  },
}));

const { resolveAuthorAvatars } = await import("@/lib/author-accounts");

function author(overrides: Partial<ArticleAuthor> = {}): ArticleAuthor {
  return { name: "Jane Doe", affiliation: "Some University", email: "jane@example.edu", ...overrides };
}

describe("resolveAuthorAvatars", () => {
  test("returns null for every author when none have orcid or email", async () => {
    const result = await resolveAuthorAvatars([{ name: "No Contact", affiliation: "", email: "" }]);
    expect(result).toEqual([null]);
  });

  test("matches by ORCID first, even when email is also present", async () => {
    users = [{ orcid: "0000-0001", email: "different@example.edu", avatarUrl: "https://cdn/orcid-match.png" }];
    const result = await resolveAuthorAvatars([author({ orcid: "0000-0001", email: "jane@example.edu" })]);
    expect(result).toEqual(["https://cdn/orcid-match.png"]);
  });

  test("falls back to email match when no ORCID match exists", async () => {
    users = [{ orcid: null, email: "jane@example.edu", avatarUrl: "https://cdn/email-match.png" }];
    const result = await resolveAuthorAvatars([author({ orcid: "0000-9999" })]);
    expect(result).toEqual(["https://cdn/email-match.png"]);
  });

  test("returns null (not a crash) for an author with no matching account", async () => {
    users = [{ orcid: null, email: "someone-else@example.edu", avatarUrl: "https://cdn/other.png" }];
    const result = await resolveAuthorAvatars([author()]);
    expect(result).toEqual([null]);
  });

  test("preserves input order across multiple authors, mixed matches", async () => {
    users = [
      { orcid: "0000-0001", email: "a@example.edu", avatarUrl: "https://cdn/a.png" },
      { orcid: null, email: "c@example.edu", avatarUrl: "https://cdn/c.png" },
    ];
    const result = await resolveAuthorAvatars([
      author({ name: "A", orcid: "0000-0001", email: "a@example.edu" }),
      author({ name: "B", orcid: "0000-0002", email: "b@example.edu" }),
      author({ name: "C", email: "c@example.edu" }),
    ]);
    expect(result).toEqual(["https://cdn/a.png", null, "https://cdn/c.png"]);
  });
});

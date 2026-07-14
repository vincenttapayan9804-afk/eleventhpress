/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { canViewUnpublishedArticle } from "@/lib/article-access";

const AUTHOR_ID = "user-author-1";

describe("canViewUnpublishedArticle", () => {
  test("denies an anonymous (no session) viewer", () => {
    expect(canViewUnpublishedArticle(AUTHOR_ID, null)).toBe(false);
  });

  test("denies a logged-in reader who isn't the corresponding author", () => {
    expect(
      canViewUnpublishedArticle(AUTHOR_ID, {
        userId: "someone-else",
        email: "x@x.com",
        role: "READER",
        fullName: "X",
      })
    ).toBe(false);
  });

  test("allows the corresponding author", () => {
    expect(
      canViewUnpublishedArticle(AUTHOR_ID, {
        userId: AUTHOR_ID,
        email: "a@a.com",
        role: "AUTHOR",
        fullName: "A",
      })
    ).toBe(true);
  });

  test("allows SUPER_ADMIN, EDITOR, and ASSOCIATE_EDITOR regardless of authorship", () => {
    for (const role of ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"]) {
      expect(
        canViewUnpublishedArticle(AUTHOR_ID, {
          userId: "staff-1",
          email: "s@s.com",
          role,
          fullName: "S",
        })
      ).toBe(true);
    }
  });

  test("denies a REVIEWER who isn't the corresponding author", () => {
    expect(
      canViewUnpublishedArticle(AUTHOR_ID, {
        userId: "reviewer-1",
        email: "r@r.com",
        role: "REVIEWER",
        fullName: "R",
      })
    ).toBe(false);
  });

  test("denies everyone when the article has no corresponding author on file", () => {
    expect(
      canViewUnpublishedArticle(null, {
        userId: "anyone",
        email: "a@a.com",
        role: "AUTHOR",
        fullName: "A",
      })
    ).toBe(false);
  });
});

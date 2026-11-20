import { describe, expect, test } from "bun:test";
import { prefixTsQuery } from "./pgvector";

describe("prefixTsQuery", () => {
  test("ORs stemmed tokens as prefixes, deduplicated", () => {
    expect(prefixTsQuery(["mangrov", "restor", "mangrov"])).toBe("mangrov:* | restor:*");
  });

  test("drops anything that isn't a plain token, so no tsquery syntax gets through", () => {
    expect(prefixTsQuery(["a", "x'):*|!", "ok", "dé", "flood"])).toBe("ok:* | flood:*");
    expect(prefixTsQuery([])).toBeNull();
    expect(prefixTsQuery(["&", "|"])).toBeNull();
  });
});

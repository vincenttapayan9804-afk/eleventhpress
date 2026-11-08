import { describe, expect, test } from "bun:test";
import { emailDecision, readUnsubscribeToken, unsubscribeToken } from "./notification-prefs";

describe("notification preferences", () => {
  test("email decision follows mode and muted categories", () => {
    expect(emailDecision({ emailMode: "INSTANT", mutedCategories: [] }, "REVIEWS")).toBe("now");
    expect(emailDecision({ emailMode: "DAILY", mutedCategories: [] }, "REVIEWS")).toBe("digest");
    expect(emailDecision({ emailMode: "OFF", mutedCategories: [] }, "REVIEWS")).toBe("none");
    expect(emailDecision({ emailMode: "INSTANT", mutedCategories: ["REVIEWS"] }, "REVIEWS")).toBe("none");
    expect(emailDecision({ emailMode: "INSTANT", mutedCategories: ["REVIEWS"] }, "BILLING")).toBe("now");
  });

  test("unsubscribe tokens round-trip and can't be forged", () => {
    const t = unsubscribeToken("user_1", "REVIEWS");
    expect(readUnsubscribeToken(t)).toEqual({ userId: "user_1", category: "REVIEWS" });
    expect(readUnsubscribeToken(unsubscribeToken("user_1"))).toEqual({ userId: "user_1", category: null });
    const [payload] = t.split(".");
    const forged = `${Buffer.from("user_2.REVIEWS").toString("base64url")}.${t.split(".")[1]}`;
    expect(readUnsubscribeToken(forged)).toBeNull();
    expect(readUnsubscribeToken(`${payload}.x`)).toBeNull();
    expect(readUnsubscribeToken("garbage")).toBeNull();
  });
});

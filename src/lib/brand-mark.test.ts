import { describe, expect, it } from "bun:test";
import { stripTrademark, withTrademark } from "@/lib/brand-mark";

describe("brand trademark", () => {
  it("appends ™ to the full brand name once", () => {
    expect(withTrademark("Eleventh Press International Publishing")).toBe("Eleventh Press International Publishing™");
    expect(withTrademark("Eleventh Press International Publishing™")).toBe("Eleventh Press International Publishing™");
    expect(withTrademark("© Eleventh Press International Publishing. All rights")).toBe("© Eleventh Press International Publishing™. All rights");
  });
  it("leaves other names and empty values alone", () => {
    expect(withTrademark("UP Research")).toBe("UP Research");
    expect(withTrademark("Eleventh Press")).toBe("Eleventh Press");
    expect(withTrademark(null)).toBeNull();
  });
  it("strips the mark for comparisons", () => {
    expect(stripTrademark("Eleventh Press International Publishing™")).toBe("Eleventh Press International Publishing");
  });
});

describe("seal ring name", () => {
  it("still shortens the platform name when it carries ™", async () => {
    const { sealRingName } = await import("@/components/verification/verify-ui");
    expect(sealRingName("Eleventh Press International Publishing™")).toBe("ELEVENTH PRESS");
  });
});

import { describe, expect, test } from "bun:test";
import { describeDevice, escapeHtml } from "./account-emails";

describe("account emails", () => {
  test("describeDevice names common browsers and systems", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome on Windows");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge on Windows");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
    expect(describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox on Linux");
    expect(describeDevice(null)).toBe("Unknown device");
  });

  test("escapeHtml neutralises markup in names", () => {
    expect(escapeHtml(`<b>"Ann" & 'Bo'</b>`)).toBe("&lt;b&gt;&quot;Ann&quot; &amp; &#39;Bo&#39;&lt;/b&gt;");
  });
});

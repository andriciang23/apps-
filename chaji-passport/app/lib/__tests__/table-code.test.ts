import { describe, expect, it } from "vitest";
import { makeTableCode, verifyTableCode } from "../table-code";

const SECRET = "test-secret";

describe("table codes", () => {
  it("round-trips", () => {
    const code = makeTableCode("yama-t07", SECRET);
    expect(verifyTableCode(code, SECRET)).toBe("yama-t07");
  });

  it("rejects tampering, other secrets and junk", () => {
    const code = makeTableCode("yama-t07", SECRET);
    expect(verifyTableCode(code.replace("t07", "t08"), SECRET)).toBeNull();
    expect(verifyTableCode(code, "other")).toBeNull();
    for (const junk of [null, "", "yama-t07", ".abc", "yama-t07.", "YAMA.x"]) {
      expect(verifyTableCode(junk, SECRET)).toBeNull();
    }
  });

  it("refuses bad table ids", () => {
    expect(() => makeTableCode("Table 7!", SECRET)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { maskPII, redactPIIFields } from "@/platform/pii/mask";

describe("maskPII", () => {
  it.each([
    ["900-12-3456", "•••••••3456"],
    ["000123456789", "••••••••6789"],
    ["pat@example.com", "•••••••••••.com"],
    ["12345", "•2345"],
  ])("shows only the last 4 characters of %s", (value, expected) => {
    expect(maskPII(value)).toBe(expected);
    expect(maskPII(value)).toHaveLength(value.length);
  });

  it("accepts numbers", () => {
    expect(maskPII(123456789)).toBe("•••••6789");
  });

  it("fully masks values of 4 characters or fewer", () => {
    expect(maskPII("1234")).toBe("••••");
    expect(maskPII("12")).toBe("••");
  });

  it("returns an empty string for empty input", () => {
    expect(maskPII(null)).toBe("");
    expect(maskPII(undefined)).toBe("");
    expect(maskPII("")).toBe("");
  });
});

describe("redactPIIFields", () => {
  it("masks known PII keys deeply and leaves other keys alone", () => {
    expect(redactPIIFields({ ssn: "900-12-3456", items: [{ accountNumber: "000123456789" }], status: "OPEN", count: 3 })).toEqual({
      ssn: "•••••••3456",
      items: [{ accountNumber: "••••••••6789" }],
      status: "OPEN",
      count: 3,
    });
  });
});

import { describe, expect, it } from "vitest";
import { createConfirmationPhrase, createPairCode, isSafeOpenUrl, normalizePairCode, validatePayload } from "../src/protocol";

describe("handoff protocol", () => {
  it("normalizes an eight-character pairing code without ambiguous letters", () => {
    expect(normalizePairCode("ab2c-de3f")).toBe("AB2CDE3F");
    expect(normalizePairCode("ABCDEFGI")).toBeNull();
    expect(normalizePairCode("ABCD123")).toBeNull();
  });

  it("creates safe pairing codes and matching confirmation phrases", () => {
    expect(createPairCode(new Uint8Array(8))).toHaveLength(8);
    expect(createConfirmationPhrase(new Uint8Array([0, 1]))).toBe("あお・あさ");
  });

  it("allows only explicit HTTP(S) open actions", () => {
    expect(isSafeOpenUrl("https://example.com/path")?.host).toBe("example.com");
    expect(isSafeOpenUrl("javascript:alert(1)")).toBeNull();
  });

  it("bounds handoff payloads", () => {
    expect(validatePayload("hello")).toBe("hello");
    expect(validatePayload("")).toBeNull();
    expect(validatePayload("x".repeat(4097))).toBeNull();
  });
});

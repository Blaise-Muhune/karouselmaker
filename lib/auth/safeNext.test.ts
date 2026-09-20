import { describe, expect, it } from "vitest";
import { safeAuthNext } from "./safeNext";

describe("safeAuthNext", () => {
  it("allows the Digilaine continue path", () => {
    expect(safeAuthNext("/from/digilaine/continue")).toBe("/from/digilaine/continue");
    expect(safeAuthNext("/from/digilaine")).toBe("/from/digilaine/continue");
  });

  it("rejects open redirects", () => {
    expect(safeAuthNext("https://evil.example/from/digilaine/continue")).toBeNull();
    expect(safeAuthNext("//evil.example")).toBeNull();
    expect(safeAuthNext("/projects")).toBeNull();
    expect(safeAuthNext("/from/digilaine/continue?next=https://evil.example")).toBe("/from/digilaine/continue");
  });
});

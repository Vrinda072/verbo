import { describe, expect, it } from "vitest";
import { diffParts } from "@/lib/people/nameDiff";

describe("diffParts", () => {
  it("isolates the letter that differs", () => {
    expect(diffParts("Manuel Lopes", "Manuel Lopez")).toEqual({ start: "Manuel Lope", differs: "s", end: "" });
  });
  it("finds a difference in the middle", () => {
    expect(diffParts("Jon Smith", "John Smith")).toEqual({ start: "Jo", differs: "", end: "n Smith" });
    expect(diffParts("John Smith", "Jon Smith")).toEqual({ start: "Jo", differs: "h", end: "n Smith" });
  });
  it("marks nothing for identical names", () => {
    expect(diffParts("Ana", "Ana").differs).toBe("");
  });
});

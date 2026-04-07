import { describe, it, expect } from "vitest";
import { extractTitle, extractIsFullscreen, hasChanged } from "../src/session";

describe("extractTitle", () => {
  it("returns empty string by default (no title set)", () => {
    expect(extractTitle(undefined)).toBe("");
  });

  it("returns the title string when set", () => {
    expect(extractTitle("vim: foo.ts")).toBe("vim: foo.ts");
  });

  it("returns empty string for empty title", () => {
    expect(extractTitle("")).toBe("");
  });
});

describe("extractIsFullscreen", () => {
  it("returns false when active buffer is 'normal'", () => {
    const bufferNamespace = {
      active: { type: "normal" },
    };
    expect(extractIsFullscreen(bufferNamespace)).toBe(false);
  });

  it("returns true when active buffer is 'alternate'", () => {
    const bufferNamespace = {
      active: { type: "alternate" },
    };
    expect(extractIsFullscreen(bufferNamespace)).toBe(true);
  });
});

describe("hasChanged", () => {
  const base = { screen: "hello", title: "", is_fullscreen: false };

  it("returns false when nothing changed", () => {
    expect(hasChanged(base, { screen: "hello", title: "", is_fullscreen: false })).toBe(false);
  });

  it("returns true when screen text changes", () => {
    expect(hasChanged(base, { screen: "world", title: "", is_fullscreen: false })).toBe(true);
  });

  it("returns true when title changes even if screen is the same", () => {
    expect(hasChanged(base, { screen: "hello", title: "vim: foo.ts", is_fullscreen: false })).toBe(true);
  });

  it("returns true when is_fullscreen changes even if screen is the same", () => {
    expect(hasChanged(base, { screen: "hello", title: "", is_fullscreen: true })).toBe(true);
  });
});

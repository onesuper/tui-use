import { describe, it, expect } from "vitest";
import { extractHighlights, Highlight } from "../src/highlights";

// Helper: build a fake xterm IBufferLine from a descriptor array.
// Each element is either:
//   string  → normal character, no inverse
//   { ch: string; inverse: true } → inverse character
function makeLine(cells: Array<string | { ch: string; inverse: true }>) {
  return {
    translateToString: (_trim?: boolean) =>
      cells.map((c) => (typeof c === "string" ? c : c.ch)).join(""),
    getCell: (x: number) => {
      const c = cells[x];
      if (c === undefined) return undefined;
      const ch = typeof c === "string" ? c : c.ch;
      const inv = typeof c === "string" ? 0 : 1;
      return {
        getChars: () => ch,
        isInverse: () => inv,
      };
    },
    length: cells.length,
  };
}

// Helper: build a fake terminal buffer from an array of line descriptors.
function makeBuffer(rows: Array<Array<string | { ch: string; inverse: true }>>) {
  return {
    getLine: (y: number) => (y < rows.length ? makeLine(rows[y]) : undefined),
  };
}

describe("extractHighlights", () => {
  it("returns empty array when no inverse cells exist", () => {
    const buf = makeBuffer([
      [..."  Option A  ".split("")],
      [..."  Option B  ".split("")],
    ]);
    expect(extractHighlights(buf, 2)).toEqual([]);
  });

  it("detects a full-line inverse highlight (vertical menu)", () => {
    // Row 0: "  Option A  " — all chars inverse (selected item)
    // Row 1: "  Option B  " — normal
    const row0 = "  Option A  ".split("").map((ch) => ({ ch, inverse: true as true }));
    const row1 = "  Option B  ".split("");
    const buf = makeBuffer([row0, row1]);

    const result = extractHighlights(buf, 2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      line: 0,
      col_start: 0,
      col_end: 11,
      text: "Option A",
    });
  });

  it("detects an inline inverse fragment (tab bar)", () => {
    // One line: "  Files    [Git]    Search  "
    //           where only "  Git  " chars are inverse
    const line = [
      ..."  Files    ".split(""),
      ...("  Git  ".split("").map((ch) => ({ ch, inverse: true as true }))),
      ..."    Search  ".split(""),
    ];
    const buf = makeBuffer([line]);

    const result = extractHighlights(buf, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 0, text: "Git" });
  });

  it("detects multiple inverse fragments on the same line", () => {
    // E.g. a status bar with two highlighted segments
    const line = [
      ...("  INSERT  ".split("").map((ch) => ({ ch, inverse: true as true }))),
      ..."  main  ".split(""),
      ...("  utf-8  ".split("").map((ch) => ({ ch, inverse: true as true }))),
    ];
    const buf = makeBuffer([line]);

    const result = extractHighlights(buf, 1);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("INSERT");
    expect(result[1].text).toBe("utf-8");
  });

  it("detects highlights on multiple lines", () => {
    // Vertical menu: row 1 is selected
    const row0 = "  Option A  ".split("");
    const row1 = "  Option B  ".split("").map((ch) => ({ ch, inverse: true as true }));
    const row2 = "  Option C  ".split("");
    const buf = makeBuffer([row0, row1, row2]);

    const result = extractHighlights(buf, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 1, text: "Option B" });
  });

  it("strips surrounding spaces from text but preserves col positions", () => {
    // col_start/col_end cover the full inverse span including spaces,
    // but text is trimmed
    const line = [
      ..."abc".split(""),
      ...("  Hi  ".split("").map((ch) => ({ ch, inverse: true as true }))),
      ..."xyz".split(""),
    ];
    const buf = makeBuffer([line]);

    const [h] = extractHighlights(buf, 1);
    expect(h.text).toBe("Hi");
    expect(h.col_start).toBe(3);  // index of first inverse char
    expect(h.col_end).toBe(8);    // index of last inverse char
  });

  it("returns empty array for a line with only whitespace inverse", () => {
    // A line that is entirely spaces but inverse — text would be empty after trim
    const line = "     ".split("").map((ch) => ({ ch, inverse: true as true }));
    const buf = makeBuffer([line]);

    expect(extractHighlights(buf, 1)).toEqual([]);
  });
});

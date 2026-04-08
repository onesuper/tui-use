/**
 * highlights.ts
 *
 * Scans xterm buffer cells for inverse-video (reverse) attributes and
 * returns structured Highlight objects — one per contiguous inverse run
 * per line. This lets AI agents identify selected items in TUI menus,
 * tab bars, dialogs, and status lines without parsing ANSI codes.
 */

export interface Highlight {
  /** Zero-based row index in the rendered screen */
  line: number;
  /** Column index of the first inverse character (inclusive) */
  col_start: number;
  /** Column index of the last inverse character (inclusive) */
  col_end: number;
  /** Trimmed text content of the highlighted span */
  text: string;
}

/** Minimal interface we need from an xterm IBufferCell */
interface Cell {
  getChars(): string;
  isInverse(): number;
}

/** Minimal interface we need from an xterm IBufferLine */
interface BufferLine {
  translateToString(trim?: boolean): string;
  getCell(x: number): Cell | undefined;
  length: number;
}

/** Minimal interface we need from an xterm IBuffer */
interface Buffer {
  getLine(y: number): BufferLine | undefined;
}

/**
 * Extract all highlighted (inverse-video) spans from the terminal buffer.
 *
 * @param buffer     - The active xterm buffer (terminal.buffer.active)
 * @param rows       - Number of rows to scan
 * @param startY     - Starting row offset (viewportY for scrolled views)
 * @returns          - Array of Highlight objects, in top-to-bottom, left-to-right order
 */
export function extractHighlights(buffer: Buffer, rows: number, startY = 0): Highlight[] {
  const highlights: Highlight[] = [];

  for (let y = 0; y < rows; y++) {
    const line = buffer.getLine(startY + y);
    if (!line) continue;

    const rawText = line.translateToString(false);
    const lineLen = rawText.length;

    let spanStart: number | null = null;

    for (let x = 0; x <= lineLen; x++) {
      const cell = x < lineLen ? line.getCell(x) : undefined;
      const inverse = cell ? cell.isInverse() !== 0 : false;

      if (inverse && spanStart === null) {
        // Start of a new inverse span
        spanStart = x;
      } else if (!inverse && spanStart !== null) {
        // End of an inverse span — collect it
        const col_start = spanStart;
        const col_end = x - 1;
        const spanText = rawText.slice(col_start, col_end + 1).trim();

        if (spanText.length > 0) {
          highlights.push({ line: y, col_start, col_end, text: spanText });
        }
        spanStart = null;
      }
    }
  }

  return highlights;
}

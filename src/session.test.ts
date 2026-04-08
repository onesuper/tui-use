import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractTitle, extractIsFullscreen, hasChanged, Session } from "../src/session";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
    expect(extractIsFullscreen(bufferNamespace as any)).toBe(false);
  });

  it("returns true when active buffer is 'alternate'", () => {
    const bufferNamespace = {
      active: { type: "alternate" },
    };
    expect(extractIsFullscreen(bufferNamespace as any)).toBe(true);
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

describe("Session", () => {
  let session: Session;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tui-use-test-"));
    session = new Session("test-session", "echo hello", {
      cwd: tempDir,
      cols: 80,
      rows: 24,
    });
  });

  afterEach(() => {
    try {
      session.kill();
    } catch (e) {
      // ignore if already exited
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe("find", () => {
    it("finds text matching a pattern", async () => {
      // Wait a bit for the session to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const matches = session.find("hello");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].text).toBe("hello");
    });

    it("returns empty array when no match", async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const matches = session.find("xyz123");
      expect(matches).toHaveLength(0);
    });

    it("supports regex patterns", async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const matches = session.find("h.llo");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("rename", () => {
    it("changes the session label", () => {
      expect(session.label).toBe("echo hello");
      session.rename("my-label");
      expect(session.label).toBe("my-label");
    });
  });

  describe("toInfo", () => {
    it("returns session info with correct fields", () => {
      const info = session.toInfo();
      expect(info.session_id).toBe("test-session");
      expect(info.command).toBe("echo hello");
      expect(info.status).toBe("running");
      expect(info.label).toBe("echo hello");
      expect(typeof info.start_time).toBe("number");
    });
  });

  describe("scroll", () => {
    it("returns true for successful scroll", () => {
      // scroll should succeed even with minimal content
      expect(session.scroll(10)).toBe(true);
      expect(session.scroll(-10)).toBe(true);
    });

    it("returns true when scrolling at buffer boundaries", () => {
      // Scrolling beyond buffer bounds should not throw
      expect(session.scroll(1000)).toBe(true);
      expect(session.scroll(-1000)).toBe(true);
    });
  });
});

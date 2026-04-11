# Test: Scroll Terminal Buffer

Test scroll functionality for viewing history in non-fullscreen apps.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Scroll through large output

**Goal:** View content that scrolled off screen.

```bash
tui-use start --cwd /tmp "seq 200"
tui-use wait --text "^200$"
```

Note: `seq 200` outputs 200 lines (more than the 30-row terminal). Use `--text "^200$"` to wait until the last line appears — semantic signal, no timing guesswork.

**Step 1.1** — Capture initial screen (bottom of output):
```bash
tui-use snapshot --format json | jq -r '.screen' | head -3
```
Assert: Shows lines near 200 (e.g. 172, 173, 174...)

**Step 1.2** — Scroll up:
```bash
tui-use scrollup 20
tui-use snapshot --format json | jq -r '.screen' | head -3
```
Assert: Screen shows earlier lines (e.g. 152, 153, 154...)

**Step 1.3** — Scroll back down:
```bash
tui-use scrolldown 20
tui-use snapshot --format json | jq -r '.screen' | head -3
```
Assert: Screen returns to bottom (near 172, 173, 174...)

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 2: Scroll with find combination

**Goal:** Use scroll to find content that was off-screen.

```bash
tui-use start --cwd /tmp "seq 200"
tui-use wait --text "^200$"
```

**Step 2.1** — Confirm viewport is near 200 (single-digit lines not visible):
```bash
tui-use find "^[1-9]$"
```
Assert: Returns no matches (lines 1-9 are scrolled off the top)

**Step 2.2** — Scroll up and search for early content:
```bash
tui-use scrollup 170
tui-use find "^[1-9]$"
```
Assert: Now finds single-digit lines (1-9) that were previously off-screen

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 3: Scroll limits

**Goal:** Handle scroll at buffer boundaries gracefully.

```bash
tui-use start echo "line1"; sleep 100
tui-use wait
```

**Step 3.1** — Scroll up with minimal content:
```bash
tui-use scrollup 100
```
Assert: Command succeeds (returns `ok: true`), no error

**Step 3.2** — Scroll down with minimal content:
```bash
tui-use scrolldown 100
```
Assert: Command succeeds, no error

**Cleanup:**
```bash
tui-use kill
```

---


# Test: Session Management

Test session lifecycle: start, use, info, rename, list, kill.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Basic session lifecycle

**Goal:** Create, identify, and destroy a session.

```bash
tui-use start python3
tui-use wait --text ">>>"
```

**Step 1.1** — Verify info shows correct details:
```bash
tui-use info
```
Assert: Output contains `Command: python3`, `Status: running`, `Size: 120x30`

**Step 1.2** — Rename the session:
```bash
tui-use rename "my-python-session"
tui-use list
```
Assert: `list` shows `my-python-session` as label

**Step 1.3** — Kill and verify cleanup:
```bash
tui-use kill
tui-use list
```
Assert: `list` shows "No active sessions" or session not in list

---

## Scenario 2: Multiple sessions

**Goal:** Manage multiple concurrent sessions.

```bash
SID1=$(tui-use start --label "first" python3)
SID2=$(tui-use start --label "second" python3)
tui-use list
```

**Step 2.1** — Verify both sessions exist:
```bash
tui-use list
```
Assert: `list` shows both "first" and "second" labels

**Step 2.2** — Switch between sessions:
```bash
tui-use use $SID1
tui-use info
```
Assert: `info` shows `Label: first`

```bash
tui-use use $SID2
tui-use info
```
Assert: `info` shows `Label: second`

**Step 2.3** — Cleanup:
```bash
tui-use use $SID1
tui-use kill
tui-use use $SID2
tui-use kill
```
Assert: Both sessions killed

---

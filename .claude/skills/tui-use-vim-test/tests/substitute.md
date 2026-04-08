# Test: vim Substitute

Test global search & replace with :%s.

Before starting: prepare a test file and kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
printf "foo bar\nfoo baz\nfoo qux\n" > /tmp/tui-vim-sub-test.txt
```

---

## Scenario 1: Global substitution

**Goal:** Replace all occurrences of "foo" with "replaced" across the file.

```bash
tui-use start vim /tmp/tui-vim-sub-test.txt
tui-use wait --text "tui-vim-sub-test"
```

**Step 1.1** — Run substitution command:
```bash
tui-use type ":%s/foo/replaced/g"
tui-use press enter
tui-use wait 300
tui-use snapshot --format json | jq -r '.screen'
```
Assert: all three lines now start with "replaced", no "foo" remains on screen

**Step 1.2** — Save and verify:
```bash
tui-use type ":wq"
tui-use press enter
tui-use wait --format json
cat /tmp/tui-vim-sub-test.txt
```
Assert: exit_code is `0`, file contains "replaced bar", "replaced baz", "replaced qux"

**Cleanup:**
```bash
tui-use kill 2>/dev/null || true
rm -f /tmp/tui-vim-sub-test.txt
```

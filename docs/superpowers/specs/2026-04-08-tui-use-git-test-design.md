# Design: tui-use-git-test Skill

**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

A new Claude Code skill `tui-use-git-test` that verifies tui-use can drive real git workflows involving interactive rebase and conflict resolution entirely through the terminal — no external shell file manipulation.

The skill follows the same structure and conventions as the existing `tui-use-vim-test` skill.

---

## Scope

Single test suite for now: `rebase-conflict`. Future git scenarios (merge conflicts, cherry-pick, etc.) can be added as additional test files under `tests/`.

---

## Skill Structure

```
.claude/skills/tui-use-git-test/
├── SKILL.md
└── tests/
    └── rebase-conflict.md
```

### SKILL.md

Entry point for the skill. Describes purpose, usage, and the table of available test suites. Mirrors the format of `tui-use-vim-test/SKILL.md`.

### tests/rebase-conflict.md

Single test spec. Written entirely in English. Uses the same format as `tui-use-vim-test/tests/edit.md`: bash code blocks, Assert comments, and Cleanup sections.

---

## Git Scenario

The setup script constructs a minimal real git repository in `/tmp/tui-git-test-repo/`:

```
Commit A  →  greeting.txt: "hello world"
           /                          \
     main: B                      feature: C
     greeting.txt:                greeting.txt:
     "hello from main"            "hello from feature"
```

- `main` branch: commit B changes line 1 to `"hello from main"`
- `feature` branch: commit C changes line 1 to `"hello from feature"`

Running `git rebase -i main` from `feature` causes a conflict on line 1 of `greeting.txt` when git tries to apply commit C on top of B.

---

## Test Flow

All steps are driven entirely by tui-use. No `sed`, `echo >`, or other shell file edits after the repo is set up.

### Setup
- Kill any stale daemon
- Create fresh git repo in `/tmp/tui-git-test-repo/`
- Set `GIT_EDITOR=vim` and `GIT_SEQUENCE_EDITOR=vim`
- Create commit A, branch to `feature`, create commit C, switch back to `main`, create commit B, switch to `feature`

### Scenario 1: interactive rebase todo

1. `tui-use start git rebase -i main` — vim opens the rebase todo list
2. Wait for vim to show the todo (`pick`)
3. `:wq` to accept the default (no reordering needed)

### Scenario 2: conflict arises

4. `tui-use wait --text "CONFLICT"` — git reports the conflict in the terminal
5. Assert: screen contains `"CONFLICT"` and `"greeting.txt"`

### Scenario 3: resolve conflict in vim

6. `tui-use start vim greeting.txt` — open the conflicted file
7. Wait for vim to show conflict markers (`<<<<<<<`)
8. Use vim to delete conflict markers and keep the desired line (`"hello from feature"`)
   - Navigate to the conflict block
   - Delete lines with `<<<<<<<`, `=======`, `>>>>>>>`
   - Leave only `"hello from feature"`
   - `:wq` to save

### Scenario 4: complete the rebase

9. `tui-use start git add greeting.txt`
10. `tui-use start git rebase --continue` — vim may open for commit message; `:wq` to accept
11. `tui-use wait --text "Successfully rebased"`
12. Assert: exit_code is `0`

### Scenario 5: verify result

13. `cat greeting.txt`
14. Assert: file contains `"hello from feature"`, no conflict markers remain

### Cleanup
- `tui-use kill` if any session still running
- `rm -rf /tmp/tui-git-test-repo/`

---

## Reporting Format

Same as `tui-use-vim-test`:

```
rebase-conflict:
  <scenario>      — PASS / FAIL / PARTIAL
    - <step description>: PASS / FAIL (<reason or actual output>)
```

---

## Key Constraints

- All test specs written in **English**
- No shell file manipulation after setup (conflict resolution must go through vim via tui-use)
- `GIT_EDITOR` and `GIT_SEQUENCE_EDITOR` must be set to `vim` before starting
- Git repo must have `user.email` and `user.name` configured locally to avoid commit failures
- Each scenario builds on the previous — the suite is sequential, not independent

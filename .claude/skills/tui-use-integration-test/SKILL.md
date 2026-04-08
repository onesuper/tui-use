---
name: tui-use-integration-test
description: Use when you need to verify tui-use end-to-end behavior — driving interactive CLI programs, Python REPL, --text pattern matching, custom timeout, special key handling, and highlights detection.
---

# tui-use Integration Tests

Run integration tests to verify tui-use functionality.

## Usage

```
/tui-use-integration-test              # Run all test suites
/tui-use-integration-test <suite>      # Run specific test suite
```

## Available Test Suites

| Suite | Description |
|-------|-------------|
| `session` | Session lifecycle: start, use, info, rename, list, kill |
| `interaction` | User interaction: wait, type, press, paste, REPL |
| `find` | Text search functionality with regex |
| `scroll` | Terminal buffer scrolling |
| `highlights` | Inverse-video highlights detection |

## Running Tests

**Run all tests:**
```
/tui-use-integration-test
```

**Run specific suite:**
```
/tui-use-integration-test session
/tui-use-integration-test interaction
/tui-use-integration-test find
/tui-use-integration-test scroll
/tui-use-integration-test highlights
```

## Test Files

Test specifications are in `tests/` directory:
- `tests/session.md` — Session management tests
- `tests/interaction.md` — Interaction tests
- `tests/find.md` — Find functionality tests
- `tests/scroll.md` — Scroll functionality tests
- `tests/highlights.md` — Highlights detection tests

## Reporting

After running tests, report results as:

```
session:     Scenario 1 — PASS / FAIL
             Scenario 2 — PASS / FAIL

interaction: Scenario 1 — PASS / FAIL
             Scenario 2 — PASS / FAIL
             Scenario 3 — PASS / FAIL
             Scenario 4 — PASS / FAIL
             Scenario 5 — PASS / FAIL

find:        Scenario 1 — PASS / FAIL
             Scenario 2 — PASS / FAIL
             Scenario 3 — PASS / FAIL
             Scenario 4 — PASS / FAIL

scroll:      Scenario 1 — PASS / FAIL
             Scenario 2 — PASS / FAIL
             Scenario 3 — PASS / FAIL

highlights:  Scenario 1 — PASS / FAIL
             Scenario 2 — PASS / FAIL
             Scenario 3 — PASS / FAIL
```

If any test fails, include the actual `screen` and `highlights` values and what was expected.

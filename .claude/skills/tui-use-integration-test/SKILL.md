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


Test specifications are in `tests/` directory

## Reporting

After running tests, report results as:

```
<suite>:
  <scenario 1>      — PARTIAL
    - Initial screen capture: PASS
    - scroll command executes: PASS
    - Less pager scrolling with 'space': FAIL

  <scenario 2>     — PASS
    - Find A words: PASS
    - Find B words: FAIL (<Fail reason or notes>)

```

If any test fails, include the actual `screen` and `highlights` values and what was expected.

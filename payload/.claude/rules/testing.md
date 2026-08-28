# Testing

- **A bug fix starts with a failing test that reproduces it.** No red test, no
  fix. This one is not negotiable.
- **A feature may be written by exploring**, but it does not merge without its
  tests. Freedom during, discipline before merge.
- Test behaviour through the public interface. Never test private methods — a
  test that breaks on a behaviour-preserving refactor is a bad test.
- One concept per test. The name states the case and the expectation.
- No network, no clock, no randomness in unit tests. Inject them.
- Coverage is a smoke detector, not a target. Thresholds live in
  `.claude/thresholds.json`; an uncovered branch is a question, not a number.

# Contributing and project support

## Contributing

Thank you for contributing to OfflineQ.

### Development setup

1. Fork the repository.
2. Clone your fork.
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run the test suite:

   ```bash
   pnpm test
   ```

5. Create a focused branch:

   ```bash
   git checkout -b fix/example-bug
   ```

### Before opening a pull request

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

### Pull requests

- Keep changes focused.
- Add regression tests for bug fixes.
- Add tests for new behavior.
- Update documentation when public behavior changes.
- Add a Changeset for user-facing changes.
- Avoid unrelated refactoring.
- Open large architectural changes as issues first.

### Commit messages

Use Conventional Commits:

```text
feat(core): add retry policy hook
fix(indexeddb): recover stale sending actions
docs: explain at-least-once delivery
test(core): cover Retry-After behavior
```

### Architecture changes

Changes affecting:

- delivery semantics;
- storage contract;
- public package boundaries;
- concurrency model;
- retry semantics;

should include an ADR under `docs/decisions/`.

## Pull request template

`.github/PULL_REQUEST_TEMPLATE.md`

```md
## Description

<!-- What does this PR change and why? Link an issue when applicable. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation
- [ ] Internal/refactor

## Key Changes

-

## Validation

<!-- Exact commands/results. -->

## Delivery Semantics

<!-- Does this change queue ordering, retry behavior, idempotency, persistence, or concurrency? -->

- [ ] No behavior change
- [ ] Behavior change documented below

## Checklist

- [ ] I reviewed the diff and kept it focused.
- [ ] Tests cover the changed behavior.
- [ ] Lint/typecheck/tests/build pass.
- [ ] Documentation is updated when necessary.
- [ ] A Changeset is included when necessary.
- [ ] Architecture changes include an ADR when necessary.
```

## Issue templates

### Bug report

Collect:

```text
OfflineQ version
package(s)
browser/version
framework
reproduction
expected behavior
actual behavior
queue/storage configuration
whether multiple tabs were involved
```

Never request access tokens or private request bodies.

### Feature request

Ask:

```text
problem being solved
current workaround
proposed API
why it belongs in OfflineQ
alternatives considered
```

## CODE_OF_CONDUCT.md

Use a standard community code of conduct, preferably the current Contributor
Covenant.

Do not maintain a custom behavioral policy unless necessary.

## SUPPORT.md

```md
# Support

## Bugs

Use GitHub Issues with the bug report template.

## Questions

Use GitHub Discussions.

## Security

Use the private process described in SECURITY.md.

## Feature Requests

Use the feature request template before opening a large implementation PR.
```

# Versioning and release process

## Versioning

Use Semantic Versioning.

```text
MAJOR → breaking public API behavior
MINOR → backwards-compatible features
PATCH → backwards-compatible fixes
```

Examples:

```text
1.0.1 retry scheduler bugfix
1.1.0 Service Worker adapter
1.2.0 Vue adapter
2.0.0 changed queue persistence contract
```

## Changesets

Use Changesets for user-facing package changes.

Contributor flow:

```bash
pnpm changeset
```

A changeset should explain:

- package affected;
- patch/minor/major;
- user-visible behavior.

Internal changes with no user-facing impact do not require a changeset unless
repository policy says otherwise.

## CHANGELOG.md

Create from day one.

Initial file:

```md
# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning.

## [Unreleased]

### Added

- Initial queue engine.
- IndexedDB storage adapter.
- Fetch transport.
- Retry scheduler.
- React integration.

### Changed

### Fixed

### Security
```

Changesets/release automation may generate release entries, but
`CHANGELOG.md` remains the human-readable project history.

## Release process

```text
PR merged to main
      ↓
Changesets collects changes
      ↓
release PR updates versions/changelog
      ↓
maintainer merges release PR
      ↓
CI publishes npm packages
      ↓
GitHub Release created
```

npm publishing should use trusted publishing/OIDC if supported by the
repository environment rather than long-lived npm tokens.

## Branching

Recommended:

```text
main
```

is always releasable.

Contributors use short-lived branches:

```text
feat/react-adapter
fix/retry-after-parser
docs/delivery-semantics
```

Do not maintain a long-running `develop` branch unless the project later has a
concrete need for it.

## Commit convention

Use Conventional Commits.

Examples:

```text
feat(core): add queue subscriptions
feat(react): add OfflineQueueProvider
fix(indexeddb): recover stale sending actions
fix(fetch): respect Retry-After header
docs: explain browser storage limitations
test(core): cover retry exhaustion
chore: configure changesets
```

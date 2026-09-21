# Contributing

OfflineQ's Phase 2 core API is implemented but is not a stable v1 release. The
processor, IndexedDB, fetch, and React runtimes are not implemented; keep
changes aligned with the canonical contract in [`docs/`](docs/README.md) and
avoid inventing behavior ahead of its implementation phase.

## Development

```bash
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The Phase 2 handoff records 31 passing core unit tests and passing lint,
typecheck, formatting, and build checks. Final integrated validation is
pending; the browser command reports no tests and is not a pass. Do not add
fake tests merely to make a command pass.

## Pull requests

- Keep changes focused.
- Add regression tests for implemented behavior.
- Update documentation when public behavior changes.
- Add a Changeset for user-facing package changes.
- Include an ADR under `docs/decisions/` for delivery, storage, API, retry,
  or concurrency changes.
- Never include credentials, auth headers, or private request bodies.

Use Conventional Commits, for example:

```text
feat(core): add queue subscriptions
fix(indexeddb): recover stale sending actions
docs: explain delivery semantics
```

See [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
for the review checklist.

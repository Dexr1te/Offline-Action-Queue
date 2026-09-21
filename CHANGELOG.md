# Changelog

All notable changes will be documented here. The project follows Semantic
Versioning.

## [Unreleased]

### Added

- **Phase 2 — Core model**:
  - Core action types, schema validation, payload serialization and deep cloning (`cloneJson`).
  - Queue lifecycle operations (`enqueue`, `get`, `list`, `retry`, `cancel`).
  - Reactive snapshots and event emitter (`queued`, `sending`, `retryScheduled`, `delivered`, `failed`, `cancelled`, `processorState`).
  - Storage contract (`QueueStorage`) with lazy initialization, conditional deletion, and fenced coordination interface.
  - In-memory storage adapter for unit and contract testing.
  - Comprehensive unit and contract test suite (31 passing tests).
- **Phase 1 — Repository foundation**:
  - pnpm monorepo structure with `@offlineq/core`, `@offlineq/indexeddb`, `@offlineq/fetch`, and `@offlineq/react`.
  - Strict TypeScript, ESLint, Prettier, Vitest, Playwright, Changesets, and GitHub Actions CI configuration.
  - Architectural documentation, ADRs (0001–0007), and contribution guides.

### Pending / Next Steps

- Phase 3: Processor FIFO delivery loop, retries, failure classification, and crash recovery.
- Phase 4: IndexedDB storage adapter, meta store, and schema migrations.
- Phase 5: Fetch transport, timeouts, `Retry-After`, auth hooks, and idempotency headers.
- Phase 6–10: Offline recovery, cross-tab coordination, React adapter, browser tests, and v1 stabilization.

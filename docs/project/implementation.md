# Implementation order and v1.0 definition of done

## Definition of done for v1.0

v1.0 may be released only when:

### Core

- [ ] `enqueue()` persists before delivery.
- [ ] FIFO processor works.
- [ ] retry policy works.
- [ ] max attempts works.
- [ ] manual retry works.
- [ ] cancellation works.
- [ ] event subscriptions work.
- [ ] interrupted delivery can recover.
- [ ] action IDs/idempotency keys remain stable.

### Persistence

- [ ] IndexedDB adapter passes contract tests.
- [ ] migrations are implemented.
- [ ] reload persistence is verified.
- [ ] browser restart scenario is documented/tested where practical.

### Networking

- [ ] fetch transport works.
- [ ] retryable HTTP errors are classified.
- [ ] `Retry-After` is respected.
- [ ] auth is injectable at send time.
- [ ] idempotency headers are supported.

### Concurrency

- [ ] normal multi-tab processing uses one active processor.
- [ ] processor lease expires after leader loss.
- [ ] another tab can resume processing.

### React

- [ ] provider works.
- [ ] queue state hook works.
- [ ] action inspection works.
- [ ] example app demonstrates offline/reconnect flow.

### Quality

- [ ] strict TypeScript passes.
- [ ] lint passes.
- [ ] unit tests pass.
- [ ] browser tests pass.
- [ ] packages build successfully.
- [ ] npm package exports are validated.

### Documentation

- [ ] README complete.
- [ ] VISION.md complete.
- [ ] ROADMAP.md complete.
- [ ] CHANGELOG.md maintained.
- [ ] CONTRIBUTING.md complete.
- [ ] SECURITY.md complete.
- [ ] CODE_OF_CONDUCT.md present.
- [ ] SUPPORT.md present.
- [ ] architecture documentation complete.
- [ ] delivery semantics documented.
- [ ] browser limitations documented.
- [ ] idempotency documented.

### Release

- [ ] semantic versioning configured.
- [ ] Changesets configured.
- [ ] CI configured.
- [ ] release workflow configured.
- [ ] npm publishing verified.
- [ ] license present.
- [ ] first GitHub Release prepared.

## Suggested implementation order

Do not implement everything simultaneously.

### Phase 1 — Repository foundation

Create:

```text
README.md
VISION.md
ROADMAP.md
CHANGELOG.md
CONTRIBUTING.md
SECURITY.md
CODE_OF_CONDUCT.md
SUPPORT.md
LICENSE
packages/
docs/
.github/
```

Configure:

```text
pnpm
TypeScript
Vitest
ESLint
Prettier
Changesets
GitHub Actions
```

### Phase 2 — Core model

Implement:

```text
types
action schema
events
in-memory storage adapter for testing
queue lifecycle
enqueue/get/list/cancel/retry
```

#### Current checkpoint — Phase 2 implemented

The core package currently contains the Phase 2 action model, storage
contract, queue lifecycle operations, snapshots/events, and in-memory contract
tests. It has no process/delivery loop yet. Storage opens lazily on the first
queue operation; `enqueue()` detaches and validates the request, persists it
before resolving, and emits `queued` only after persistence. Manual retry is
limited to `failed` actions, resets retry metadata and attempts, and preserves
the action ID, idempotency key, and original creation time. Cancellation uses
an atomic conditional delete for `queued`, `retrying`, and `failed` actions.
Snapshots are immutable and detached from observers; refresh currently scans
all stored actions (`O(n)`), which is a Phase 4 performance follow-up.

No runtime processor, IndexedDB adapter, fetch transport, or React adapter is
available yet. The current handoff records 31 passing core unit tests plus
passing lint, typecheck, formatting, and build checks. Final integrated
validation remains pending; the browser command reports no tests and is not a
pass. This is not a v1 release, and the v1 checklist above remains unchecked.

### Phase 3 — Processor

Implement:

```text
FIFO processing
status transitions
retry scheduler
backoff
failure classification
crash recovery model
```

### Phase 4 — IndexedDB

Implement:

```text
database schema
actions store
meta store
migrations
storage adapter
storage contract tests
```

### Phase 5 — Fetch

Implement:

```text
HTTP transport
timeouts
Retry-After
authentication hook
idempotency header
```

### Phase 6 — Offline recovery

Implement:

```text
online/offline wakeups
reload recovery
stale sending recovery
```

### Phase 7 — Cross-tab

Implement:

```text
processor lease
lease renewal
lease takeover
BroadcastChannel notification
```

### Phase 8 — React

Implement:

```text
Provider
useOfflineQueue
useAction
example app
```

### Phase 9 — Browser verification

Implement Playwright flows for:

```text
offline enqueue
reload
reconnect
multiple tabs
leader failover
retry behavior
```

### Phase 10 — v1 stabilization

Freeze public API.

Complete:

```text
documentation
browser compatibility
security review
release workflow
package validation
v1.0 changelog
```

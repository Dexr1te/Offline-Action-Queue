# ADR-0005: Queue binding and fenced storage coordination

## Status

Accepted

This decision amends the storage interface and complements ADR-0004 with
fenced mutation semantics.

## Context

The core API supplies a queue name to `createQueue`, while constructing storage
with `indexedDBStorage()` and no arguments. The database must be named
`offlineq:<queue-name>`, but the documented `QueueStorage.open()` has no binding
argument.

ADR-0004 requires transactional processor lease acquisition and renewal. The
documented storage interface only operates on actions, although leases reside in
the separate `meta` store. Core must remain independent of IndexedDB internals.

Lease acquisition alone also leaves a stale-owner race: an old processor may
receive a transport response after its lease has expired and another processor
has acquired ownership. That response must not overwrite the new owner's state.

## Decision

Add an optional initialization argument and optional coordination capability to
`QueueStorage`. Extend mutation methods with an optional ownership guard. Existing
single-instance adapters can continue implementing the unguarded interface.

```ts
interface StorageContext {
  name: string
}

interface ProcessorLeaseHandle {
  ownerId: string
  token: string
  expiresAt: number
}

interface ProcessorGuard {
  leaseToken: string
}

interface DeleteCondition {
  allowedStatuses: readonly ActionStatus[]
}

interface StorageCoordination {
  acquire(
    ownerId: string,
    durationMs: number,
  ): Promise<ProcessorLeaseHandle | undefined>

  renew(
    lease: ProcessorLeaseHandle,
    durationMs: number,
  ): Promise<ProcessorLeaseHandle | undefined>

  release(lease: ProcessorLeaseHandle): Promise<void>
}

interface QueueStorage {
  open(context?: StorageContext): Promise<void>
  coordination?: StorageCoordination

  // put, get, list, and close retain their documented signatures.
  update(
    id: string,
    updater: (action: QueuedAction) => QueuedAction,
    guard?: ProcessorGuard,
  ): Promise<QueuedAction>

  delete(
    id: string,
    guard?: ProcessorGuard,
    condition?: DeleteCondition,
  ): Promise<void>
}
```

These are additions to the existing interface, not a complete replacement for
its other members.

### Queue binding

- Core calls `storage.open({ name })` before any operation.
- IndexedDB storage requires a name and binds to `offlineq:<name>`.
- Reopening the same adapter with the same name is idempotent. Rebinding one
  adapter instance to a different name rejects as a configuration error.
- The optional argument preserves direct `open()` usage for adapters that do
  not need queue binding, including isolated in-memory test storage.

### Ownership

- Shared storage adapters, including IndexedDB, must expose coordination and
  implement guards. An adapter without it supports only isolated processing;
  it must not claim cross-tab safety.
- Acquisition succeeds only if no unexpired lease exists. Each successful
  acquisition generates a fresh token, including reacquisition by the same
  owner ID.
- Renewal checks the token, owner, and unexpired lease atomically. It preserves
  the token and returns the new expiry; lost ownership returns `undefined`.
- Release checks token and owner atomically. Releasing an obsolete handle is a
  no-op and cannot release a successor's lease.
- Durations must be positive finite values. The storage implementation evaluates
  expiry using its clock inside the transaction, not a timestamp captured before
  waiting for the transaction.
- Guarded mutations verify a matching, unexpired lease token in the same
  transaction as the action mutation. Failed guards reject with a distinguishable
  ownership-loss error and do not mutate the action.
- IndexedDB guarded mutations use one transaction spanning `meta` and `actions`.
  No network operations or asynchronous user callbacks run inside a transaction.
- Core uses guards for processor state transitions, recovery, sending-lease
  renewal, and success deletion. It stops scheduling deliveries when ownership
  is lost and ignores a late transport outcome for persistence purposes.
- Enqueue and user inspection do not require processor ownership. Cancellation
  uses an unguarded delete with allowed statuses `queued`, `retrying`, and
  `failed`. Every adapter checks this condition atomically with deletion;
  a disallowed status rejects with a distinguishable action-state error.
  Reading status and deleting in separate transactions is not sufficient.

### Recovery and signaling

Processor lease renewal must keep an active action's sending lease fresh while
ownership is retained. A successor recovers a `sending` action only after its
sending lease expires, preserving its ID and idempotency key. BroadcastChannel
remains a wake-up hint; periodic acquisition attempts provide progress without it.

The documented startup sequence acquires ownership before recovering actions.
Guarded recovery deliberately uses that order to prevent competing writers.

This does not prevent a request already sent by an expired owner from executing
on the server. At-least-once semantics and server-side idempotency remain required.

## Consequences

- Core depends only on storage contracts, never IndexedDB or BroadcastChannel
  as a durable authority.
- Shared adapters gain explicit responsibilities; silently ignoring a guard is
  not a conforming implementation.
- A fresh ownership token adds persisted metadata, but prevents stale responses
  from corrupting successor state without a second locking mechanism.
- Lease durations, renewal cadence, and polling intervals remain implementation
  choices subject to deterministic tests and browser suspension limitations.
- The storage, concurrency, and core API documentation define the corresponding
  contracts. ADR-0004's architectural decision remains unchanged.

## Required conformance tests

- Queue names isolate storage; rebind attempts reject.
- Concurrent acquisition produces one owner.
- Renewal fails after expiry or takeover, and stale release preserves the new lease.
- Reacquisition by the same owner creates a different token.
- An old owner's guarded update/delete cannot affect successor state.
- Each lease operation is atomic; guard checks and their associated action
  mutation commit or roll back together on transaction failure.
- Cancellation racing a transition to `sending` cannot delete an active action.
- A late successful transport result after takeover cannot delete a retained action.
- Recovery waits for sending-lease expiry and preserves identity.
- Lost BroadcastChannel messages and unavailable BroadcastChannel still permit takeover.
- Contract tests exercise in-memory coordination and real IndexedDB browser behavior.

ADR-0006 resolves the previously adjacent transport timing and pending-count
contract gaps.

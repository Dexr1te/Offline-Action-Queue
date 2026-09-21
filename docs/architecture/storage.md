# Storage and serialization

## Persisted action schema

```ts
export interface QueuedAction<TBody = unknown> {
  id: string

  request: {
    method: "POST" | "PUT" | "PATCH" | "DELETE"
    url: string
    headers?: Record<string, string>
    body?: TBody
  }

  status: ActionStatus

  attempts: number

  createdAt: number
  updatedAt: number

  nextAttemptAt?: number

  sendingLeaseExpiresAt?: number

  idempotencyKey: string

  lastError?: QueueError
}
```

Normalized error:

```ts
export interface QueueError {
  type:
    | "network"
    | "timeout"
    | "http"
    | "serialization"
    | "transport"
    | "unknown"

  message: string

  status?: number

  retryable: boolean

  occurredAt: number
}
```

## Storage

Primary v1.0 storage:

```text
IndexedDB
```

Package:

```text
@offlineq/indexeddb
```

No Zustand/Redux persistence layer is used for durable queue storage.

State managers may subscribe to OfflineQ, but they are not the source of
truth.

### IndexedDB layout

Database:

```text
offlineq:<queue-name>
```

Object stores:

```text
actions
meta
```

#### actions

Key:

```text
id
```

Indexes:

```text
status
createdAt
nextAttemptAt
```

#### meta

Contains:

```text
schema version
processor lease
migration metadata
```

### Storage interface

```ts
export interface StorageContext {
  name: string
}

export interface ProcessorLeaseHandle {
  ownerId: string
  token: string
  expiresAt: number
}

export interface ProcessorGuard {
  leaseToken: string
}

export interface DeleteCondition {
  allowedStatuses: readonly ActionStatus[]
}

export interface StorageCoordination {
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

export interface QueueStorage {
  open(context?: StorageContext): Promise<void>

  coordination?: StorageCoordination

  put(action: QueuedAction): Promise<void>

  get(id: string): Promise<QueuedAction | undefined>

  list(options?: ListActionsOptions): Promise<QueuedAction[]>

  delete(
    id: string,
    guard?: ProcessorGuard,
    condition?: DeleteCondition,
  ): Promise<void>

  update(
    id: string,
    updater: (action: QueuedAction) => QueuedAction,
    guard?: ProcessorGuard,
  ): Promise<QueuedAction>

  close(): Promise<void>
}
```

Core calls `open({ name })`; the IndexedDB adapter binds that name to
`offlineq:<name>`. Reopening with the same name is idempotent, while rebinding
an adapter instance to another name rejects. The optional context preserves
isolated in-memory adapters that do not need queue binding.

Shared adapters must expose `coordination` and enforce lease guards. Lease
acquisition, renewal, and release are atomic. A guarded update or delete checks
the owner, token, and unexpired lease in the same transaction as the action
mutation. A failed guard does not mutate the action. A delete condition is also
checked atomically; cancellation uses allowed statuses `queued`, `retrying`, and
`failed`, so a race with `sending` cannot remove an active action.

Storage adapters must pass the shared adapter contract test suite, including
queue binding, persistence, ordering, conditional deletion, lease expiry,
takeover, stale-token fencing, and migration behavior.

## Serialization

v1.0 built-in serializer:

```text
JSON-compatible values
```

Supported directly:

- objects;
- arrays;
- strings;
- numbers;
- booleans;
- null.

Custom serializers may be registered through an adapter interface.

Large file uploads and resumable binary transfers are not part of v1.0.

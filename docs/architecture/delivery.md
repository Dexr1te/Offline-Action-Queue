# Delivery semantics and processing

## Delivery semantics

OfflineQ provides **at-least-once delivery**.

Example:

```text
Client sends request
        ↓
Server processes request
        ↓
Network connection drops before response
        ↓
Client cannot know whether the server processed it
        ↓
OfflineQ retries
```

Therefore duplicate execution is possible unless the backend supports
idempotency.

OfflineQ must never claim exactly-once delivery.

For operations where duplicate execution matters, the application should
enable an idempotency key and the backend must enforce it.

Example:

```http
POST /api/orders
Idempotency-Key: 0195f77a-...
```

All retries of the same queued action use the same idempotency key.

## Core algorithm

### Enqueue

When the application calls:

```ts
const receipt = await queue.enqueue({
  method: "POST",
  url: "/api/tasks",
  body: {
    title: "Buy milk",
  },
})
```

OfflineQ:

```text
validate action
    ↓
generate action ID
    ↓
generate/preserve idempotency key
    ↓
serialize request
    ↓
write action to durable storage
    ↓
emit "queued"
    ↓
wake processor
    ↓
return receipt
```

`enqueue()` resolves after the action has been successfully persisted.

It does **not** mean the remote server has completed the request.

### Processing

The processor:

```text
wake
 ↓
acquire processor lease
 ↓
load next eligible action
 ↓
mark action as sending
 ↓
send through transport
 ↓
classify result
```

Result:

```text
success
   ↓
delete persisted action
   ↓
emit delivered
```

or:

```text
retryable failure
   ↓
increment attempts
   ↓
calculate nextAttemptAt
   ↓
persist retry state
   ↓
emit retryScheduled
```

or:

```text
permanent failure / max attempts
   ↓
persist failed state
   ↓
emit failed
```

### Queue startup

When the library starts:

```text
queue.start()
   ↓
open storage
   ↓
try to acquire processor lease
   ↓
recover interrupted actions while owner
   ↓
load eligible actions
   ↓
start processing
```

An action left in `sending` because of a page crash must become eligible for
recovery after its sending lease expires.

### Reconnect

Browser connectivity events are hints, not guarantees.

```text
window "online"
     ↓
wake processor
```

OfflineQ must not assume `navigator.onLine === true` means the API is
reachable.

The HTTP result remains authoritative.

## Action state model

Internal persisted statuses:

```ts
export type ActionStatus =
  | "queued"
  | "sending"
  | "retrying"
  | "failed"
```

Lifecycle:

```text
                      retryable error
                     ┌───────────────┐
                     │               ▼
queued ──────────→ sending ─────→ retrying
                     │               │
                     │ success       │ retry time reached
                     ▼               │
                  removed            └────────→ sending


sending ── permanent error ──→ failed

retrying ── max attempts ────→ failed

failed ── manual retry ──────→ queued

queued/retrying/failed ─ cancel ─→ removed
```

A successfully delivered action is deleted from the active queue.

v1.0 does not maintain permanent delivery history.

Applications that need history can subscribe to delivery events and store it
themselves.

## Ordering

v1.0 uses strict FIFO processing by default. The processor considers pending
`queued` and `retrying` actions in order and does not skip the first action
because a newer action is ready.

Actions are ordered by:

```text
createdAt ASC
id ASC
```

Only one action is actively delivered by the default processor at a time.

This prevents unexpected reordering of dependent user actions.

If the first pending action is `retrying` and its `nextAttemptAt` is in the
future, newer `queued` or `retrying` actions wait. Retained `failed` actions do
not block delivery. Manual retry preserves the action's original `createdAt`,
so it returns to its original FIFO position, and `process()` does not bypass a
future `nextAttemptAt`. An existing unexpired `sending` action is not taken
over until its sending lease expires.

Configurable parallel delivery is deferred until after v1.0.

## Retry policy

Default retryable cases:

```text
network failure
request timeout
HTTP 408
HTTP 425
HTTP 429
HTTP 500
HTTP 502
HTTP 503
HTTP 504
```

Default non-retryable cases:

```text
HTTP 400
HTTP 401
HTTP 403
HTTP 404
HTTP 409
HTTP 422
other permanent 4xx responses
```

Applications may override the classifier.

Example:

```ts
createQueue({
  retry: {
    maxAttempts: 5,

    shouldRetry(context) {
      if (context.response?.status === 409) {
        return false
      }

      return context.defaultDecision
    },
  },
})
```

### Backoff

Default:

```text
base delay: 1 second
maximum delay: 30 seconds
max attempts: 5
jitter: full
```

Conceptually:

```text
attempt 1 → ~1s
attempt 2 → ~2s
attempt 3 → ~4s
attempt 4 → ~8s
attempt 5 → ~16s
```

The exact delay is jittered.

If the server sends a valid `Retry-After` header, OfflineQ should respect it
within configured maximum limits. The fetch adapter exposes a parsed optional
`retryAfterMs` duration on a failed transport result. For retryable failures,
core schedules the larger of the jittered exponential backoff and that duration,
then caps the result at `maxDelayMs`:

```text
delay = min(maxDelayMs, max(jitteredBackoffMs, retryAfterMs ?? 0))
nextAttemptAt = now + delay
```

Delay-seconds and HTTP-date values are accepted; invalid values are ignored,
and a past HTTP date produces zero. A timing hint never makes a permanent
failure retryable, and the persisted `nextAttemptAt` survives reload.

## Core invariants

The following invariants should be documented and heavily tested.

### Invariant 1

`enqueue()` succeeds only after durable persistence succeeds.

### Invariant 2

An existing queued action is not deleted until delivery is confirmed
successful or the application explicitly cancels it.

### Invariant 3

Retries preserve the same action ID and idempotency key.

### Invariant 4

A retryable failure never silently becomes success.

### Invariant 5

A permanent failure remains inspectable.

### Invariant 6

An interrupted `sending` action becomes recoverable.

### Invariant 7

Normal multi-tab use should not create multiple simultaneous processors for
the same queue.

### Invariant 8

Authentication secrets are not automatically persisted by OfflineQ.

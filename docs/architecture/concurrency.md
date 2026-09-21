# Cross-tab coordination and crash recovery

## Cross-tab coordination

A browser user may have multiple tabs open.

Without coordination:

```text
Tab A → sends action #1
Tab B → sends action #1
```

v1.0 should prevent normal duplicate queue processing across tabs.

Use:

```text
IndexedDB lease
+
BroadcastChannel wake-up messages
```

Processor lease:

```ts
interface ProcessorLease {
  ownerId: string
  token: string
  expiresAt: number
}
```

Rules:

1. each queue instance generates an `ownerId`;
2. processor tries to acquire the lease transactionally;
3. each successful acquisition gets a fresh fencing `token`;
4. lease is renewed only by the matching unexpired owner and token;
5. only lease owner processes actions;
6. processor mutations verify the matching unexpired token atomically;
7. other tabs may enqueue normally;
8. enqueuing tabs notify the leader using `BroadcastChannel`;
9. if leader disappears, the lease expires;
10. another tab may acquire it and continue;
11. a stale owner cannot release or mutate a successor's lease or actions.

`BroadcastChannel` is an optimization for fast wake-up, not the source of
truth.

IndexedDB remains authoritative.

## Crash recovery

Potential crash:

```text
status = sending
↓
page closes
```

On startup:

1. acquire the processor lease;
2. inspect interrupted `sending` actions;
3. if their sending lease is stale, move them back to `queued` with a lease guard;
4. preserve the original idempotency key;
5. retry normally.

This is another reason the project documents at-least-once delivery.

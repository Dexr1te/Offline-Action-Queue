# Logging and error handling

## Logging

Core logging should be disabled by default.

Optional logger interface:

```ts
export interface QueueLogger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}
```

OfflineQ must never log full request bodies or auth headers by default.

## Error handling philosophy

Internal errors must be normalized.

Library errors should distinguish:

```text
configuration errors
storage errors
serialization errors
transport errors
delivery failures
```

Do not swallow storage failures.

Example:

If IndexedDB cannot persist the action:

```ts
await queue.enqueue(...)
```

must reject.

The library must not pretend the action is safe if persistence failed.

This is a critical invariant.

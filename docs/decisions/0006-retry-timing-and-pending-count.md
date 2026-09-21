# ADR-0006: Transport retry timing and pending counts

## Status

Accepted — implementation pending.

## Context

The delivery specification requires respecting `Retry-After` within configured
limits, but the failed `TransportResult` has no timing field. Core must not read
HTTP headers or depend on fetch internals.

The core subscription example reads `snapshot.pendingCount`, while the declared
`QueueSnapshot` does not contain that property. The React hook also exposes a
pending count without defining whether it includes active sends.

These gaps were explicitly excluded from ADR-0005.

## Decision

### Retry timing

Add one optional field to the failed transport result:

```ts
{
  ok: false
  status?: number
  error: QueueError
  retryAfterMs?: number
}
```

The fetch adapter parses `Retry-After` into a nonnegative finite duration at
response receipt. It accepts nonnegative integer delay-seconds and HTTP-date
values; past dates produce zero. Invalid or unrepresentable values omit the
field. Custom transports may supply the same duration directly.

For retryable failures, core computes:

```text
delay = min(maxDelayMs, max(jitteredBackoffMs, retryAfterMs ?? 0))
nextAttemptAt = currentTime + delay
```

An invalid custom transport duration is ignored. Retry classification and the
maximum-attempt limit take precedence: a retry timing hint does not turn a
permanent failure into a retry. Core persists `nextAttemptAt` so reloads do not
reset the delay. Jitter cannot shorten the server's requested delay except where
the configured maximum deliberately caps it, as already allowed by the delivery
specification.

### Pending counts

Keep the declared core `QueueSnapshot` unchanged. Correct its subscription
example to read `snapshot.queuedCount + snapshot.retryingCount`.

Define React's `pendingCount` as that same sum: actions waiting to be sent,
excluding `sending` and `failed`. Active delivery is represented separately by
`isProcessing`. This matches the core API's existing pending-status filter and
the React example's separate syncing state.

## Consequences

- HTTP parsing remains inside the fetch adapter.
- Existing custom transports need not add the optional field.
- The retry scheduler receives explicit timing data without encoding it in
  error messages or exposing a browser `Response` to core.
- Core does not gain a redundant snapshot field merely to accommodate an
  inconsistent example.
- The transport, delivery, core API, and React API documents define these
  semantics before their implementation milestones are complete.

## Required tests

- Delay-seconds, future dates, past dates, and invalid headers.
- Backoff greater than, less than, and equal to the server delay.
- Configured maximum capping, including zero server delay.
- Invalid custom transport values and non-retryable failures with a hint.
- Persistence of the scheduled timestamp across reload.
- Pending counts through queued, sending, retrying, failed, retried, and
  cancelled transitions.

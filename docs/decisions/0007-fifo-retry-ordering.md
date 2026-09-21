# ADR-0007: FIFO ordering when the head action is retrying

## Status

Accepted — implementation pending

## Context

OfflineQ documents FIFO delivery ordered by `createdAt ASC, id ASC`, with one
active delivery at a time. A retryable head action can remain in `retrying`
until its `nextAttemptAt`, while newer actions may already be queued or
eligible. The processor needs one explicit rule for whether it may skip that
head action.

## Decision

Preserve strict FIFO ordering while a retryable head action waits for its retry
time.

Under this proposal:

- `queued` and `retrying` actions are ordered by `createdAt ASC, id ASC`;
- a future `nextAttemptAt` on the first pending action blocks newer
  `queued` or `retrying` actions;
- retained `failed` actions do not block delivery;
- an existing unexpired `sending` action is not taken over until its sending
  lease expires;
- manual retry preserves the action's original `createdAt`, so it returns to
  its original FIFO position;
- `process()` does not bypass an action whose `nextAttemptAt` has not arrived.

## Alternative

A ready-only scan could deliver newer eligible actions while the head waits.
That improves throughput, but can reorder dependent user actions and weakens
the documented FIFO default.

## Consequences

Strict FIFO gives predictable ordering for dependent mutations, at the cost of
head-of-line blocking during backoff.

## Required implementation tests

Phase 3 completion tests must verify:

- a delayed retrying head blocks newer queued or retrying actions;
- a retained failed action does not block delivery;
- manual retry preserves the action's original FIFO position;
- `process()` respects a future `nextAttemptAt`;
- lease-based recovery follows ADR-0005 before a successor delivers the
  action.

Acceptance of this proposal is a product choice; these tests are required to
complete the implementation after that choice is made.

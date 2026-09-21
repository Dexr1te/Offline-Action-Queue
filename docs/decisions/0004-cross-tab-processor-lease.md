# ADR-0004: Cross-tab processor lease

## Status

Accepted

## Context

Multiple tabs from the same origin may observe the same queue. Without
coordination, two tabs could deliver one action at the same time.

## Decision

Use one active queue processor per queue and origin through an
IndexedDB-backed lease. `BroadcastChannel` is used only for wake-up
signaling.

## Consequences

- lease acquisition and renewal must be transactional;
- each successful acquisition uses a fresh fencing token, and processor
  mutations verify the current owner and token;
- a stale lease must expire so another tab can resume;
- tabs can enqueue without owning the processor lease;
- IndexedDB remains the source of truth when wake-up messages are lost;
- cross-tab coordination does not provide cross-device synchronization.

# Product direction

## Project summary

OfflineQ is a framework-agnostic, durable client-side action queue for web
applications.

It lets frontend applications persist mutating actions locally before
attempting delivery, retry transient failures, recover queued work after
reloads, and automatically resume synchronization when connectivity returns.

The core idea is simple:

```text
persist first
    ↓
attempt delivery
    ↓
classify result
    ↓
success → remove
retryable failure → schedule retry
permanent failure → keep for manual handling
```

The library is intended for applications where user actions should not
disappear just because the network is temporarily unavailable.

Typical use cases:

- task creation and editing;
- comments and messages;
- form submissions;
- field/mobile applications with unstable connectivity;
- PWAs;
- dashboards used over unreliable networks;
- optimistic UI flows;
- any frontend that needs durable request replay.

## Vision

OfflineQ should become a small, dependable infrastructure primitive for
frontend applications.

The project should solve one problem well:

> **A user action that has been accepted into the queue should remain
> recoverable until it is confirmed delivered, explicitly cancelled,
> permanently failed, or the browser itself removes site storage.**

OfflineQ is not intended to become a frontend framework, state manager, API
client, backend synchronization platform, or full local-first database.

### Long-term principles

1. **Framework agnostic core**
   - Core must not depend on React, Zustand, Redux, Vue, or other UI/state frameworks.

2. **Durability before delivery**
   - `enqueue()` persists an action before network delivery begins.

3. **Explicit delivery semantics**
   - OfflineQ provides at-least-once delivery semantics.
   - Exactly-once execution cannot be guaranteed by a browser-only library.
   - Server-side idempotency is required for exactly-once effects.

4. **Small dependency surface**
   - `@offlineq/core`, `@offlineq/indexeddb`, and `@offlineq/fetch` should have zero runtime dependencies where practical.
   - Framework adapters may use peer dependencies.

5. **Predictable behavior**
   - Retry rules, ordering, failure handling, and recovery behavior must be documented.

6. **No hidden magic**
   - The application should always be able to inspect queued and failed actions.

7. **Safe defaults**
   - FIFO processing.
   - Single delivery worker.
   - Conservative retry policy.
   - No persistence of authentication tokens by default.

8. **Extensible through interfaces**
   - Storage, transport, retry classification, authentication injection, logging, and serialization should be replaceable without rewriting the queue engine.

## v1.0 goals

Version 1.0 must provide a stable browser-ready queue with:

- durable local persistence using IndexedDB;
- framework-independent queue engine;
- fetch-based HTTP transport;
- automatic processing when possible;
- recovery after page reload/browser restart;
- exponential retry with jitter;
- `Retry-After` support;
- configurable retry classification;
- persistent failed actions;
- manual retry and cancellation;
- stable action identifiers;
- idempotency-key support;
- automatic recovery of interrupted `sending` actions;
- cross-tab processor coordination;
- queue events/subscriptions;
- React adapter;
- strict TypeScript API;
- browser integration tests;
- documented delivery semantics and limitations;
- changelog and semantic releases.

## Non-goals for v1.0

The following are intentionally excluded from v1.0:

- full local-first database synchronization;
- CRDTs;
- automatic conflict merging;
- server-side queue implementation;
- WebSocket synchronization;
- GraphQL-specific behavior;
- file upload resumability;
- dependency graphs between actions;
- request batching;
- background processing after all pages are closed;
- Service Worker Background Sync integration;
- Vue/Svelte/Solid adapters;
- visual DevTools extension;
- encrypted IndexedDB storage;
- distributed synchronization across devices.

These may be added after v1.0 without changing the core model.

## Project identity

The strongest positioning is:

> **Durable action delivery for the browser.**

Alternative:

> **A persistent offline-first action queue for frontend applications.**

Avoid positioning it as:

> "a better fetch"

because the primary value is not the HTTP wrapper.

The core value is durable delivery lifecycle management.

## Success criteria

OfflineQ is successful if a developer can add reliable offline mutation
handling to an existing frontend without introducing:

- Redux;
- Zustand;
- a custom retry engine;
- a hand-written IndexedDB queue;
- framework lock-in;
- custom multi-tab coordination;
- ad-hoc reload recovery.

The basic experience should remain:

```ts
await queue.enqueue(action)
```

while the difficult reliability behavior remains inside the library.

## Post-v1 ideas

Possible future packages/features:

```text
@offlineq/service-worker
@offlineq/vue
@offlineq/svelte
@offlineq/zustand
@offlineq/devtools
```

Possible engine features:

- dependency chains;
- per-resource queues;
- configurable processor concurrency;
- conflict hooks;
- optimistic update helpers;
- request deduplication;
- batching;
- file/blob serializer;
- resumable uploads;
- encrypted storage adapter;
- delivery history;
- metrics/OpenTelemetry adapter;
- custom queue priority;
- Web Locks adapter;
- background sync integration.

Every future feature should first be evaluated against `VISION.md`.

## v1.0 rule

The project should prefer:

```text
small predictable primitive
```

over:

```text
large magical framework
```

If a feature can be implemented as an adapter rather than a core dependency,
prefer the adapter.

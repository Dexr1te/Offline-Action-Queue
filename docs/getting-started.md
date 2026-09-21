# Getting started

This is the intended v1.0 developer experience.

## Installation

```bash
pnpm add @offlineq/core @offlineq/indexeddb @offlineq/fetch
```

## Setup

```ts
import { createQueue } from "@offlineq/core"
import { indexedDBStorage } from "@offlineq/indexeddb"
import { fetchTransport } from "@offlineq/fetch"

export const offlineQueue = createQueue({
  name: "todo-app",

  storage: indexedDBStorage(),

  transport: fetchTransport({
    credentials: "include",

    idempotency: {
      enabled: true,
    },
  }),

  retry: {
    maxAttempts: 5,
  },
})

await offlineQueue.start()
```

## Use

```ts
await offlineQueue.enqueue({
  method: "POST",
  url: "/api/tasks",

  body: {
    title: "Buy milk",
  },
})
```

That call should remain conceptually simple even though internally OfflineQ
handles:

```text
serialization
persistence
processing
network failure
retry scheduling
reload recovery
cross-tab coordination
idempotency
failure state
events
```

That simplicity is the product.

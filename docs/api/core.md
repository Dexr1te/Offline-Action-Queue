# Core API

## Create a queue

```ts
import { createQueue } from "@offlineq/core"
import { indexedDBStorage } from "@offlineq/indexeddb"
import { fetchTransport } from "@offlineq/fetch"

export const queue = createQueue({
  name: "my-app",

  storage: indexedDBStorage(),

  transport: fetchTransport({
    credentials: "include",
  }),

  retry: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    jitter: "full",
  },
})

await queue.start()
```

## Enqueue

```ts
const receipt = await queue.enqueue({
  method: "POST",
  url: "/api/tasks",
  body: {
    title: "Buy milk",
  },
})

console.log(receipt.id)
```

## Inspect

```ts
const action = await queue.get(receipt.id)

const pending = await queue.list({
  status: ["queued", "retrying"],
})
```

## Manual retry

```ts
await queue.retry(actionId)
```

## Cancel

```ts
await queue.cancel(actionId)
```

## Process immediately

```ts
await queue.process()
```

## Shutdown

```ts
await queue.stop()
```

## Receipt API

```ts
export interface QueueReceipt {
  id: string
  idempotencyKey: string
  persistedAt: number
}
```

Important:

```ts
await queue.enqueue(...)
```

means:

> persisted successfully

not:

> delivered successfully

Applications waiting for delivery should subscribe to an action or event
explicitly.

## Events and subscriptions

```ts
queue.on("queued", callback)
queue.on("sending", callback)
queue.on("retryScheduled", callback)
queue.on("delivered", callback)
queue.on("failed", callback)
queue.on("cancelled", callback)
queue.on("processorState", callback)
```

Generic subscription:

```ts
const unsubscribe = queue.subscribe(snapshot => {
  console.log(snapshot.queuedCount + snapshot.retryingCount)
})
```

The pending count is `queuedCount + retryingCount`; it excludes `sending` and
`failed` actions.

Snapshot:

```ts
export interface QueueSnapshot {
  started: boolean
  processing: boolean

  queuedCount: number
  retryingCount: number
  failedCount: number

  nextRetryAt?: number
}
```

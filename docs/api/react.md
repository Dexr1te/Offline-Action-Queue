# React and Zustand integrations

## React adapter

Package:

```text
@offlineq/react
```

React is a peer dependency.

Core does not depend on React.

### Provider

```tsx
import { OfflineQueueProvider } from "@offlineq/react"
import { queue } from "./offlineQueue"

export function App() {
  return (
    <OfflineQueueProvider queue={queue}>
      <Router />
    </OfflineQueueProvider>
  )
}
```

### Hook

```tsx
const {
  enqueue,
  pendingCount,
  failedCount,
  isProcessing,
  retry,
  cancel,
} = useOfflineQueue()
```

`pendingCount` equals the core snapshot's `queuedCount + retryingCount`. It
excludes actions currently `sending` and actions in `failed`; `isProcessing`
reports active delivery separately.

### Example

```tsx
function CreateTaskButton() {
  const { enqueue } = useOfflineQueue()

  async function createTask() {
    await enqueue({
      method: "POST",
      url: "/api/tasks",
      body: {
        title: "Buy milk",
      },
    })
  }

  return (
    <button onClick={createTask}>
      Create task
    </button>
  )
}
```

### Sync status

```tsx
function SyncStatus() {
  const {
    pendingCount,
    failedCount,
    isProcessing,
  } = useOfflineQueue()

  if (isProcessing) {
    return <span>Syncing…</span>
  }

  if (failedCount > 0) {
    return <span>{failedCount} failed</span>
  }

  if (pendingCount > 0) {
    return <span>{pendingCount} waiting to sync</span>
  }

  return <span>Synced</span>
}
```

React integration should use `useSyncExternalStore`.

No Zustand dependency is required.

## Optional Zustand integration

Zustand is not part of core.

If demand exists after v1.0, a small adapter may be created:

```text
@offlineq/zustand
```

It would expose OfflineQ state to existing Zustand applications while keeping
IndexedDB as the durable source of truth.

This is intentionally not required for v1.0.

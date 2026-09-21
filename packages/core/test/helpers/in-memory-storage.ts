import type {
  ActionStatus,
  DeleteCondition,
  ListActionsOptions,
  ProcessorGuard,
  ProcessorLeaseHandle,
  QueueStorage,
  QueuedAction,
  StorageContext,
  StorageCoordination
} from "../../src/index"
import { OfflineQError, type OfflineQErrorCode } from "../../src/index"
export { action } from "./action"
export type { TestActionInput } from "./action"

const statuses: readonly ActionStatus[] = [
  "queued",
  "sending",
  "retrying",
  "failed"
]

type Lease = ProcessorLeaseHandle

interface Store {
  actions: Map<string, QueuedAction>
  lease?: Lease
}

export interface InMemoryStorageBacking {
  stores: Map<string, Store>
}

export class InMemoryStorageError extends OfflineQError {
  constructor(message: string, code: OfflineQErrorCode = "storage") {
    super(code, message)
    this.name = "InMemoryStorageError"
  }
}

const clone = <T>(value: T): T => structuredClone(value)

const compareActions = (left: QueuedAction, right: QueuedAction): number => {
  if (left.createdAt !== right.createdAt)
    return left.createdAt - right.createdAt
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function"

const assertDuration = (durationMs: number): void => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new InMemoryStorageError(
      "Lease duration must be a positive finite number",
      "configuration"
    )
  }
}

const assertStatus = (status: unknown): asserts status is ActionStatus => {
  if (!statuses.includes(status as ActionStatus)) {
    throw new InMemoryStorageError(
      `Unknown action status: ${String(status)}`,
      "configuration"
    )
  }
}

const storeKey = (name: string | undefined): string => name ?? "<direct>"

/** A tiny clone-on-read/write adapter used by storage and queue contract tests. */
export class InMemoryStorage implements QueueStorage {
  readonly coordination: StorageCoordination

  private readonly backing: InMemoryStorageBacking
  private boundName: string | undefined
  private store: Store | undefined
  private opened = false

  constructor(
    backing: InMemoryStorageBacking = createInMemoryStorageBacking()
  ) {
    this.backing = backing
    this.coordination = {
      acquire: (ownerId, durationMs) => this.acquire(ownerId, durationMs),
      renew: (lease, durationMs) => this.renew(lease, durationMs),
      release: (lease) => this.release(lease)
    }
  }

  async open(context?: StorageContext): Promise<void> {
    const name = context?.name
    if (name !== undefined && name.length === 0) {
      throw new InMemoryStorageError(
        "Queue name must not be empty",
        "configuration"
      )
    }
    if (
      this.boundName !== undefined &&
      name !== undefined &&
      name !== this.boundName
    ) {
      throw new InMemoryStorageError(
        "Storage is already bound to another queue",
        "configuration"
      )
    }
    if (name !== undefined) this.boundName = name
    const key = storeKey(this.boundName)
    this.store = this.backing.stores.get(key) ?? { actions: new Map() }
    this.backing.stores.set(key, this.store)
    this.opened = true
  }

  async close(): Promise<void> {
    this.opened = false
    this.store = undefined
  }

  async put(action: QueuedAction): Promise<void> {
    const store = this.requireStore()
    if (store.actions.has(action.id))
      throw new InMemoryStorageError(`Duplicate action: ${action.id}`)
    store.actions.set(action.id, clone(action))
  }

  async get(id: string): Promise<QueuedAction | undefined> {
    const store = this.requireStore()
    const action = store.actions.get(id)
    return action === undefined ? undefined : clone(action)
  }

  async list(options?: ListActionsOptions): Promise<QueuedAction[]> {
    const store = this.requireStore()
    const statusesFilter = options?.status
    if (statusesFilter !== undefined) {
      if (!Array.isArray(statusesFilter))
        throw new InMemoryStorageError(
          "status must be an array",
          "configuration"
        )
      statusesFilter.forEach(assertStatus)
    }
    const limit = options?.limit
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw new InMemoryStorageError(
        "limit must be a non-negative integer",
        "configuration"
      )
    }
    const allowed =
      statusesFilter === undefined ? undefined : new Set(statusesFilter)
    const actions = [...store.actions.values()]
      .filter((action) => allowed === undefined || allowed.has(action.status))
      .sort(compareActions)
    return clone(limit === undefined ? actions : actions.slice(0, limit))
  }

  async update(
    id: string,
    updater: (action: QueuedAction) => QueuedAction,
    guard?: ProcessorGuard
  ): Promise<QueuedAction> {
    const store = this.requireStore()
    this.checkGuard(store, guard)
    const current = store.actions.get(id)
    if (current === undefined)
      throw new InMemoryStorageError(`Action not found: ${id}`, "not-found")

    const next = updater(clone(current))
    if (isPromiseLike(next))
      throw new InMemoryStorageError(
        "Storage updates must be synchronous",
        "configuration"
      )
    if (next.id !== id)
      throw new InMemoryStorageError(
        "An action id cannot change during update",
        "action-state"
      )

    store.actions.set(id, clone(next))
    return clone(next)
  }

  async delete(
    id: string,
    guard?: ProcessorGuard,
    condition?: DeleteCondition
  ): Promise<void> {
    const store = this.requireStore()
    this.checkGuard(store, guard)
    const current = store.actions.get(id)
    if (current === undefined) return
    if (condition !== undefined) {
      if (!Array.isArray(condition.allowedStatuses)) {
        throw new InMemoryStorageError(
          "allowedStatuses must be an array",
          "configuration"
        )
      }
      condition.allowedStatuses.forEach(assertStatus)
      if (!condition.allowedStatuses.includes(current.status)) {
        throw new InMemoryStorageError(
          `Cannot delete action in ${current.status} state`,
          "action-state"
        )
      }
    }
    store.actions.delete(id)
  }

  private requireStore(): Store {
    if (!this.opened || this.store === undefined) {
      throw new InMemoryStorageError("Storage is not open", "configuration")
    }
    return this.store
  }

  private checkGuard(store: Store, guard: ProcessorGuard | undefined): void {
    if (guard === undefined) return
    const lease = store.lease
    if (
      lease === undefined ||
      lease.token !== guard.leaseToken ||
      lease.expiresAt <= Date.now()
    ) {
      throw new InMemoryStorageError(
        "Processor ownership is no longer active",
        "ownership-lost"
      )
    }
  }

  private async acquire(
    ownerId: string,
    durationMs: number
  ): Promise<ProcessorLeaseHandle | undefined> {
    const store = this.requireStore()
    assertDuration(durationMs)
    const now = Date.now()
    if (store.lease !== undefined && store.lease.expiresAt > now)
      return undefined
    const lease = {
      ownerId,
      token: crypto.randomUUID(),
      expiresAt: now + durationMs
    }
    store.lease = lease
    return clone(lease)
  }

  private async renew(
    lease: ProcessorLeaseHandle,
    durationMs: number
  ): Promise<ProcessorLeaseHandle | undefined> {
    const store = this.requireStore()
    assertDuration(durationMs)
    const current = store.lease
    const now = Date.now()
    if (
      current === undefined ||
      current.ownerId !== lease.ownerId ||
      current.token !== lease.token ||
      current.expiresAt <= now
    ) {
      return undefined
    }
    const renewed = {
      ownerId: current.ownerId,
      token: current.token,
      expiresAt: now + durationMs
    }
    store.lease = renewed
    return clone(renewed)
  }

  private async release(lease: ProcessorLeaseHandle): Promise<void> {
    const store = this.requireStore()
    const current = store.lease
    if (current?.ownerId === lease.ownerId && current.token === lease.token)
      delete store.lease
  }
}

export const createInMemoryStorageBacking = (): InMemoryStorageBacking => ({
  stores: new Map()
})

export const createInMemoryStorage = (
  backing?: InMemoryStorageBacking
): InMemoryStorage => new InMemoryStorage(backing)

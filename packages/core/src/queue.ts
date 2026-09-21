import { OfflineQError } from "./errors"
import type {
  ActionStatus,
  EnqueueAction,
  ListActionsOptions,
  Queue,
  QueueError,
  QueueEventListener,
  QueueEventMap,
  QueueEventName,
  QueueLogger,
  QueueOptions,
  QueueRequest,
  QueueSnapshot,
  QueuedAction,
  RetryOptions,
  RequestMethod
} from "./types"
import type { OfflineQErrorCode } from "./errors"

const DEFAULT_RETRY: Required<
  Pick<RetryOptions, "maxAttempts" | "baseDelayMs" | "maxDelayMs" | "jitter">
> = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: "full"
}

const CANCELABLE_STATUSES: readonly ActionStatus[] = [
  "queued",
  "retrying",
  "failed"
]

const ACTION_STATUSES: readonly ActionStatus[] = [
  "queued",
  "sending",
  "retrying",
  "failed"
]

const own = Object.prototype.hasOwnProperty

function hasOwn(value: object, key: PropertyKey): boolean {
  return own.call(value, key)
}

function isPlainObject(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function serializationError(message: string, cause?: unknown): OfflineQError {
  return new OfflineQError("serialization", message, { cause })
}

function cloneJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw serializationError("JSON body contains a lossy number")
    }
    return Object.is(value, -0) ? 0 : value
  }

  if (typeof value !== "object") {
    throw serializationError("JSON body contains an unsupported value")
  }

  if (seen.has(value)) {
    throw serializationError("JSON body contains a cycle")
  }
  seen.add(value)

  let copy: unknown
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value)
    const length = value.length
    if (
      keys.some(
        (key) =>
          key !== "length" &&
          (typeof key !== "string" ||
            !/^(0|[1-9]\d*)$/.test(key) ||
            Number(key) >= length ||
            !Number.isSafeInteger(Number(key)))
      )
    ) {
      throw serializationError("JSON body contains non-array properties")
    }

    const result: unknown[] = []
    for (let index = 0; index < length; index += 1) {
      if (!hasOwn(value, String(index))) {
        throw serializationError("JSON body contains an undefined array item")
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw serializationError("JSON body contains a non-data array item")
      }
      result.push(cloneJson(descriptor.value, seen))
    }
    copy = result
  } else {
    if (!isPlainObject(value)) {
      throw serializationError("JSON body contains a non-plain object")
    }
    const result: Record<string, unknown> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw serializationError("JSON body contains a symbol property")
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw serializationError("JSON body contains a non-data property")
      }
      Object.defineProperty(result, key, {
        value: cloneJson(descriptor.value, seen),
        enumerable: true,
        configurable: true,
        writable: true
      })
    }
    copy = result
  }

  seen.delete(value)
  return copy
}

function cloneError(error: QueueError): QueueError {
  const copy: QueueError = {
    type: error.type,
    message: error.message,
    retryable: error.retryable,
    occurredAt: error.occurredAt
  }
  if (error.status !== undefined) copy.status = error.status
  return copy
}

function cloneAction<TBody>(action: QueuedAction<TBody>): QueuedAction<TBody> {
  const request: QueueRequest<TBody> = {
    method: action.request.method,
    url: action.request.url
  }
  if (action.request.headers !== undefined) {
    request.headers = { ...action.request.headers }
  }
  if (hasOwn(action.request, "body")) {
    request.body = cloneJson(action.request.body) as TBody
  }

  const copy: QueuedAction<TBody> = {
    id: action.id,
    request,
    status: action.status,
    attempts: action.attempts,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    idempotencyKey: action.idempotencyKey
  }
  if (action.nextAttemptAt !== undefined)
    copy.nextAttemptAt = action.nextAttemptAt
  if (action.sendingLeaseExpiresAt !== undefined) {
    copy.sendingLeaseExpiresAt = action.sendingLeaseExpiresAt
  }
  if (action.lastError !== undefined)
    copy.lastError = cloneError(action.lastError)
  return copy
}

function isOfflineQError(error: unknown): error is OfflineQError {
  return error instanceof OfflineQError
}

const ERROR_CODES: readonly OfflineQErrorCode[] = [
  "configuration",
  "storage",
  "serialization",
  "action-state",
  "not-found",
  "ownership-lost"
]

function errorCode(error: unknown): OfflineQErrorCode | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined
  }
  const code = (error as { code?: unknown }).code
  return typeof code === "string" &&
    ERROR_CODES.includes(code as OfflineQErrorCode)
    ? (code as OfflineQErrorCode)
    : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function asError(
  code: OfflineQErrorCode,
  message: string,
  cause: unknown
): OfflineQError {
  if (isOfflineQError(cause)) return cause
  const knownCode = errorCode(cause)
  if (knownCode !== undefined) {
    return new OfflineQError(knownCode, errorMessage(cause), { cause })
  }
  return new OfflineQError(code, message, { cause })
}

function validateFiniteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new OfflineQError(
      "configuration",
      `${label} must be finite and nonnegative`
    )
  }
}

function validateRetryOptions<TBody>(
  options: RetryOptions<TBody>
): Required<
  Pick<RetryOptions, "maxAttempts" | "baseDelayMs" | "maxDelayMs" | "jitter">
> &
  Pick<RetryOptions<TBody>, "shouldRetry"> {
  const retry = { ...DEFAULT_RETRY, ...options }
  if (!Number.isSafeInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
    throw new OfflineQError(
      "configuration",
      "retry.maxAttempts must be a positive integer"
    )
  }
  validateFiniteNonnegative(retry.baseDelayMs, "retry.baseDelayMs")
  validateFiniteNonnegative(retry.maxDelayMs, "retry.maxDelayMs")
  if (retry.jitter !== "full" && retry.jitter !== "none") {
    throw new OfflineQError(
      "configuration",
      "retry.jitter must be full or none"
    )
  }
  if (
    retry.shouldRetry !== undefined &&
    typeof retry.shouldRetry !== "function"
  ) {
    throw new OfflineQError(
      "configuration",
      "retry.shouldRetry must be a function"
    )
  }
  return retry
}

function validateRequest(action: EnqueueAction): void {
  if (!action || typeof action !== "object") {
    throw new OfflineQError("configuration", "enqueue action must be an object")
  }
  if (
    !Object.values<RequestMethod>(["POST", "PUT", "PATCH", "DELETE"]).includes(
      action.method
    )
  ) {
    throw new OfflineQError(
      "configuration",
      "enqueue action has an invalid method"
    )
  }
  if (typeof action.url !== "string" || action.url.length === 0) {
    throw new OfflineQError(
      "configuration",
      "enqueue action URL must be a non-empty string"
    )
  }
  if (action.headers !== undefined) {
    if (!isPlainObject(action.headers)) {
      throw new OfflineQError(
        "configuration",
        "request headers must be a plain object"
      )
    }
    for (const key of Reflect.ownKeys(action.headers)) {
      if (typeof key !== "string") {
        throw new OfflineQError(
          "configuration",
          "request headers cannot contain symbols"
        )
      }
      const descriptor = Object.getOwnPropertyDescriptor(action.headers, key)
      if (
        !descriptor?.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      ) {
        throw new OfflineQError(
          "configuration",
          "request headers must contain strings"
        )
      }
    }
  }
  if (
    action.idempotencyKey !== undefined &&
    (typeof action.idempotencyKey !== "string" ||
      action.idempotencyKey.length === 0)
  ) {
    throw new OfflineQError(
      "configuration",
      "idempotencyKey must be a non-empty string"
    )
  }
}

function cloneEnqueueAction<TBody>(
  action: EnqueueAction<TBody>
): EnqueueAction<TBody> {
  validateRequest(action)
  const copy: EnqueueAction<TBody> = {
    method: action.method,
    url: action.url
  }
  if (action.headers !== undefined) copy.headers = { ...action.headers }
  if (hasOwn(action, "body")) copy.body = cloneJson(action.body) as TBody
  if (action.idempotencyKey !== undefined)
    copy.idempotencyKey = action.idempotencyKey
  return copy
}

function cloneListOptions(
  options: ListActionsOptions | undefined
): ListActionsOptions | undefined {
  if (options === undefined) return undefined
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new OfflineQError("configuration", "list options must be an object")
  }
  if (
    options.limit !== undefined &&
    (!Number.isSafeInteger(options.limit) || options.limit < 0)
  ) {
    throw new OfflineQError(
      "configuration",
      "list.limit must be a nonnegative safe integer"
    )
  }
  let status: readonly ActionStatus[] | undefined
  if (options.status !== undefined) {
    if (!Array.isArray(options.status)) {
      throw new OfflineQError(
        "configuration",
        "list.status must be an array of action statuses"
      )
    }
    for (const item of options.status) {
      if (!ACTION_STATUSES.includes(item as ActionStatus)) {
        throw new OfflineQError(
          "configuration",
          `Unknown action status: ${String(item)}`
        )
      }
    }
    status = [...options.status]
  }
  const copy: ListActionsOptions = {}
  if (status !== undefined) copy.status = status
  if (options.limit !== undefined) copy.limit = options.limit
  return copy
}

function generateUuid(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID()
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"))
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`
  }
  throw new OfflineQError(
    "configuration",
    "Secure UUID generation is unavailable"
  )
}

export function createQueue<TBody = unknown, TResponse = unknown>(
  options: QueueOptions<TBody, TResponse>
): Queue<TBody> {
  if (!options || typeof options !== "object") {
    throw new OfflineQError("configuration", "queue options are required")
  }
  if (typeof options.name !== "string" || options.name.length === 0) {
    throw new OfflineQError(
      "configuration",
      "queue name must be a non-empty string"
    )
  }
  if (!options.storage || typeof options.storage !== "object") {
    throw new OfflineQError("configuration", "queue storage is required")
  }
  for (const method of [
    "open",
    "put",
    "get",
    "list",
    "delete",
    "update",
    "close"
  ] as const) {
    if (typeof options.storage[method] !== "function") {
      throw new OfflineQError(
        "configuration",
        `queue storage.${method} must be a function`
      )
    }
  }
  if (!options.transport || typeof options.transport.send !== "function") {
    throw new OfflineQError("configuration", "queue transport.send is required")
  }
  const storage = options.storage
  const queueName = options.name
  if (
    options.retry !== undefined &&
    (options.retry === null ||
      typeof options.retry !== "object" ||
      Array.isArray(options.retry))
  ) {
    throw new OfflineQError("configuration", "queue retry must be an object")
  }
  validateRetryOptions(options.retry ?? {})
  const logger = options.logger
  if (logger !== undefined) {
    if (!logger || typeof logger !== "object") {
      throw new OfflineQError("configuration", "queue logger must be an object")
    }
    for (const method of ["debug", "info", "warn", "error"] as const) {
      if (typeof logger[method] !== "function") {
        throw new OfflineQError(
          "configuration",
          `queue logger.${method} must be a function`
        )
      }
    }
  }

  let started = false
  let storageOpen = false
  let snapshot: QueueSnapshot = Object.freeze({
    started: false,
    processing: false,
    queuedCount: 0,
    retryingCount: 0,
    failedCount: 0
  })
  let operations: Promise<void> = Promise.resolve()

  const listeners = new Map<
    QueueEventName<TBody>,
    Set<QueueEventListener<unknown>>
  >()
  const snapshotListeners = new Set<QueueEventListener<QueueSnapshot>>()

  function log(
    method: keyof QueueLogger,
    message: string,
    context?: unknown
  ): void {
    if (!logger) return
    try {
      Promise.resolve(logger[method](message, context)).catch(() => {
        // Logger failures cannot change queue semantics.
      })
    } catch {
      // Logging cannot change queue semantics.
    }
  }

  function invoke<T>(listener: QueueEventListener<T>, value: T): void {
    try {
      Promise.resolve(listener(value)).catch((error) => {
        log("error", "Queue listener rejected", error)
      })
    } catch (error) {
      log("error", "Queue listener threw", error)
    }
  }

  function emit<K extends QueueEventName<TBody>>(
    event: K,
    value: QueueEventMap<TBody>[K]
  ): void {
    const eventListeners = listeners.get(event)
    if (!eventListeners) return
    for (const listener of [...eventListeners]) {
      const payload =
        event === "processorState"
          ? Object.freeze({ ...(value as QueueSnapshot) })
          : event === "cancelled"
            ? { ...(value as { id: string }) }
            : cloneAction(value as QueuedAction<TBody>)
      invoke(listener, payload)
    }
  }

  function notifySnapshot(next: QueueSnapshot): void {
    const changed =
      next.started !== snapshot.started ||
      next.processing !== snapshot.processing ||
      next.queuedCount !== snapshot.queuedCount ||
      next.retryingCount !== snapshot.retryingCount ||
      next.failedCount !== snapshot.failedCount ||
      next.nextRetryAt !== snapshot.nextRetryAt
    if (!changed) return
    snapshot = Object.freeze(next)
    for (const listener of [...snapshotListeners]) {
      invoke(listener, Object.freeze({ ...snapshot }))
    }
    emit("processorState", snapshot)
  }

  async function ensureOpen(): Promise<void> {
    if (storageOpen) return
    try {
      await storage.open({ name: queueName })
      storageOpen = true
    } catch (error) {
      storageOpen = false
      throw asError("storage", "Unable to open queue storage", error)
    }
  }

  async function refreshSnapshot(): Promise<void> {
    // ponytail: O(n) snapshot scan is enough for Phase 2; use IndexedDB counts at Phase 4.
    const actions = await storage.list({
      status: ["queued", "retrying", "failed"]
    })
    let queuedCount = 0
    let retryingCount = 0
    let failedCount = 0
    let nextRetryAt: number | undefined
    for (const action of actions) {
      if (action.status === "queued") queuedCount += 1
      if (action.status === "failed") failedCount += 1
      if (action.status === "retrying") {
        retryingCount += 1
        if (
          action.nextAttemptAt !== undefined &&
          (nextRetryAt === undefined || action.nextAttemptAt < nextRetryAt)
        ) {
          nextRetryAt = action.nextAttemptAt
        }
      }
    }
    const next: QueueSnapshot = {
      started,
      processing: false,
      queuedCount,
      retryingCount,
      failedCount
    }
    if (nextRetryAt !== undefined) next.nextRetryAt = nextRetryAt
    notifySnapshot(next)
  }

  async function refreshSnapshotBestEffort(): Promise<void> {
    try {
      await refreshSnapshot()
    } catch (error) {
      log("warn", "Unable to refresh queue snapshot", error)
    }
  }

  function enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = operations.then(operation, operation)
    operations = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async function closeStorage(): Promise<void> {
    if (!storageOpen) return
    try {
      await storage.close()
      storageOpen = false
    } catch (error) {
      throw asError("storage", "Unable to close queue storage", error)
    }
  }

  const queue: Queue<TBody> = {
    start: () =>
      enqueueOperation(async () => {
        if (started) return
        await ensureOpen()
        started = true
        try {
          await refreshSnapshot()
        } catch (error) {
          started = false
          await refreshSnapshotBestEffort()
          throw asError("storage", "Unable to read queue state", error)
        }
      }),

    stop: () =>
      enqueueOperation(async () => {
        if (!started && !storageOpen) return
        started = false
        notifySnapshot({
          ...snapshot,
          started: false,
          processing: false
        })
        await closeStorage()
      }),

    enqueue: async (action) => {
      const captured = cloneEnqueueAction(action)
      const id = generateUuid()
      const idempotencyKey = captured.idempotencyKey ?? generateUuid()
      const createdAt = Date.now()
      const request: QueueRequest<TBody> = {
        method: captured.method,
        url: captured.url
      }
      if (captured.headers !== undefined)
        request.headers = { ...captured.headers }
      if (hasOwn(captured, "body")) request.body = captured.body as TBody
      const queued: QueuedAction<TBody> = {
        id,
        request,
        status: "queued",
        attempts: 0,
        createdAt,
        updatedAt: createdAt,
        idempotencyKey
      }
      return enqueueOperation(async () => {
        await ensureOpen()
        try {
          await storage.put(cloneAction(queued))
        } catch (error) {
          throw asError("storage", "Unable to persist queued action", error)
        }
        await refreshSnapshotBestEffort()
        emit("queued", queued)
        return {
          id,
          idempotencyKey,
          persistedAt: Date.now()
        }
      })
    },

    get: (id) =>
      enqueueOperation(async () => {
        await ensureOpen()
        let action: QueuedAction<TBody> | undefined
        try {
          action = await storage.get(id)
        } catch (error) {
          throw asError("storage", "Unable to read queued action", error)
        }
        return action === undefined ? undefined : cloneAction(action)
      }),

    list: async (listOptions) => {
      const capturedOptions = cloneListOptions(listOptions)
      return enqueueOperation(async () => {
        await ensureOpen()
        let actions: QueuedAction<TBody>[]
        try {
          actions = await storage.list(capturedOptions)
        } catch (error) {
          throw asError("storage", "Unable to list queued actions", error)
        }
        return actions.map(cloneAction)
      })
    },

    retry: (id) =>
      enqueueOperation(async () => {
        await ensureOpen()
        let retried: QueuedAction<TBody>
        try {
          retried = await storage.update(id, (action) => {
            if (action.status !== "failed") {
              throw new OfflineQError(
                "action-state",
                `Action ${id} cannot be retried from ${action.status} state`
              )
            }
            const retried: QueuedAction<TBody> = {
              ...action,
              status: "queued",
              attempts: 0,
              updatedAt: Date.now()
            }
            delete retried.nextAttemptAt
            delete retried.sendingLeaseExpiresAt
            delete retried.lastError
            return retried
          })
        } catch (error) {
          throw asError("storage", "Unable to retry queued action", error)
        }
        const copy = cloneAction(retried)
        await refreshSnapshotBestEffort()
        emit("queued", copy)
      }),

    cancel: (id) =>
      enqueueOperation(async () => {
        await ensureOpen()
        let existing: QueuedAction<TBody> | undefined
        try {
          existing = await storage.get(id)
        } catch (error) {
          if (errorCode(error) === "not-found") {
            existing = undefined
          } else {
            throw asError(
              "storage",
              "Unable to inspect action for cancellation",
              error
            )
          }
        }
        try {
          await storage.delete(id, undefined, {
            allowedStatuses: CANCELABLE_STATUSES
          })
        } catch (error) {
          if (errorCode(error) === "not-found") return
          throw asError("storage", "Unable to cancel queued action", error)
        }
        if (existing !== undefined) emit("cancelled", { id })
        await refreshSnapshotBestEffort()
      }),

    on: (event, listener) => {
      let eventListeners = listeners.get(event)
      if (!eventListeners) {
        eventListeners = new Set<QueueEventListener<unknown>>()
        listeners.set(event, eventListeners)
      }
      eventListeners.add(listener as QueueEventListener<unknown>)
      return () =>
        eventListeners?.delete(listener as QueueEventListener<unknown>) ?? false
    },

    subscribe: (listener) => {
      snapshotListeners.add(listener)
      invoke(listener, Object.freeze({ ...snapshot }))
      return () => snapshotListeners.delete(listener)
    },

    getSnapshot: () => snapshot
  }

  return queue
}

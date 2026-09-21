export type ActionStatus = "queued" | "sending" | "retrying" | "failed"

export type RequestMethod = "POST" | "PUT" | "PATCH" | "DELETE"

export interface QueueRequest<TBody = unknown> {
  method: RequestMethod
  url: string
  headers?: Record<string, string>
  body?: TBody
}

export interface EnqueueAction<TBody = unknown> extends QueueRequest<TBody> {
  idempotencyKey?: string
}

export interface QueueError {
  type:
    "network" | "timeout" | "http" | "serialization" | "transport" | "unknown"
  message: string
  status?: number
  retryable: boolean
  occurredAt: number
}

export interface QueuedAction<TBody = unknown> {
  id: string
  request: QueueRequest<TBody>
  status: ActionStatus
  attempts: number
  createdAt: number
  updatedAt: number
  nextAttemptAt?: number
  sendingLeaseExpiresAt?: number
  idempotencyKey: string
  lastError?: QueueError
}

export interface ListActionsOptions {
  status?: readonly ActionStatus[]
  limit?: number
}

export interface StorageContext {
  name: string
}

export interface ProcessorLeaseHandle {
  ownerId: string
  token: string
  expiresAt: number
}

export interface ProcessorGuard {
  leaseToken: string
}

export interface DeleteCondition {
  allowedStatuses: readonly ActionStatus[]
}

export interface StorageCoordination {
  acquire(
    ownerId: string,
    durationMs: number
  ): Promise<ProcessorLeaseHandle | undefined>
  renew(
    lease: ProcessorLeaseHandle,
    durationMs: number
  ): Promise<ProcessorLeaseHandle | undefined>
  release(lease: ProcessorLeaseHandle): Promise<void>
}

export interface QueueStorage<TBody = unknown> {
  open(context?: StorageContext): Promise<void>
  coordination?: StorageCoordination
  put(action: QueuedAction<TBody>): Promise<void>
  get(id: string): Promise<QueuedAction<TBody> | undefined>
  list(options?: ListActionsOptions): Promise<QueuedAction<TBody>[]>
  delete(
    id: string,
    guard?: ProcessorGuard,
    condition?: DeleteCondition
  ): Promise<void>
  update(
    id: string,
    updater: (action: QueuedAction<TBody>) => QueuedAction<TBody>,
    guard?: ProcessorGuard
  ): Promise<QueuedAction<TBody>>
  close(): Promise<void>
}

export type TransportResult<TResponse = unknown> =
  | {
      ok: true
      status: number
      response?: TResponse
    }
  | {
      ok: false
      status?: number
      error: QueueError
      retryAfterMs?: number
    }

export interface Transport<TBody = unknown, TResponse = unknown> {
  send(action: QueuedAction<TBody>): Promise<TransportResult<TResponse>>
}

export interface RetryContext<TBody = unknown> {
  action: QueuedAction<TBody>
  error: QueueError
  response?: { status: number }
  status?: number
  attempts: number
  defaultDecision: boolean
}

export interface RetryOptions<TBody = unknown> {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitter?: "full" | "none"
  shouldRetry?: (context: RetryContext<TBody>) => boolean | Promise<boolean>
}

export interface QueueLogger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

export interface QueueOptions<TBody = unknown, TResponse = unknown> {
  name: string
  storage: QueueStorage<TBody>
  transport: Transport<TBody, TResponse>
  retry?: RetryOptions<TBody>
  logger?: QueueLogger
}

export interface QueueReceipt {
  id: string
  idempotencyKey: string
  persistedAt: number
}

export interface QueueSnapshot {
  started: boolean
  processing: boolean
  queuedCount: number
  retryingCount: number
  failedCount: number
  nextRetryAt?: number
}

export interface QueueEventMap<TBody = unknown> {
  queued: QueuedAction<TBody>
  sending: QueuedAction<TBody>
  retryScheduled: QueuedAction<TBody>
  delivered: QueuedAction<TBody>
  failed: QueuedAction<TBody>
  cancelled: { id: string }
  processorState: QueueSnapshot
}

export type QueueEventName<TBody = unknown> = keyof QueueEventMap<TBody>

export type QueueEventListener<T> = (value: T) => void

export interface Queue<TBody = unknown> {
  start(): Promise<void>
  stop(): Promise<void>
  enqueue<T extends TBody = TBody>(
    action: EnqueueAction<T>
  ): Promise<QueueReceipt>
  get(id: string): Promise<QueuedAction<TBody> | undefined>
  list(options?: ListActionsOptions): Promise<QueuedAction<TBody>[]>
  retry(id: string): Promise<void>
  cancel(id: string): Promise<void>
  on<K extends QueueEventName<TBody>>(
    event: K,
    listener: QueueEventListener<QueueEventMap<TBody>[K]>
  ): () => void
  subscribe(listener: QueueEventListener<QueueSnapshot>): () => void
  getSnapshot(): QueueSnapshot
}

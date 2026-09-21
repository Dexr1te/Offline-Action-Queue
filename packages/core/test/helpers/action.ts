import type { ActionStatus, QueuedAction } from "../../src/index"

export interface TestActionInput {
  id?: string
  status?: ActionStatus
  createdAt?: number
  updatedAt?: number
  attempts?: number
  nextAttemptAt?: number
  sendingLeaseExpiresAt?: number
  idempotencyKey?: string
  lastError?: QueuedAction["lastError"]
  body?: unknown
}

export const action = (input: TestActionInput = {}): QueuedAction => {
  const now = Date.now()
  return {
    id: input.id ?? crypto.randomUUID(),
    request: {
      method: "POST",
      url: "/test",
      ...(input.body === undefined ? {} : { body: input.body })
    },
    status: input.status ?? "queued",
    attempts: input.attempts ?? 0,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    ...(input.nextAttemptAt === undefined
      ? {}
      : { nextAttemptAt: input.nextAttemptAt }),
    ...(input.sendingLeaseExpiresAt === undefined
      ? {}
      : { sendingLeaseExpiresAt: input.sendingLeaseExpiresAt }),
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
    ...(input.lastError === undefined ? {} : { lastError: input.lastError })
  }
}

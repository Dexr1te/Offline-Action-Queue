import { afterEach, describe, expect, it, vi } from "vitest"
import { createQueue, type QueuedAction } from "../src/index"
import {
  createInMemoryStorage,
  type InMemoryStorage
} from "./helpers/in-memory-storage"
import { action } from "./helpers/action"

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const errorCode = (error: unknown): unknown =>
  typeof error === "object" && error !== null && "code" in error
    ? (error as { code: unknown }).code
    : typeof error === "object" && error !== null && "type" in error
      ? (error as { type: unknown }).type
      : undefined

const phase2Transport = {
  send: async () => ({ ok: true as const, status: 200 })
}

const openStorage = async (name: string): Promise<InMemoryStorage> => {
  const storage = createInMemoryStorage()
  await storage.open({ name })
  return storage
}

afterEach(() => {
  vi.useRealTimers()
})

describe("Phase 2 queue", () => {
  it("resolves enqueue and emits queued only after persistence commits", async () => {
    const storage = await openStorage("timing")
    const originalPut = storage.put.bind(storage)
    const gate = deferred<void>()
    let putEntered = false
    storage.put = async (item) => {
      putEntered = true
      await gate.promise
      await originalPut(item)
    }
    const queue = createQueue({
      name: "timing",
      storage,
      transport: phase2Transport
    })
    const events: QueuedAction[] = []
    queue.on("queued", (event) => events.push(event))
    let settled = false
    const promise = queue
      .enqueue({
        method: "POST",
        url: "/delayed",
        body: { ok: true }
      })
      .then(
        (receipt) => {
          settled = true
          return receipt
        },
        (error) => {
          settled = true
          throw error
        }
      )
    await vi.waitFor(() => expect(putEntered).toBe(true))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)
    expect(events).toHaveLength(0)
    gate.resolve()
    const receipt = await promise
    expect(receipt.id).toBe(events[0]!.id)
    expect(await storage.get(receipt.id)).toBeDefined()
  })

  it("does not emit queued when persistence rejects", async () => {
    const storage = await openStorage("reject")
    const failure = new Error("disk full")
    storage.put = vi.fn().mockRejectedValue(failure)
    const queue = createQueue({
      name: "reject",
      storage,
      transport: phase2Transport
    })
    const queued = vi.fn()
    queue.on("queued", queued)
    await expect(
      queue.enqueue({ method: "POST", url: "/rejected" })
    ).rejects.toMatchObject({
      code: "storage",
      cause: failure
    })
    expect(queued).not.toHaveBeenCalled()
  })

  it("validates requests before storage and detaches input before an awaited write", async () => {
    const storage = await openStorage("validation")
    const originalPut = storage.put.bind(storage)
    const gate = deferred<void>()
    const put = vi.fn(async (item: QueuedAction) => {
      await gate.promise
      await originalPut(item)
    })
    storage.put = put
    const queue = createQueue({
      name: "validation",
      storage,
      transport: phase2Transport
    })

    await expect(
      queue.enqueue({
        method: "POST",
        url: "/bad",
        body: { unsupported: BigInt(1) }
      })
    ).rejects.toMatchObject({ code: "serialization" })
    expect(put).not.toHaveBeenCalled()

    const request = {
      method: "POST" as const,
      url: "/detach",
      headers: { "X-Test": "before" },
      body: { nested: { value: 1 } },
      idempotencyKey: "caller-key"
    }
    const pending = queue.enqueue(request)
    request.headers["X-Test"] = "after"
    request.body.nested.value = 2
    gate.resolve()
    const receipt = await pending
    const persisted = await storage.get(receipt.id)
    expect(persisted?.request.headers).toEqual({ "X-Test": "before" })
    expect(persisted?.request.body).toEqual({ nested: { value: 1 } })
    expect(persisted?.idempotencyKey).toBe("caller-key")
  })

  it("strictly rejects unsupported or lossy JSON bodies", async () => {
    const storage = await openStorage("json-boundary")
    const queue = createQueue({
      name: "json-boundary",
      storage,
      transport: phase2Transport
    })
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const classValue = new (class Example {
      value = 1
    })()
    const sparse = [] as unknown[]
    sparse.length = 2
    const symbolKey = { value: 1 }
    Object.defineProperty(symbolKey, Symbol("hidden"), {
      value: 2,
      enumerable: true
    })
    const nonEnumerable = { value: 1 }
    Object.defineProperty(nonEnumerable, "hidden", {
      value: 2,
      enumerable: false
    })
    let getterCalled = false
    const accessor = {
      get value() {
        getterCalled = true
        return 1
      }
    }
    const arrayAccessor = [1]
    Object.defineProperty(arrayAccessor, "0", {
      get() {
        getterCalled = true
        return 1
      },
      enumerable: true
    })
    const leadingZeroArray = [1]
    Object.defineProperty(leadingZeroArray, "01", {
      value: 2,
      enumerable: true
    })
    const unsupported: unknown[] = [
      BigInt(1),
      undefined,
      NaN,
      Number.POSITIVE_INFINITY,
      new Date("2020-01-01T00:00:00.000Z"),
      classValue,
      () => 1,
      cyclic,
      sparse,
      arrayAccessor,
      leadingZeroArray,
      symbolKey,
      nonEnumerable,
      accessor,
      { toJSON: () => ({ value: 1 }) }
    ]
    for (const [index, body] of unsupported.entries()) {
      await expect(
        queue.enqueue({ method: "POST", url: `/strict/${index}`, body })
      ).rejects.toMatchObject({
        code: "serialization"
      })
    }
    expect(getterCalled).toBe(false)
  })

  it("preserves an own __proto__ JSON key without mutating Object.prototype", async () => {
    const storage = await openStorage("json-proto")
    const queue = createQueue({
      name: "json-proto",
      storage,
      transport: phase2Transport
    })
    const body = JSON.parse('{"__proto__":{"polluted":true}}') as Record<
      string,
      unknown
    >
    const receipt = await queue.enqueue({ method: "POST", url: "/proto", body })
    const persisted = await storage.get(receipt.id)
    expect(
      Object.prototype.hasOwnProperty.call(persisted?.request.body, "__proto__")
    ).toBe(true)
    expect(
      (persisted?.request.body as { __proto__: { polluted: boolean } })
        .__proto__.polluted
    ).toBe(true)
    expect(
      (Object.prototype as { polluted?: boolean }).polluted
    ).toBeUndefined()
  })

  it("lists actions in FIFO order with status filtering and a limit", async () => {
    const storage = await openStorage("list")
    for (const item of [
      action({ id: "later", createdAt: 20, status: "queued" }),
      action({ id: "same-z", createdAt: 10, status: "retrying" }),
      action({ id: "same-a", createdAt: 10, status: "failed" }),
      action({ id: "sending", createdAt: 10, status: "sending" })
    ]) {
      await storage.put(item)
    }
    const queue = createQueue({
      name: "list",
      storage,
      transport: phase2Transport
    })
    expect((await queue.list()).map((item) => item.id)).toEqual([
      "same-a",
      "same-z",
      "sending",
      "later"
    ])
    expect(
      (await queue.list({ status: ["queued", "retrying"], limit: 1 })).map(
        (item) => item.id
      )
    ).toEqual(["same-z"])
    await expect(queue.list({ limit: -1 })).rejects.toMatchObject({
      code: "configuration"
    })
    await expect(
      queue.list({ status: ["bogus" as "queued"] })
    ).rejects.toMatchObject({
      code: "configuration"
    })

    const realList = storage.list.bind(storage)
    const gate = deferred<void>()
    storage.list = async (options) => {
      await gate.promise
      return realList(options)
    }
    const captured = {
      status: ["queued"] as ("queued" | "retrying")[],
      limit: 1
    }
    const pending = queue.list(captured)
    captured.status[0] = "bogus" as "queued"
    captured.limit = -1
    gate.resolve()
    expect((await pending).map((item) => item.id)).toEqual(["later"])
  })

  it("manually retries only failed actions, preserving identity and clearing retry fields", async () => {
    const storage = await openStorage("retry")
    const failed = action({
      id: "failed",
      status: "failed",
      attempts: 4,
      nextAttemptAt: 50,
      sendingLeaseExpiresAt: 60,
      idempotencyKey: "stable-key",
      createdAt: 10,
      lastError: {
        type: "http",
        message: "no",
        retryable: false,
        occurredAt: 40
      }
    })
    await storage.put(failed)
    await storage.put(action({ id: "queued", status: "queued" }))
    const queue = createQueue({
      name: "retry",
      storage,
      transport: phase2Transport
    })
    const queued = vi.fn()
    queue.on("queued", queued)
    await queue.retry(failed.id)
    const retried = await storage.get(failed.id)
    expect(retried).toMatchObject({
      id: failed.id,
      idempotencyKey: failed.idempotencyKey,
      createdAt: failed.createdAt,
      status: "queued",
      attempts: 0
    })
    expect(retried?.nextAttemptAt).toBeUndefined()
    expect(retried?.sendingLeaseExpiresAt).toBeUndefined()
    expect(retried?.lastError).toBeUndefined()
    expect(queued).toHaveBeenCalledWith(
      expect.objectContaining({ id: failed.id, status: "queued" })
    )
    await expect(queue.retry("missing")).rejects.satisfy(
      (error: unknown) => errorCode(error) === "not-found"
    )
    await expect(queue.retry("queued")).rejects.satisfy(
      (error: unknown) => errorCode(error) === "action-state"
    )
  })

  it("preserves structural storage error codes and their causes", async () => {
    const storage = await openStorage("structural-errors")
    const failed = action({ id: "failed", status: "failed" })
    await storage.put(failed)
    const queue = createQueue({
      name: "structural-errors",
      storage,
      transport: phase2Transport
    })
    const retryError = Object.assign(new Error("retry race"), {
      code: "action-state"
    })
    storage.update = vi.fn().mockRejectedValue(retryError)
    await expect(queue.retry(failed.id)).rejects.toMatchObject({
      code: "action-state",
      cause: retryError
    })

    const cancelError = Object.assign(new Error("lost owner"), {
      code: "ownership-lost"
    })
    storage.delete = vi.fn().mockRejectedValue(cancelError)
    await expect(queue.cancel(failed.id)).rejects.toMatchObject({
      code: "ownership-lost",
      cause: cancelError
    })
  })

  it("cancels only eligible states and protects sending from a cancellation race", async () => {
    const storage = await openStorage("cancel")
    for (const status of ["queued", "retrying", "failed"] as const) {
      await storage.put(action({ id: status, status }))
    }
    await storage.put(action({ id: "race", status: "queued" }))
    const queue = createQueue({
      name: "cancel",
      storage,
      transport: phase2Transport
    })
    const cancelled = vi.fn()
    queue.on("cancelled", cancelled)
    await queue.cancel("queued")
    await queue.cancel("retrying")
    await queue.cancel("failed")
    expect(cancelled.mock.calls.map(([event]) => event.id)).toEqual([
      "queued",
      "retrying",
      "failed"
    ])
    const realGet = storage.get.bind(storage)
    let transitioned = false
    storage.get = async (id) => {
      const result = await realGet(id)
      if (id === "race" && !transitioned) {
        transitioned = true
        await storage.update(id, (current) => ({
          ...current,
          status: "sending"
        }))
      }
      return result
    }
    await expect(queue.cancel("race")).rejects.satisfy(
      (error: unknown) => errorCode(error) === "action-state"
    )
    expect(await realGet("race")).toMatchObject({ status: "sending" })
    await expect(queue.cancel("missing")).resolves.toBeUndefined()
    expect(cancelled).toHaveBeenCalledTimes(3)
  })

  it("supports operations before start, idempotent lifecycle calls, and operations after stop", async () => {
    const storage = await openStorage("lifecycle")
    const queue = createQueue({
      name: "lifecycle",
      storage,
      transport: phase2Transport
    })
    const before = await queue.enqueue({ method: "POST", url: "/before" })
    await queue.start()
    await queue.start()
    expect(queue.getSnapshot().started).toBe(true)
    await queue.stop()
    await queue.stop()
    const after = await queue.enqueue({ method: "POST", url: "/after" })
    expect(await queue.get(after.id)).toBeDefined()
    expect(await queue.get(before.id)).toBeDefined()
    await queue.start()
    expect(queue.getSnapshot().started).toBe(true)
  })

  it("can retry a failed start and restart after stop", async () => {
    const storage = await openStorage("start-retry")
    const realOpen = storage.open.bind(storage)
    let fail = true
    storage.open = async (context) => {
      if (fail) {
        fail = false
        throw new Error("open failed")
      }
      await realOpen(context)
    }
    const queue = createQueue({
      name: "start-retry",
      storage,
      transport: phase2Transport
    })
    const first = queue.start()
    const second = queue.start()
    await expect(Promise.all([first, second])).rejects.toMatchObject({
      code: "storage",
      cause: expect.any(Error)
    })
    await queue.start()
    await queue.stop()
    await queue.start()
    expect(queue.getSnapshot().started).toBe(true)
  })

  it("can retry a start whose initial snapshot read fails", async () => {
    const storage = await openStorage("start-list-retry")
    const realList = storage.list.bind(storage)
    let fail = true
    storage.list = async (options) => {
      if (fail) {
        fail = false
        throw new Error("initial list failed")
      }
      return realList(options)
    }
    const queue = createQueue({
      name: "start-list-retry",
      storage,
      transport: phase2Transport
    })
    await expect(queue.start()).rejects.toMatchObject({
      code: "storage",
      cause: expect.any(Error)
    })
    await queue.start()
    expect(queue.getSnapshot().started).toBe(true)
  })

  it("can retry a failed stop without losing the open storage handle", async () => {
    const storage = await openStorage("stop-retry")
    const realClose = storage.close.bind(storage)
    let fail = true
    let closeCalls = 0
    storage.close = async () => {
      closeCalls += 1
      if (fail) {
        fail = false
        throw new Error("close failed")
      }
      await realClose()
    }
    const queue = createQueue({
      name: "stop-retry",
      storage,
      transport: phase2Transport
    })
    await queue.start()
    await expect(queue.stop()).rejects.toMatchObject({
      code: "storage",
      cause: expect.any(Error)
    })
    await queue.stop()
    expect(closeCalls).toBe(2)
    expect(queue.getSnapshot().started).toBe(false)
  })

  it("uses secure random-value UUID fallback and rejects when no secure source exists", async () => {
    const originalCrypto = globalThis.crypto
    const randomValueCrypto = {
      getRandomValues(bytes: Uint8Array): Uint8Array {
        bytes.fill(0x11)
        return bytes
      }
    }
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    try {
      vi.stubGlobal("crypto", randomValueCrypto as unknown as Crypto)
      const storage = await openStorage("uuid-fallback")
      const queue = createQueue({
        name: "uuid-fallback",
        storage,
        transport: phase2Transport
      })
      const receipt = await queue.enqueue({ method: "POST", url: "/uuid" })
      const persisted = await storage.get(receipt.id)
      expect(receipt.id).toMatch(uuid)
      expect(receipt.idempotencyKey).toMatch(uuid)
      expect(persisted?.id).toBe(receipt.id)

      vi.stubGlobal("crypto", undefined)
      const noCryptoStorage = await openStorage("uuid-missing")
      const noCryptoQueue = createQueue({
        name: "uuid-missing",
        storage: noCryptoStorage,
        transport: phase2Transport
      })
      await expect(
        noCryptoQueue.enqueue({ method: "POST", url: "/uuid-missing" })
      ).rejects.toMatchObject({ code: "configuration" })
      expect(await noCryptoStorage.list()).toEqual([])
    } finally {
      vi.stubGlobal("crypto", originalCrypto)
    }
  })

  it("keeps a mutation issued while stop is pending", async () => {
    const storage = await openStorage("stop-race")
    const realClose = storage.close.bind(storage)
    const closeGate = deferred<void>()
    let closeStarted = false
    storage.close = async () => {
      closeStarted = true
      await closeGate.promise
      await realClose()
    }
    const queue = createQueue({
      name: "stop-race",
      storage,
      transport: phase2Transport
    })
    await queue.start()
    const stopping = queue.stop()
    await vi.waitFor(() => expect(closeStarted).toBe(true))
    const enqueue = queue.enqueue({ method: "POST", url: "/while-stopping" })
    closeGate.resolve()
    const receipt = await enqueue
    await stopping
    expect(await queue.get(receipt.id)).toBeDefined()
  })

  it("isolates observer payloads and ignores observer throws and rejected promises", async () => {
    const storage = await openStorage("observers")
    const queue = createQueue({
      name: "observers",
      storage,
      transport: phase2Transport
    })
    const first = vi.fn((event: QueuedAction) => {
      event.request.body = { changed: true }
      throw new Error("observer throw")
    })
    const secondBodies: unknown[] = []
    const second = vi.fn((event: QueuedAction) => {
      secondBodies.push(event.request.body)
    })
    const rejected = vi.fn(async () => {
      throw new Error("observer rejection")
    })
    const unsubscribeFirst = queue.on("queued", first)
    queue.on("queued", second)
    queue.on("queued", rejected)
    const receipt = await queue.enqueue({
      method: "POST",
      url: "/observers",
      body: { value: 1 }
    })
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(rejected).toHaveBeenCalledOnce()
    expect(secondBodies).toEqual([{ value: 1 }])
    expect((await storage.get(receipt.id))?.request.body).toEqual({ value: 1 })
    unsubscribeFirst()
    await queue.enqueue({ method: "POST", url: "/observers/after-unsubscribe" })
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledTimes(2)
  })

  it("gives subscribers detached snapshots immediately and never lets one mutate another", async () => {
    const storage = await openStorage("snapshots")
    const queue = createQueue({
      name: "snapshots",
      storage,
      transport: phase2Transport
    })
    const first: unknown[] = []
    const second: unknown[] = []
    const initialSnapshot = queue.getSnapshot()
    expect(queue.getSnapshot()).toBe(initialSnapshot)
    const unsubscribeFirst = queue.subscribe((snapshot) => {
      first.push(snapshot)
      ;(snapshot as { queuedCount: number }).queuedCount = 999
    })
    queue.subscribe((snapshot) => second.push(snapshot))
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    await queue.enqueue({ method: "POST", url: "/snapshots" })
    expect((second.at(-1) as { queuedCount: number }).queuedCount).toBe(1)
    const snapshot = queue.getSnapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(snapshot.queuedCount).toBe(1)
    expect(snapshot).not.toBe(initialSnapshot)
    unsubscribeFirst()
    await queue.enqueue({ method: "POST", url: "/snapshots/after-unsubscribe" })
    expect(first).toHaveLength(2)
    expect(second).toHaveLength(3)
  })

  it("keeps committed enqueue successful when post-commit snapshot refresh fails", async () => {
    const storage = await openStorage("postcommit")
    const realList = storage.list.bind(storage)
    let failList = false
    storage.list = async (options) => {
      if (failList) throw new Error("snapshot unavailable")
      return realList(options)
    }
    const queue = createQueue({
      name: "postcommit",
      storage,
      transport: phase2Transport
    })
    failList = true
    const receipt = await queue.enqueue({ method: "POST", url: "/committed" })
    expect(await storage.get(receipt.id)).toBeDefined()
  })

  it("does not let a rejected logger promise break a committed operation", async () => {
    const storage = await openStorage("logger-rejection")
    storage.list = vi.fn().mockRejectedValue(new Error("snapshot unavailable"))
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(() => Promise.reject(new Error("logger rejected"))),
      error: vi.fn()
    }
    const queue = createQueue({
      name: "logger-rejection",
      storage,
      transport: phase2Transport,
      logger
    })
    const receipt = await queue.enqueue({ method: "POST", url: "/logged" })
    expect(await storage.get(receipt.id)).toBeDefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it("reports storage failures from inspection operations", async () => {
    const storage = await openStorage("inspection-errors")
    storage.get = vi.fn().mockRejectedValue(new Error("get failed"))
    storage.list = vi.fn().mockRejectedValue(new Error("list failed"))
    const queue = createQueue({
      name: "inspection-errors",
      storage,
      transport: phase2Transport
    })
    await expect(queue.get("id")).rejects.toMatchObject({
      code: "storage",
      cause: expect.any(Error)
    })
    await expect(queue.list()).rejects.toMatchObject({
      code: "storage",
      cause: expect.any(Error)
    })
  })

  it("reports the pending snapshot counts and excludes sending actions", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const storage = await openStorage("snapshot-counts")
    await storage.put(action({ id: "queued", status: "queued" }))
    await storage.put(
      action({ id: "retrying", status: "retrying", nextAttemptAt: 10_050 })
    )
    await storage.put(action({ id: "sending", status: "sending" }))
    await storage.put(action({ id: "failed", status: "failed" }))
    const queue = createQueue({
      name: "snapshot-counts",
      storage,
      transport: phase2Transport
    })
    await queue.start()
    const snapshot = queue.getSnapshot()
    expect(snapshot).toMatchObject({
      queuedCount: 1,
      retryingCount: 1,
      failedCount: 1
    })
    expect(snapshot.nextRetryAt).toBe(10_050)
  })
})

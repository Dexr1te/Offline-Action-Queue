import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  ActionStatus,
  ProcessorGuard,
  QueueStorage,
  QueuedAction
} from "../../src/index"
import { action } from "./action"

export type StorageFactory = (
  name?: string
) => QueueStorage | Promise<QueueStorage>

const expectCode = async (
  promise: Promise<unknown>,
  code: string
): Promise<void> => {
  await expect(promise).rejects.toMatchObject({ code })
}

const statuses: readonly ActionStatus[] = [
  "queued",
  "sending",
  "retrying",
  "failed"
]

/** Reusable adapter contract. An IndexedDB test can invoke this with its own factory. */
export const describeStorageContract = (
  label: string,
  factory: StorageFactory
): void => {
  describe(`${label} storage contract`, () => {
    let sequence = 0
    const created: QueueStorage[] = []
    afterEach(async () => {
      for (const storage of created.splice(0)) await storage.close()
    })

    const fresh = async (): Promise<{
      storage: QueueStorage
      name: string
    }> => {
      const name = `${label}-${sequence++}`
      const storage = await factory(name)
      created.push(storage)
      await storage.open({ name })
      return { storage, name }
    }

    it("persists actions, clones every boundary, and sorts FIFO without locale collation", async () => {
      const { storage } = await fresh()
      const source = action({ id: "z", createdAt: 10, body: { nested: [1] } })
      await storage.put(source)
      source.request.body = { nested: [9] }

      expect(await storage.get("missing")).toBeUndefined()
      const read = await storage.get(source.id)
      expect(read?.request.body).toEqual({ nested: [1] })
      if (read) read.request.body = { nested: [8] }
      expect((await storage.get(source.id))?.request.body).toEqual({
        nested: [1]
      })

      await storage.put(action({ id: "A", createdAt: 10 }))
      await storage.put(action({ id: "a", createdAt: 10 }))
      await storage.put(action({ id: "early", createdAt: 1 }))
      const listed = await storage.list()
      expect(listed.map((item) => item.id)).toEqual(["early", "A", "a", "z"])
      listed[0]!.request.body = { changed: true }
      expect((await storage.get("early"))?.request.body).not.toEqual({
        changed: true
      })
    })

    it("filters by status and validates status filters and limits", async () => {
      const { storage } = await fresh()
      for (const [index, status] of statuses.entries()) {
        await storage.put(action({ id: status, status, createdAt: index }))
      }
      expect(
        (await storage.list({ status: ["queued", "failed"] })).map(
          (item) => item.status
        )
      ).toEqual(["queued", "failed"])
      expect((await storage.list({ limit: 2 })).map((item) => item.id)).toEqual(
        ["queued", "sending"]
      )
      expect(await storage.list({ limit: 0 })).toEqual([])
      await expectCode(storage.list({ limit: -1 }), "configuration")
      await expectCode(storage.list({ limit: 1.5 }), "configuration")
      await expectCode(
        storage.list({ limit: Number.POSITIVE_INFINITY }),
        "configuration"
      )
      await expectCode(
        storage.list({ status: ["bogus" as ActionStatus] }),
        "configuration"
      )
    })

    it("updates atomically, rejects changed identity and async updaters, and rolls back throws", async () => {
      const { storage } = await fresh()
      const original = action({ id: "update-me", body: { count: 1 } })
      await storage.put(original)
      await expect(
        storage.update(original.id, (current) => {
          current.request.body = { count: 2 }
          throw new Error("do not commit")
        })
      ).rejects.toThrow("do not commit")
      expect((await storage.get(original.id))?.request.body).toEqual({
        count: 1
      })

      await expectCode(
        storage.update(original.id, (current) => ({
          ...current,
          id: "different"
        })),
        "action-state"
      )
      expect(await storage.get(original.id)).toEqual(original)

      const asyncUpdater = (async (current: QueuedAction) => ({
        ...current,
        attempts: 10
      })) as unknown as (current: QueuedAction) => QueuedAction
      await expectCode(
        storage.update(original.id, asyncUpdater),
        "configuration"
      )
      expect(await storage.get(original.id)).toEqual(original)
      await expectCode(
        storage.update("missing", (current) => current),
        "not-found"
      )
    })

    it("rejects duplicate puts, makes missing deletes idempotent, and preserves data across close/open", async () => {
      const { storage, name } = await fresh()
      const item = action({ id: "persistent" })
      await storage.put(item)
      await expectCode(storage.put(item), "storage")
      await storage.delete("missing")
      await storage.close()
      await storage.open({ name })
      expect(await storage.get(item.id)).toEqual(item)

      const rebound = await factory(`${label}-rebind`)
      created.push(rebound)
      await rebound.open({ name: "one" })
      await expectCode(rebound.open({ name: "two" }), "configuration")
    })

    it("isolates actions written under different queue names", async () => {
      const firstName = `${label}-isolated-a-${sequence++}`
      const secondName = `${label}-isolated-b-${sequence++}`
      const first = await factory(firstName)
      const second = await factory(secondName)
      created.push(first, second)
      await first.open({ name: firstName })
      await second.open({ name: secondName })
      await first.put(action({ id: "same-id" }))
      expect(await second.get("same-id")).toBeUndefined()
    })

    it("applies conditional deletion atomically", async () => {
      const { storage } = await fresh()
      const item = action({ id: "race", status: "queued" })
      await storage.put(item)
      await storage.update(item.id, (current) => ({
        ...current,
        status: "sending"
      }))
      await expectCode(
        storage.delete(item.id, undefined, {
          allowedStatuses: ["queued", "retrying", "failed"]
        }),
        "action-state"
      )
      expect((await storage.get(item.id))?.status).toBe("sending")
      await storage.update(item.id, (current) => ({
        ...current,
        status: "queued"
      }))
      await storage.delete(item.id, undefined, {
        allowedStatuses: ["queued", "retrying", "failed"]
      })
      expect(await storage.get(item.id)).toBeUndefined()
    })

    it("fences guarded update/delete with an unexpired lease", async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(1_000)
        const { storage } = await fresh()
        const item = action({ id: "guarded", status: "queued" })
        await storage.put(item)
        const lease = await storage.coordination!.acquire("owner-a", 100)
        expect(lease).toBeDefined()
        const guard: ProcessorGuard = { leaseToken: lease!.token }
        await storage.update(
          item.id,
          (current) => ({ ...current, status: "sending" }),
          guard
        )
        expect((await storage.get(item.id))?.status).toBe("sending")

        vi.advanceTimersByTime(100)
        await expectCode(
          storage.update(
            item.id,
            (current) => ({ ...current, status: "failed" }),
            guard
          ),
          "ownership-lost"
        )
        await expectCode(storage.delete(item.id, guard), "ownership-lost")
        expect((await storage.get(item.id))?.status).toBe("sending")
      } finally {
        vi.useRealTimers()
      }
    })

    it("supports atomic acquisition, expiry takeover, fresh same-owner tokens, and safe release", async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(5_000)
        const name = `${label}-shared-${sequence++}`
        const firstStorage = await factory(name)
        const secondStorage = await factory(name)
        created.push(firstStorage, secondStorage)
        await firstStorage.open({ name })
        await secondStorage.open({ name })
        const firstCoordination = firstStorage.coordination!
        const secondCoordination = secondStorage.coordination!
        const [first, contender] = await Promise.all([
          firstCoordination.acquire("owner", 50),
          secondCoordination.acquire("other", 50)
        ])
        expect([first, contender].filter(Boolean)).toHaveLength(1)
        const lease = first ?? contender!
        const staleOwner = first === undefined ? contender! : first
        const guardedStorage =
          first === undefined ? secondStorage : firstStorage
        const guarded = action({ id: "fenced", status: "queued" })
        await guardedStorage.put(guarded)
        expect(
          await secondCoordination.renew(
            { ...lease, ownerId: "wrong-owner" },
            50
          )
        ).toBeUndefined()
        await secondCoordination.release({ ...lease, ownerId: "wrong-owner" })
        expect(await firstCoordination.renew(lease, 50)).toBeDefined()
        vi.advanceTimersByTime(50)
        const sameOwner = await firstCoordination.acquire(lease.ownerId, 50)
        expect(sameOwner).toBeDefined()
        expect(sameOwner!.token).not.toBe(lease.token)
        expect(await firstCoordination.renew(staleOwner, 50)).toBeUndefined()
        await expectCode(
          guardedStorage.update(
            guarded.id,
            (current) => ({ ...current, status: "failed" }),
            {
              leaseToken: staleOwner.token
            }
          ),
          "ownership-lost"
        )
        await expectCode(
          guardedStorage.delete(guarded.id, {
            leaseToken: staleOwner.token
          }),
          "ownership-lost"
        )
        expect((await guardedStorage.get(guarded.id))?.status).toBe("queued")
        await firstCoordination.release(lease)
        const renewed = await firstCoordination.renew(sameOwner!, 1)
        expect(renewed).toBeDefined()
        const updated = await guardedStorage.update(
          guarded.id,
          (current) => ({ ...current, status: "retrying" }),
          { leaseToken: renewed!.token }
        )
        updated.request.body = { mutated: true }
        expect(
          (await guardedStorage.get(guarded.id))?.request.body
        ).toBeUndefined()
        await firstCoordination.release(renewed!)
        expect(await firstCoordination.acquire("owner", 1)).toBeDefined()
        await expectCode(firstCoordination.acquire("owner", 0), "configuration")
        await expectCode(
          firstCoordination.acquire("owner", Number.NaN),
          "configuration"
        )
      } finally {
        vi.useRealTimers()
      }
    })
  })
}

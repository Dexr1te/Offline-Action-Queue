import { describe, expect, it } from "vitest"
import { action, createInMemoryStorage } from "./in-memory-storage"

describe("in-memory storage binding", () => {
  it("permits direct open without a queue context and keeps its data after reopen", async () => {
    const storage = createInMemoryStorage()
    await storage.open()
    await storage.put(action({ id: "direct" }))
    await storage.close()
    await storage.open()
    expect(await storage.get("direct")).toBeDefined()
  })

  it("rejects rebinding an already named adapter", async () => {
    const storage = createInMemoryStorage()
    await storage.open({ name: "first" })
    await expect(storage.open({ name: "second" })).rejects.toMatchObject({
      code: "configuration"
    })
  })
})

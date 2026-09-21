import { describeStorageContract } from "./helpers/storage-contract"
import {
  createInMemoryStorage,
  createInMemoryStorageBacking
} from "./helpers/in-memory-storage"

const backing = createInMemoryStorageBacking()

describeStorageContract("in-memory", () => createInMemoryStorage(backing))

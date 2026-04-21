import { createJSONStorage, type StateStorage } from 'zustand/middleware'

const storage: StateStorage = {
  getItem: async (name) => window.electronAPI.storeGet(name),
  setItem: async (name, value) => {
    await window.electronAPI.storeSet(name, value)
  },
  removeItem: async (name) => {
    await window.electronAPI.storeRemove(name)
  },
}

/** Persists Zustand state in the main-process SQLite DB (via IPC). */
export const electronPersistStorage = createJSONStorage(() => storage)

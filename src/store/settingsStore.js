import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'light',        // 'light' | 'dark' | 'system'
      language: 'en',        // 'en' | 'ar' | 'fr'
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'lers-settings' }
  )
)

export default useSettingsStore
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Locale } from '../lib/produits'

interface StoreState {
  locale: Locale
  setLocale: (l: Locale) => void
  cityId: string | null      // ville de départ choisie (filtre global)
  setCityId: (id: string | null) => void
}

const Ctx = createContext<StoreState | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem('dts_locale') as Locale) || 'fr',
  )
  const [cityId, setCityId] = useState<string | null>(
    () => localStorage.getItem('dts_city') || null,
  )
  useEffect(() => { localStorage.setItem('dts_locale', locale) }, [locale])
  useEffect(() => {
    if (cityId) localStorage.setItem('dts_city', cityId)
    else localStorage.removeItem('dts_city')
  }, [cityId])

  const value = useMemo(
    () => ({ locale, setLocale, cityId, setCityId }),
    [locale, cityId],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}

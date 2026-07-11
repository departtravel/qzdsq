import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './StoreContext'
import { trackVisit } from './data'
import { HomePage } from './HomePage'
import { ProductPage } from './ProductPage'
import { EventsPage } from './EventsPage'
import { CircuitPage } from './CircuitPage'
import { ContactWidget } from './ContactWidget'
import { LOCALES, LOCALE_LABELS } from '../lib/produits'

// Vitrine publique Depart Travel Services.
export function Storefront() {
  useEffect(() => { trackVisit() }, [])
  return (
    <StoreProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/excursion/:id" element={<ProductPage />} />
            <Route path="/evenements" element={<EventsPage />} />
            <Route path="/circuit-sur-mesure" element={<CircuitPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <Footer />
        <ContactWidget />
      </div>
    </StoreProvider>
  )
}

function Header() {
  const { locale, setLocale } = useStore()
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-glow">D</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-ink-900">
            Depart<span className="text-brand-500">Travel</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-700 md:flex">
          <Link to="/" className="hover:text-brand-600">Excursions</Link>
          <Link to="/circuit-sur-mesure" className="hover:text-brand-600">Circuit sur mesure</Link>
          <Link to="/evenements" className="hover:text-brand-600">Événements</Link>
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <a href="https://wa.me/" target="_blank" rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-600 sm:inline-flex">
            <span>WhatsApp</span>
          </a>
          <select value={locale} onChange={(e) => setLocale(e.target.value as never)}
            className="rounded-lg border border-ink-100 bg-white px-2 py-2 font-medium text-ink-700">
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
          </select>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-10 bg-ink-900 text-ink-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-display text-lg font-extrabold text-white">Depart<span className="text-brand-400">Travel</span></div>
          <p className="mt-2 text-sm text-ink-100/70">Excursions, circuits et événements sur mesure en Tunisie. Voyagez avec une agence locale de confiance.</p>
        </div>
        <FooterCol titre="Découvrir" liens={[['Excursions', '/'], ['Circuit sur mesure', '/circuit-sur-mesure'], ['Événements', '/evenements']]} />
        <FooterCol titre="Confiance" liens={[['Confirmation immédiate', '/'], ['Annulation gratuite', '/'], ['Paiement sécurisé', '/']]} />
        <div>
          <div className="text-sm font-semibold text-white">Nous contacter</div>
          <a href="https://wa.me/" className="mt-3 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">WhatsApp</a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-ink-100/60">
          <span>© {new Date().getFullYear()} Depart Travel Services</span>
          <Link to="/admin" className="hover:text-white">Espace pro</Link>
        </div>
      </div>
    </footer>
  )
}
function FooterCol({ titre, liens }: { titre: string; liens: [string, string][] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-white">{titre}</div>
      <ul className="mt-3 space-y-2 text-sm text-ink-100/70">
        {liens.map(([l, to]) => <li key={l}><Link to={to} className="hover:text-white">{l}</Link></li>)}
      </ul>
    </div>
  )
}

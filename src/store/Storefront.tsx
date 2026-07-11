import { Link, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './StoreContext'
import { HomePage } from './HomePage'
import { ProductPage } from './ProductPage'
import { LOCALES, LOCALE_LABELS } from '../lib/produits'

// Vitrine publique Depart Travel Services.
export function Storefront() {
  return (
    <StoreProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/excursion/:id" element={<ProductPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </StoreProvider>
  )
}

function Header() {
  const { locale, setLocale } = useStore()
  return (
    <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-amber-600">Depart Travel</span>
          <span className="hidden text-xs text-slate-400 sm:inline">Services</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <a href="https://wa.me/" target="_blank" rel="noreferrer"
            className="hidden rounded-full bg-green-500 px-3 py-1.5 font-medium text-white hover:bg-green-600 sm:inline">
            💬 WhatsApp
          </a>
          <select value={locale} onChange={(e) => setLocale(e.target.value as never)}
            className="rounded border border-slate-300 px-2 py-1.5 text-slate-600">
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
          </select>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <div className="font-bold text-amber-600">Depart Travel Services</div>
            <p className="mt-1 max-w-xs text-slate-400">
              Excursions, circuits et événements sur mesure en Tunisie.
            </p>
          </div>
          <div className="text-slate-400">
            <p>✅ Confirmation immédiate</p>
            <p>🔒 Paiement sécurisé</p>
            <p>⭐ Agence locale de confiance</p>
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Depart Travel Services · <Link to="/admin" className="hover:underline">Espace pro</Link>
        </p>
      </div>
    </footer>
  )
}

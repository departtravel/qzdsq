import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from './StoreContext'
import { fetchCatalog, tradProduit, type CatalogItem } from './data'
import { setSeo } from './seo'
import type { City } from '../lib/produits'
import {
  prixAPartirDe, promoAffichee, badgesProduit, pricingProduit, type Badge,
} from '../lib/produits'

const today = () => new Date().toISOString().slice(0, 10)

export function HomePage() {
  const { locale, cityId, setCityId } = useStore()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')

  useEffect(() => {
    fetchCatalog().then(({ items, cities }) => {
      setItems(items); setCities(cities); setLoading(false)
    })
    setSeo({
      title: 'Depart Travel Services — Excursions & circuits en Tunisie',
      description:
        'Réservez vos excursions, désert, circuits et activités en Tunisie. Départs depuis Tunis, Djerba, Hammamet, Sousse… Confirmation immédiate, meilleurs prix.',
    })
  }, [])

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.excursion.categorie).filter(Boolean))] as string[],
    [items],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((i) => {
      if (cat && i.excursion.categorie !== cat) return false
      if (cityId && !i.cities.some((c) => c.city_id === cityId && c.role === 'DEPART')) return false
      if (needle) {
        const t = tradProduit(i, locale)
        if (!t.nom.toLowerCase().includes(needle) && !(i.excursion.destination ?? '').toLowerCase().includes(needle))
          return false
      }
      return true
    })
  }, [items, q, cat, cityId, locale])

  const promos = filtered.filter((i) => i.discounts.length > 0)

  return (
    <div>
      {/* ---- HERO : entrée par ville ---- */}
      <section className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="max-w-2xl text-3xl font-bold sm:text-4xl">
            Vivez la Tunisie autrement — désert, culture, aventures
          </h1>
          <p className="mt-3 max-w-xl text-white/90">
            Choisissez votre ville de départ et trouvez l’excursion faite pour vous.
          </p>

          <div className="mt-6 flex flex-col gap-2 rounded-xl bg-white p-3 shadow-lg sm:flex-row">
            <select
              value={cityId ?? ''}
              onChange={(e) => setCityId(e.target.value || null)}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-800"
            >
              <option value="">📍 Toutes les villes de départ</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔎 Désert, Kairouan, quad…"
              className="flex-[2] rounded-lg border border-slate-300 px-4 py-3 text-slate-800"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/90">
            <span>✅ Confirmation immédiate</span>
            <span>🆓 Annulation gratuite</span>
            <span>🔒 Paiement sécurisé</span>
            <span>⭐ Agence locale de confiance</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ---- Filtres catégories ---- */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Chip active={!cat} onClick={() => setCat('')}>Tout</Chip>
          {categories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500">Chargement du catalogue…</p>
        ) : (
          <>
            {promos.length > 0 && (
              <Section title="🏷️ Offres du moment">
                <Grid items={promos.slice(0, 8)} />
              </Section>
            )}
            <Section title={cityId ? 'Excursions depuis votre ville' : 'Toutes nos excursions'}>
              {filtered.length === 0
                ? <p className="text-slate-500">Aucune excursion ne correspond. Essayez une autre ville ou catégorie.</p>
                : <Grid items={filtered} />}
            </Section>

            {/* ---- Bannière circuit sur mesure ---- */}
            <Link to="/circuit-sur-mesure"
              className="mb-10 flex flex-col items-start justify-between gap-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white transition hover:shadow-lg sm:flex-row sm:items-center">
              <div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">🎁 Devis 100 % gratuit</span>
                <h2 className="mt-2 text-xl font-bold">Créez votre circuit sur mesure 🗺️</h2>
                <p className="mt-1 text-sm text-white/90">Villes, visites, hébergements, randonnées, 4×4… on compose l’itinéraire idéal.</p>
              </div>
              <span className="rounded-lg bg-white px-5 py-2.5 font-semibold text-emerald-700">Commencer →</span>
            </Link>

            {/* ---- Événements sur devis (teaser) ---- */}
            <Section title="🎉 Événements sur mesure">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { t: 'Team building', d: 'Cohésion d’équipe dans le désert ou en bord de mer.' },
                  { t: 'EVG / EVJF', d: 'Un enterrement de vie inoubliable, organisé pour vous.' },
                  { t: 'Mariage', d: 'Célébrez en Tunisie, nous gérons toute la logistique.' },
                ].map((e) => (
                  <Link key={e.t} to="/evenements" className="rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
                    <h3 className="font-semibold">{e.t}</h3>
                    <p className="mt-1 text-sm text-slate-500">{e.d}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-amber-600">Sur devis →</span>
                  </Link>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm ${active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
      {children}
    </button>
  )
}

function Grid({ items }: { items: CatalogItem[] }) {
  const { locale } = useStore()
  const d = today()
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => {
        const t = tradProduit(i, locale)
        const prix = prixAPartirDe(pricingProduit(i.excursion), i.variants)
        const promo = promoAffichee(i.discounts, null, prix, d)
        const badges: Badge[] = badgesProduit({
          discounts: i.discounts, departures: i.departures, dateISO: d,
        })
        return (
          <Link key={i.excursion.id} to={`/excursion/${i.excursion.id}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
            <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200 text-4xl">
              🏜️
              <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                {badges.map((b) => (
                  <span key={b.type} className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{b.label}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span>{i.excursion.categorie || 'Excursion'}</span>
                {i.excursion.duree && <><span>·</span><span>{i.excursion.duree}</span></>}
              </div>
              <h3 className="font-semibold text-slate-800 group-hover:text-amber-600">{t.nom}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{t.description}</p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="text-xs text-slate-400">à partir de</span>
                  <div className="flex items-center gap-2">
                    {promo ? (
                      <>
                        <span className="text-lg font-bold text-amber-600">{promo.prixPromo} {i.excursion.devise}</span>
                        <span className="text-sm text-slate-400 line-through">{promo.prixBarre}</span>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">-{promo.pct}%</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-slate-800">{prix} {i.excursion.devise}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-amber-600">Voir →</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

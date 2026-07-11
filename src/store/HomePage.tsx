import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from './StoreContext'
import { fetchCatalog, tradProduit, slugify, type CatalogItem } from './data'
import { setSeo, setJsonLd, organizationJsonLd } from './seo'
import { FaqSection } from './Faq'
import { Cover } from './Cover'
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
    setJsonLd('dts-org', organizationJsonLd())
    return () => setJsonLd('dts-org')
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
        if (!t.nom.toLowerCase().includes(needle) && !(i.excursion.destination ?? '').toLowerCase().includes(needle)) return false
      }
      return true
    })
  }, [items, q, cat, cityId, locale])

  const promos = filtered.filter((i) => i.discounts.length > 0)
  const bestSellers = filtered.filter((i) => i.excursion.best_seller)

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative">
        <div className="absolute inset-0">
          <Cover seed="hero-sahara" categorie="désert" className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/55 via-ink-900/35 to-ink-900/70" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:pt-24">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur">
              ⭐ Agence locale · +10 000 voyageurs
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Explorez la Tunisie,<br />du désert à la mer
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Excursions, circuits multi-jours et expériences privées. Réservation en ligne, confirmation immédiate.
            </p>
          </div>

          {/* Barre de recherche */}
          <div className="mt-8 max-w-3xl animate-fade-up rounded-2xl bg-white p-2 shadow-lift sm:flex sm:items-center sm:gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2">
              <span className="text-ink-700/40">📍</span>
              <select value={cityId ?? ''} onChange={(e) => setCityId(e.target.value || null)}
                className="w-full bg-transparent text-ink-800 outline-none">
                <option value="">Ville de départ</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="hidden h-8 w-px bg-ink-100 sm:block" />
            <div className="flex flex-[1.5] items-center gap-2 rounded-xl px-3 py-2">
              <span className="text-ink-700/40">🔎</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Désert, Kairouan, quad…"
                className="w-full bg-transparent text-ink-800 outline-none placeholder:text-ink-700/40" />
            </div>
            <button className="btn-primary mt-2 w-full sm:mt-0 sm:w-auto">Rechercher</button>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
            {['Confirmation immédiate', 'Annulation gratuite', 'Paiement sécurisé', 'Guides francophones'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">✓ {t}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {/* ===== Catégories ===== */}
        <div className="scroll-row mt-6">
          <Chip active={!cat} onClick={() => setCat('')}>Tout</Chip>
          {categories.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {bestSellers.length > 0 && (
              <Section title="🏆 Les incontournables" sub="Nos expériences les plus réservées">
                <Row items={bestSellers} />
              </Section>
            )}
            {promos.length > 0 && (
              <Section title="🏷️ Offres du moment" sub="Prix réduits pour un temps limité">
                <Row items={promos} />
              </Section>
            )}

            {/* Destinations populaires */}
            {cities.length > 0 && (
              <Section title="Où partez-vous ?" sub="Choisissez votre ville de départ">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {cities.slice(0, 8).map((c) => (
                    <Link key={c.id} to={`/excursions-depuis/${slugify(c.nom)}`}
                      className="card card-hover group text-left">
                      <Cover seed={c.nom} className="h-28 w-full" />
                      <div className="px-4 py-3 font-semibold text-ink-800 group-hover:text-brand-600">Excursions depuis {c.nom}</div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            <Section title={cityId ? 'Excursions depuis votre ville' : 'Toutes nos expériences'}
              sub={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}>
              {filtered.length === 0
                ? <p className="text-ink-700/60">Aucune expérience ne correspond. Essayez une autre ville ou catégorie.</p>
                : <Grid items={filtered} />}
            </Section>
          </>
        )}

        {/* ===== Pourquoi nous ===== */}
        <Section title="Pourquoi voyager avec nous ?">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['🗺️', 'Expertise locale', 'Une agence tunisienne qui connaît chaque piste et chaque oasis.'],
              ['⚡', 'Réservation instantanée', 'Confirmation immédiate, sans paperasse.'],
              ['🛡️', 'Voyage serein', 'Annulation gratuite et assistance à tout moment.'],
              ['💎', 'Sur mesure', 'Groupe, privatif ou circuit 100 % personnalisé.'],
            ].map(([e, t, d]) => (
              <div key={t} className="card p-5">
                <div className="text-2xl">{e}</div>
                <h3 className="mt-2 font-semibold text-ink-900">{t}</h3>
                <p className="mt-1 text-sm text-ink-700/70">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== Circuit sur mesure ===== */}
        <Link to="/circuit-sur-mesure"
          className="my-10 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 to-teal-500 p-8 text-white shadow-lift sm:flex-row sm:items-center">
          <div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">🎁 Devis 100 % gratuit</span>
            <h2 className="mt-3 font-display text-2xl font-extrabold">Composez votre circuit sur mesure</h2>
            <p className="mt-1 text-white/90">Villes, visites, hébergements, randonnées, 4×4… on crée l'itinéraire idéal.</p>
          </div>
          <span className="btn-ghost shrink-0 !text-teal-700">Commencer →</span>
        </Link>

        {/* ===== Témoignages ===== */}
        <Section title="Ils ont voyagé avec nous">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Sophie L.', 'France', 'Un circuit dans le Sahara inoubliable, guide au top et organisation parfaite.'],
              ['Marco R.', 'Italie', 'Réservation ultra simple, prix honnêtes. Le coucher de soleil à Ksar Ghilane… magique.'],
              ['Anna K.', 'Pologne', 'Team building organisé pour 20 personnes, tout était impeccable. Merci !'],
            ].map(([n, p, txt]) => (
              <div key={n} className="card p-5">
                <Stars note={5} />
                <p className="mt-3 text-sm text-ink-700/80">“{txt}”</p>
                <div className="mt-3 text-sm font-semibold text-ink-900">{n} <span className="font-normal text-ink-700/60">· {p}</span></div>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== FAQ ===== */}
        <FaqSection />

        {/* ===== Événements ===== */}
        <Section title="🎉 Événements sur mesure" sub="Team building · EVG / EVJF · Mariage">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Team building', 'Cohésion d’équipe dans le désert ou en bord de mer.', '🤝'],
              ['EVG / EVJF', 'Un enterrement de vie inoubliable, organisé pour vous.', '🎊'],
              ['Mariage', 'Célébrez en Tunisie, nous gérons toute la logistique.', '💍'],
            ].map(([t, d, e]) => (
              <Link key={t} to="/evenements" className="card card-hover p-6">
                <div className="text-3xl">{e}</div>
                <h3 className="mt-2 font-semibold text-ink-900">{t}</h3>
                <p className="mt-1 text-sm text-ink-700/70">{d}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-brand-600">Sur devis →</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

/* ---------- Sous-composants ---------- */
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-extrabold text-ink-900">{title}</h2>
        {sub && <p className="mt-1 text-ink-700/60">{sub}</p>}
      </div>
      {children}
    </section>
  )
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`chip shrink-0 ${active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}>
      {children}
    </button>
  )
}
export function Stars({ note, avis }: { note: number; avis?: number | null }) {
  const full = Math.round(note)
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="tracking-tight text-gold">{'★★★★★'.slice(0, full)}<span className="text-ink-100">{'★★★★★'.slice(full)}</span></span>
      <span className="font-semibold text-ink-800">{note.toFixed(1)}</span>
      {avis != null && avis > 0 && <span className="text-ink-700/50">({avis})</span>}
    </span>
  )
}

function Row({ items }: { items: CatalogItem[] }) {
  return (
    <div className="scroll-row">
      {items.map((i) => <div key={i.excursion.id} className="w-72 shrink-0"><ProductCard i={i} /></div>)}
    </div>
  )
}
function Grid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((i) => <ProductCard key={i.excursion.id} i={i} />)}
    </div>
  )
}

export function ProductCard({ i }: { i: CatalogItem }) {
  const { locale } = useStore()
  const d = today()
  const t = tradProduit(i, locale)
  const prix = prixAPartirDe(pricingProduit(i.excursion), i.variants)
  const promo = promoAffichee(i.discounts, null, prix, d)
  const badges: Badge[] = badgesProduit({
    discounts: i.discounts, departures: i.departures, dateISO: d,
    bestSeller: i.excursion.best_seller, nouveau: i.excursion.nouveaute,
  })
  return (
    <Link to={`/excursion/${i.excursion.id}`} className="card card-hover group flex flex-col">
      <div className="relative">
        <Cover imageUrl={i.excursion.image_url} seed={t.nom} categorie={i.excursion.categorie} className="h-44 w-full" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          {badges.slice(0, 2).map((b) => (
            <span key={b.type} className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink-900 shadow-sm">{b.label}</span>
          ))}
        </div>
        {i.excursion.categorie && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{i.excursion.categorie}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-ink-900 group-hover:text-brand-600">{t.nom}</h3>
        {i.excursion.note_moyenne != null && (
          <div className="mt-1"><Stars note={i.excursion.note_moyenne} avis={i.excursion.nb_avis} /></div>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-700/60">
          {i.excursion.duree && <span>🕒 {i.excursion.duree}</span>}
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <span className="text-xs text-ink-700/50">à partir de</span>
            <div className="flex items-center gap-1.5">
              {promo ? (
                <>
                  <span className="text-lg font-extrabold text-brand-600">{promo.prixPromo} {i.excursion.devise}</span>
                  <span className="text-sm text-ink-700/40 line-through">{promo.prixBarre}</span>
                </>
              ) : (
                <span className="text-lg font-extrabold text-ink-900">{prix} {i.excursion.devise}</span>
              )}
            </div>
          </div>
          {promo && <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">-{promo.pct}%</span>}
        </div>
      </div>
    </Link>
  )
}

function SkeletonGrid() {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card">
          <div className="h-44 w-full animate-pulse bg-ink-50" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-ink-50" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-ink-50" />
          </div>
        </div>
      ))}
    </div>
  )
}
function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-ink-100 bg-sand p-10 text-center">
      <div className="text-3xl">🧭</div>
      <h3 className="mt-2 font-display text-xl font-bold text-ink-900">Le catalogue arrive bientôt</h3>
      <p className="mt-1 text-ink-700/60">Connectez Supabase et ajoutez vos produits depuis l'espace pro pour les voir ici.</p>
    </div>
  )
}

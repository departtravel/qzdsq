import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCatalog, slugify, type CatalogItem } from './data'
import { setSeo, setJsonLd } from './seo'
import { ProductCard } from './HomePage'
import { FaqSection } from './Faq'
import type { City } from '../lib/produits'

export function CityPage() {
  const { slug } = useParams()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCatalog().then(({ items, cities }) => {
      setItems(items); setCities(cities); setLoading(false)
    })
  }, [])

  const city = useMemo(() => cities.find((c) => slugify(c.nom) === slug), [cities, slug])

  const filtered = useMemo(() => {
    if (!city) return []
    return items.filter((i) => i.cities.some((c) => c.city_id === city.id && c.role === 'DEPART'))
  }, [items, city])

  useEffect(() => {
    if (!city) return
    const titre = `Excursions au départ de ${city.nom} — Depart Travel Services`
    setSeo({
      title: titre,
      description: `Réservez vos excursions et circuits au départ de ${city.nom} en Tunisie : désert, culture, mer. Confirmation immédiate, annulation gratuite, meilleurs prix.`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: location.origin },
          { '@type': 'ListItem', position: 2, name: `Excursions depuis ${city.nom}`, item: location.href },
        ],
      },
    })
    return () => setJsonLd('dts-jsonld')
  }, [city])

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-16 text-ink-700/60">Chargement…</div>
  if (!city) return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-extrabold text-ink-900">Ville introuvable</h1>
      <Link to="/" className="btn-primary mt-6">Voir toutes les excursions</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="text-sm text-ink-700/60">
        <Link to="/" className="hover:text-brand-600">Accueil</Link>
        <span className="mx-1.5">/</span><span>Excursions depuis {city.nom}</span>
      </nav>

      <h1 className="mt-3 font-display text-3xl font-extrabold text-ink-900 sm:text-4xl">
        Excursions au départ de {city.nom}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-700/70">
        Découvrez nos excursions, circuits désert et activités au départ de <strong>{city.nom}</strong>.
        Réservation en ligne, confirmation immédiate, guides francophones et annulation gratuite.
        {' '}Sorties en groupe ou en privatif, et circuits sur mesure.
      </p>

      <div className="mt-8">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-100 bg-sand p-10 text-center">
            <p className="text-ink-700/60">Aucune excursion listée depuis {city.nom} pour l'instant.</p>
            <Link to="/circuit-sur-mesure" className="btn-primary mt-4">Demander un circuit sur mesure</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((i) => <ProductCard key={i.excursion.id} i={i} />)}
          </div>
        )}
      </div>

      <FaqSection />
    </div>
  )
}

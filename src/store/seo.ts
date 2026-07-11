// Aides SEO côté SPA (title, meta, Open Graph/Twitter, JSON-LD).
// NB : pour un référencement maximal (1re place Google), migrer la
// vitrine vers un rendu serveur (Next.js) — cf. note d'architecture.

export function setSeo(opts: { title: string; description?: string; image?: string; jsonLd?: object }) {
  document.title = opts.title
  setMeta('name', 'description', opts.description)
  // Open Graph
  setMeta('property', 'og:title', opts.title)
  setMeta('property', 'og:description', opts.description)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:url', location.href)
  setMeta('property', 'og:image', opts.image)
  setMeta('property', 'og:site_name', 'Depart Travel Services')
  // Twitter
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', opts.title)
  setMeta('name', 'twitter:description', opts.description)
  // Canonique
  setLink('canonical', location.href)

  setJsonLd('dts-jsonld', opts.jsonLd)
}

/** Injecte/retire un bloc JSON-LD identifié. */
export function setJsonLd(id: string, obj?: object) {
  document.getElementById(id)?.remove()
  if (!obj) return
  const s = document.createElement('script')
  s.type = 'application/ld+json'
  s.id = id
  s.textContent = JSON.stringify(obj)
  document.head.appendChild(s)
}

/** Fiche entreprise + coordonnées locales (SEO géo). */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: 'Depart Travel Services',
    description: 'Agence de voyage locale en Tunisie : excursions, circuits et événements sur mesure.',
    url: location.origin,
    areaServed: 'TN',
    address: { '@type': 'PostalAddress', addressCountry: 'TN', addressLocality: 'Tunis' },
    sameAs: [
      'https://www.guide-voyage-tunisie.com',
      'https://www.tunisia-travel-guide.com',
      'https://www.ksarjouamaa.com',
      'https://www.tunisia-trips.com',
      // Ajoute ici tes réseaux : Facebook, Instagram, TripAdvisor…
    ],
  }
}

function setMeta(attr: 'name' | 'property', key: string, content?: string) {
  if (!content) return
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.content = content
}
function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el) }
  el.href = href
}

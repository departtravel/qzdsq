// Petites aides SEO côté SPA (title, meta description, JSON-LD).
// NB : pour un référencement maximal (1re place Google), migrer la
// vitrine vers un rendu serveur (Next.js) — cf. note d'architecture.

export function setSeo(opts: { title: string; description?: string; jsonLd?: object }) {
  document.title = opts.title
  if (opts.description) setMeta('description', opts.description)

  const id = 'dts-jsonld'
  document.getElementById(id)?.remove()
  if (opts.jsonLd) {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.id = id
    s.textContent = JSON.stringify(opts.jsonLd)
    document.head.appendChild(s)
  }
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

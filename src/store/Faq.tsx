import { useEffect, useState } from 'react'
import { fetchFaqs, type Faq } from './data'

// Section FAQ (accordéon) + données structurées FAQPage pour Google.
export function FaqSection({ excursionId, titre = 'Questions fréquentes' }: { excursionId?: string; titre?: string }) {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => { fetchFaqs(excursionId).then(setFaqs) }, [excursionId])

  useEffect(() => {
    if (!faqs.length) return
    const id = 'faq-jsonld'
    document.getElementById(id)?.remove()
    const s = document.createElement('script')
    s.type = 'application/ld+json'; s.id = id
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.reponse },
      })),
    })
    document.head.appendChild(s)
    return () => { document.getElementById(id)?.remove() }
  }, [faqs])

  if (!faqs.length) return null

  return (
    <section className="mt-12">
      <h2 className="mb-5 font-display text-2xl font-extrabold text-ink-900">{titre}</h2>
      <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
        {faqs.map((f) => {
          const isOpen = open === f.id
          return (
            <div key={f.id}>
              <button onClick={() => setOpen(isOpen ? null : f.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink-900">
                {f.question}
                <span className={`shrink-0 text-brand-500 transition ${isOpen ? 'rotate-45' : ''}`}>＋</span>
              </button>
              {isOpen && <p className="px-5 pb-4 text-sm leading-relaxed text-ink-700/70">{f.reponse}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

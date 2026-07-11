import { useEffect, useState } from 'react'
import { createQuote, type QuoteType } from './data'
import { setSeo } from './seo'

const TYPES: { key: QuoteType; titre: string; emoji: string; desc: string }[] = [
  { key: 'TEAM_BUILDING', titre: 'Team building', emoji: '🤝', desc: 'Renforcez la cohésion de vos équipes : désert, mer, défis et aventures.' },
  { key: 'EVG', titre: 'EVG', emoji: '🎉', desc: 'Enterrement de vie de garçon inoubliable, 100 % sur mesure.' },
  { key: 'EVJF', titre: 'EVJF', emoji: '💃', desc: 'Enterrement de vie de jeune fille : détente, fun et souvenirs.' },
  { key: 'MARIAGE', titre: 'Mariage', emoji: '💍', desc: 'Célébrez en Tunisie — nous orchestrons toute la logistique.' },
]

export function EventsPage() {
  const [type, setType] = useState<QuoteType>('TEAM_BUILDING')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [nb, setNb] = useState('')
  const [date, setDate] = useState('')
  const [budget, setBudget] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [err, setErr] = useState('')

  useEffect(() => {
    setSeo({
      title: 'Événements sur mesure en Tunisie — Team building, EVG/EVJF, Mariage',
      description:
        'Organisez votre team building, EVG, EVJF ou mariage en Tunisie avec Depart Travel Services. Demande de devis gratuite et personnalisée.',
    })
  }, [])

  const submit = async () => {
    if (!nom || !email) { setErr('Nom et email sont requis.'); return }
    setState('sending'); setErr('')
    const res = await createQuote({
      type, client_nom: nom, client_email: email, client_telephone: tel,
      nb_personnes: nb ? Number(nb) : null, date_souhaitee: date || null,
      ville_depart: null, budget: budget ? Number(budget) : null,
      message: message || null,
    })
    if ('error' in res) { setErr(res.error); setState('form') }
    else setState('done')
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="text-3xl font-bold sm:text-4xl">Vos événements, en Tunisie, sur mesure 🎉</h1>
          <p className="mt-3 max-w-xl text-white/90">
            Team building, EVG/EVJF, mariage… Dites-nous votre projet, on vous prépare un devis gratuit.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`rounded-xl border p-5 text-left transition ${type === t.key ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white hover:shadow-md'}`}>
              <div className="text-3xl">{t.emoji}</div>
              <h3 className="mt-2 font-semibold text-slate-800">{t.titre}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Formulaire de devis */}
        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {state === 'done' ? (
            <div className="text-center">
              <div className="text-4xl">✅</div>
              <h3 className="mt-2 text-lg font-bold">Demande envoyée !</h3>
              <p className="mt-2 text-sm text-slate-500">
                Merci {nom}. Notre équipe événementielle revient vers vous très vite avec une proposition personnalisée.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-800">
                Demande de devis — {TYPES.find((t) => t.key === type)?.titre}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className={f} placeholder="Nom complet *" value={nom} onChange={(e) => setNom(e.target.value)} />
                <input className={f} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className={f} placeholder="Téléphone / WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} />
                <input className={f} type="number" min={1} placeholder="Nombre de personnes" value={nb} onChange={(e) => setNb(e.target.value)} />
                <input className={f} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <input className={f} type="number" min={0} placeholder="Budget indicatif (€)" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <textarea className={`${f} mt-3`} rows={4} placeholder="Décrivez votre projet (dates, envies, contraintes…)" value={message} onChange={(e) => setMessage(e.target.value)} />
              {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
              <button onClick={submit} disabled={state === 'sending'}
                className="mt-4 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                {state === 'sending' ? 'Envoi…' : 'Recevoir mon devis gratuit'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">Réponse sous 24-48h · sans engagement</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const f = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

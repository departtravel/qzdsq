import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createQuote } from './data'
import { setSeo } from './seo'
import type { City } from '../lib/produits'

const HEBERGEMENTS = ['Hôtel', 'Campement', 'Maison d’hôtes', 'Riad / Dar', 'Bivouac désert']
const ACTIVITES = ['Randonnée', 'Excursion 4×4', 'Balade à dos de chameau', 'Quad', 'Visite guidée culturelle', 'Détente / plage']
const VEHICULES = ['4×4', 'Minibus', 'Voiture privée avec chauffeur', 'Bus (groupe)']

const toggle = (set: Set<string>, v: string) => {
  const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n
}

export function CircuitPage() {
  const [cities, setCities] = useState<City[]>([])
  const [depart, setDepart] = useState('')
  const [dureeJours, setDureeJours] = useState(5)
  const [villes, setVilles] = useState<Set<string>>(new Set())
  const [visites, setVisites] = useState('')
  const [hebergements, setHebergements] = useState<Set<string>>(new Set())
  const [activites, setActivites] = useState<Set<string>>(new Set())
  const [vehicule, setVehicule] = useState('')
  const [specifique, setSpecifique] = useState('')

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [nb, setNb] = useState('')
  const [date, setDate] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSupabaseConfigured)
      supabase.from('cities').select('*').eq('actif', true).order('nom')
        .then(({ data }) => setCities((data as City[]) ?? []))
    setSeo({
      title: 'Circuit sur mesure en Tunisie — Devis gratuit | Depart Travel Services',
      description:
        'Composez votre circuit sur mesure en Tunisie : villes, visites, hébergements, randonnées, 4×4… Recevez un devis 100 % gratuit et personnalisé.',
    })
  }, [])

  const submit = async () => {
    if (!nom || !email) { setErr('Nom et email sont requis.'); return }
    if (villes.size === 0 && !specifique) { setErr('Ajoutez au moins une ville ou décrivez votre projet.'); return }
    setState('sending'); setErr('')
    const res = await createQuote({
      type: 'CIRCUIT',
      client_nom: nom, client_email: email, client_telephone: tel,
      nb_personnes: nb ? Number(nb) : null, date_souhaitee: date || null,
      ville_depart: depart || null, budget: null, message: specifique || null,
      details: {
        duree_jours: dureeJours,
        villes: [...villes],
        visites_souhaitees: visites,
        hebergements: [...hebergements],
        activites: [...activites],
        vehicule,
        demandes_specifiques: specifique,
      },
    })
    if ('error' in res) { setErr(res.error); setState('form') }
    else setState('done')
  }

  if (state === 'done')
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-800">Votre demande est envoyée !</h1>
        <p className="mt-2 text-slate-500">
          Merci {nom}. Notre équipe compose votre circuit sur mesure et vous envoie un
          <strong> devis gratuit</strong> sous 24-48h.
        </p>
      </div>
    )

  return (
    <div>
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">🎁 Devis 100 % gratuit</span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Composez votre circuit sur mesure</h1>
          <p className="mt-3 max-w-xl text-white/90">
            Dites-nous vos envies, on construit l’itinéraire idéal — sans engagement, sans frais.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        {/* 1. Départ + durée */}
        <Card num={1} titre="Point de départ & durée">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Lbl>Ville de départ</Lbl>
              <select value={depart} onChange={(e) => setDepart(e.target.value)} className={inp}>
                <option value="">Choisir…</option>
                {cities.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Durée : <strong>{dureeJours} jour{dureeJours > 1 ? 's' : ''}</strong></Lbl>
              <input type="range" min={1} max={21} value={dureeJours}
                onChange={(e) => setDureeJours(Number(e.target.value))} className="w-full" />
            </div>
          </div>
        </Card>

        {/* 2. Villes à visiter */}
        <Card num={2} titre="Villes / régions à inclure">
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <Pill key={c.id} on={villes.has(c.nom)} onClick={() => setVilles((s) => toggle(s, c.nom))}>{c.nom}</Pill>
            ))}
          </div>
        </Card>

        {/* 3. Visites à inclure */}
        <Card num={3} titre="Visites & sites à inclure">
          <textarea className={inp} rows={3} value={visites} onChange={(e) => setVisites(e.target.value)}
            placeholder="Ex : médina de Kairouan, oasis de Chebika, Ksar Ghilane, El Jem…" />
        </Card>

        {/* 4. Hébergement */}
        <Card num={4} titre="Type d’hébergement souhaité">
          <div className="flex flex-wrap gap-2">
            {HEBERGEMENTS.map((h) => (
              <Pill key={h} on={hebergements.has(h)} onClick={() => setHebergements((s) => toggle(s, h))}>{h}</Pill>
            ))}
          </div>
        </Card>

        {/* 5. Activités */}
        <Card num={5} titre="Activités à inclure">
          <div className="flex flex-wrap gap-2">
            {ACTIVITES.map((a) => (
              <Pill key={a} on={activites.has(a)} onClick={() => setActivites((s) => toggle(s, a))}>{a}</Pill>
            ))}
          </div>
        </Card>

        {/* 6. Véhicule + demandes spécifiques */}
        <Card num={6} titre="Transport & demandes spécifiques">
          <Lbl>Véhicule préféré</Lbl>
          <div className="mb-3 flex flex-wrap gap-2">
            {VEHICULES.map((v) => (
              <Pill key={v} on={vehicule === v} onClick={() => setVehicule(vehicule === v ? '' : v)}>{v}</Pill>
            ))}
          </div>
          <textarea className={inp} rows={3} value={specifique} onChange={(e) => setSpecifique(e.target.value)}
            placeholder="Autres demandes : régime alimentaire, accessibilité, guide francophone, budget indicatif…" />
        </Card>

        {/* 7. Coordonnées */}
        <Card num={7} titre="Vos coordonnées">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inp} placeholder="Nom complet *" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input className={inp} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inp} placeholder="Téléphone / WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} />
            <input className={inp} type="number" min={1} placeholder="Nombre de voyageurs" value={nb} onChange={(e) => setNb(e.target.value)} />
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </Card>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-sm text-emerald-700">✅ Aucune estimation automatique — un conseiller vous prépare un <strong>devis gratuit et personnalisé</strong>.</p>
          <button onClick={submit} disabled={state === 'sending'}
            className="mt-3 rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {state === 'sending' ? 'Envoi…' : 'Recevoir mon devis gratuit'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'
function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>
}
function Card({ num, titre, children }: { num: number; titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{num}</span>
        <h2 className="font-semibold text-slate-800">{titre}</h2>
      </div>
      {children}
    </div>
  )
}
function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-600 hover:border-emerald-400'}`}>
      {children}
    </button>
  )
}

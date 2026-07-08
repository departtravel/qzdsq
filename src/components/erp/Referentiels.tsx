import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

// ------------------------------------------------------------------
// Module RÉFÉRENTIELS — CRUD léger des bases prestataires DTS.
// Onglets internes : Guides, Chauffeurs, Restaurants, Hébergements,
// Extras, Transports, Véhicules ERP.
// Règle métier : tout prestataire (guide/chauffeur/restaurant/transport)
// est aussi créé comme fournisseur (table suppliers).
// ------------------------------------------------------------------

// ----- Types locaux (lecture seule / miroir du schéma erp.sql) -----
interface Guide {
  id: string
  nom: string
  prenom: string | null
  langues: string[] | null
  type_guide: string
  salaire_mensuel: number | null
}
interface Chauffeur {
  id: string
  nom: string
  prenom: string | null
  telephone: string | null
  type_chauffeur: string
  tarif_jour: number | null
}
interface Restaurant {
  id: string
  nom: string
  ville: string | null
}
interface Accommodation {
  id: string
  nom: string
  type: string
  ville: string | null
}
interface Extra {
  id: string
  nom: string
  categorie: string | null
  type_tarification: string
  prix_achat: number | null
  prix_vente: number | null
  inclure_comptabilite: boolean
  capacite: number | null
}
interface Transport {
  id: string
  nom: string
  type_transport: string
  telephone: string | null
  tarif_sortie: number | null
}
interface Vehicle {
  id: string
  immatriculation: string | null
  type: string | null
  capacite: number | null
  transport_id: string | null
}

type TabKey =
  | 'guides'
  | 'chauffeurs'
  | 'restaurants'
  | 'accommodations'
  | 'extras'
  | 'transports'
  | 'vehicles'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'guides', label: 'Guides' },
  { key: 'chauffeurs', label: 'Chauffeurs' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'accommodations', label: 'Hébergements' },
  { key: 'extras', label: 'Extras' },
  { key: 'transports', label: 'Transports' },
  { key: 'vehicles', label: 'Véhicules ERP' },
]

// Insère un fournisseur lié — "tout prestataire devient fournisseur".
async function creerFournisseur(nom: string, type: string, telephone?: string | null) {
  await supabase.from('suppliers').insert({ nom, type, telephone: telephone ?? null })
}

export function Referentiels() {
  const [tab, setTab] = useState<TabKey>('guides')

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Référentiels prestataires</h2>

      {/* Sous-navigation */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 shadow hover:bg-blue-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'guides' && <GuidesPanel />}
      {tab === 'chauffeurs' && <ChauffeursPanel />}
      {tab === 'restaurants' && <RestaurantsPanel />}
      {tab === 'accommodations' && <AccommodationsPanel />}
      {tab === 'extras' && <ExtrasPanel />}
      {tab === 'transports' && <TransportsPanel />}
      {tab === 'vehicles' && <VehiclesPanel />}
    </div>
  )
}

// ----- Éléments UI partagés (définis localement) -----
function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-white p-4 shadow">{children}</div>
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

function SubmitBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      {children}
    </button>
  )
}

function Feedback({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <p className="px-3 py-4 text-sm text-slate-500">Aucun {label} pour l’instant.</p>
}

// ==================================================================
// GUIDES
// ==================================================================
function GuidesPanel() {
  const [rows, setRows] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [langues, setLangues] = useState('')
  const [typeGuide, setTypeGuide] = useState('EXTRA')
  const [salaire, setSalaire] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('guides')
      .select('id,nom,prenom,langues,type_guide,salaire_mensuel')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Guide[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const languesArr = langues
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const { data, error } = await supabase
      .from('guides')
      .insert({
        nom: nom.trim(),
        prenom: prenom.trim() || null,
        langues: languesArr.length ? languesArr : null,
        type_guide: typeGuide,
        salaire_mensuel: salaire ? Number(salaire) : null,
      })
      .select('id')
      .single()
    if (error) {
      setError(error.message)
      return
    }
    await supabase.from('guide_prices').insert({ guide_id: (data as { id: string }).id })
    await creerFournisseur(`${nom.trim()} ${prenom.trim()}`.trim(), 'GUIDE')
    setNom('')
    setPrenom('')
    setLangues('')
    setSalaire('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouveau guide</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Prénom">
            <input className={inputCls} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </Field>
          <Field label="Langues (séparées par des virgules)">
            <input
              className={inputCls}
              value={langues}
              onChange={(e) => setLangues(e.target.value)}
              placeholder="français, anglais, arabe"
            />
          </Field>
          <Field label="Type de guide">
            <select className={inputCls} value={typeGuide} onChange={(e) => setTypeGuide(e.target.value)}>
              <option value="EXTRA">EXTRA</option>
              <option value="SALARIE">SALARIE</option>
            </select>
          </Field>
          <Field label="Salaire mensuel (TND)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={salaire}
              onChange={(e) => setSalaire(e.target.value)}
            />
          </Field>
          <SubmitBtn>Ajouter le guide</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Guides ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="guide" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Langues</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1 text-right">Salaire</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="px-2 py-1">
                      {g.nom} {g.prenom ?? ''}
                    </td>
                    <td className="px-2 py-1 text-slate-500">{(g.langues ?? []).join(', ')}</td>
                    <td className="px-2 py-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {g.type_guide}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {g.salaire_mensuel != null ? `${g.salaire_mensuel} TND` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// CHAUFFEURS
// ==================================================================
function ChauffeursPanel() {
  const [rows, setRows] = useState<Chauffeur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [type, setType] = useState('EXTRA')
  const [tarifJour, setTarifJour] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chauffeurs')
      .select('id,nom,prenom,telephone,type_chauffeur,tarif_jour')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Chauffeur[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase.from('chauffeurs').insert({
      nom: nom.trim(),
      prenom: prenom.trim() || null,
      telephone: telephone.trim() || null,
      type_chauffeur: type,
      tarif_jour: tarifJour ? Number(tarifJour) : null,
    })
    if (error) {
      setError(error.message)
      return
    }
    await creerFournisseur(`${nom.trim()} ${prenom.trim()}`.trim(), 'CHAUFFEUR', telephone.trim() || null)
    setNom('')
    setPrenom('')
    setTelephone('')
    setTarifJour('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouveau chauffeur</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Prénom">
            <input className={inputCls} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <input className={inputCls} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="EXTRA">EXTRA</option>
              <option value="SALARIE">SALARIE</option>
            </select>
          </Field>
          <Field label="Tarif / jour (DT)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={tarifJour}
              onChange={(e) => setTarifJour(e.target.value)}
            />
          </Field>
          <SubmitBtn>Ajouter le chauffeur</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Chauffeurs ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="chauffeur" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Téléphone</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1 text-right">Tarif/jour</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-2 py-1">
                      {c.nom} {c.prenom ?? ''}
                    </td>
                    <td className="px-2 py-1 text-slate-500">{c.telephone ?? '—'}</td>
                    <td className="px-2 py-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {c.type_chauffeur}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {c.tarif_jour != null ? `${c.tarif_jour} DT` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// RESTAURANTS (+ restaurant_prices)
// ==================================================================
function RestaurantsPanel() {
  const [rows, setRows] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [ville, setVille] = useState('')
  const [prixAdulte, setPrixAdulte] = useState('')
  const [prixEnfant, setPrixEnfant] = useState('')
  const [prixBebe, setPrixBebe] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,nom,ville')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Restaurant[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { data, error } = await supabase
      .from('restaurants')
      .insert({ nom: nom.trim(), ville: ville.trim() || null })
      .select('id')
      .single()
    if (error) {
      setError(error.message)
      return
    }
    await supabase.from('restaurant_prices').insert({
      restaurant_id: (data as { id: string }).id,
      prix_adulte: prixAdulte ? Number(prixAdulte) : 0,
      prix_enfant: prixEnfant ? Number(prixEnfant) : 0,
      prix_bebe: prixBebe ? Number(prixBebe) : 0,
    })
    await creerFournisseur(nom.trim(), 'RESTAURANT')
    setNom('')
    setVille('')
    setPrixAdulte('')
    setPrixEnfant('')
    setPrixBebe('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouveau restaurant</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Ville">
            <input className={inputCls} value={ville} onChange={(e) => setVille(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prix adulte">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixAdulte}
                onChange={(e) => setPrixAdulte(e.target.value)}
              />
            </Field>
            <Field label="Prix enfant">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixEnfant}
                onChange={(e) => setPrixEnfant(e.target.value)}
              />
            </Field>
            <Field label="Prix bébé">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixBebe}
                onChange={(e) => setPrixBebe(e.target.value)}
              />
            </Field>
          </div>
          <SubmitBtn>Ajouter le restaurant</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Restaurants ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="restaurant" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Ville</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-2 py-1">{r.nom}</td>
                    <td className="px-2 py-1 text-slate-500">{r.ville ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// HÉBERGEMENTS (+ accommodation_prices)
// ==================================================================
function AccommodationsPanel() {
  const [rows, setRows] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [type, setType] = useState('HOTEL')
  const [ville, setVille] = useState('')
  const [prixAdulte, setPrixAdulte] = useState('')
  const [prixEnfant, setPrixEnfant] = useState('')
  const [prixBebe, setPrixBebe] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accommodations')
      .select('id,nom,type,ville')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Accommodation[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { data, error } = await supabase
      .from('accommodations')
      .insert({ nom: nom.trim(), type, ville: ville.trim() || null })
      .select('id')
      .single()
    if (error) {
      setError(error.message)
      return
    }
    await supabase.from('accommodation_prices').insert({
      accommodation_id: (data as { id: string }).id,
      prix_adulte: prixAdulte ? Number(prixAdulte) : 0,
      prix_enfant: prixEnfant ? Number(prixEnfant) : 0,
      prix_bebe: prixBebe ? Number(prixBebe) : 0,
    })
    await creerFournisseur(nom.trim(), 'HOTEL')
    setNom('')
    setVille('')
    setPrixAdulte('')
    setPrixEnfant('')
    setPrixBebe('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouvel hébergement</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOTEL">HOTEL</option>
              <option value="CAMP">CAMP</option>
              <option value="TENTE">TENTE</option>
            </select>
          </Field>
          <Field label="Ville">
            <input className={inputCls} value={ville} onChange={(e) => setVille(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prix adulte">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixAdulte}
                onChange={(e) => setPrixAdulte(e.target.value)}
              />
            </Field>
            <Field label="Prix enfant">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixEnfant}
                onChange={(e) => setPrixEnfant(e.target.value)}
              />
            </Field>
            <Field label="Prix bébé">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixBebe}
                onChange={(e) => setPrixBebe(e.target.value)}
              />
            </Field>
          </div>
          <SubmitBtn>Ajouter l’hébergement</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Hébergements ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="hébergement" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Ville</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-2 py-1">{a.nom}</td>
                    <td className="px-2 py-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {a.type}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-slate-500">{a.ville ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// EXTRAS
// ==================================================================
function ExtrasPanel() {
  const [rows, setRows] = useState<Extra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('')
  const [typeTarif, setTypeTarif] = useState('PAR_PERSONNE')
  const [prixAchat, setPrixAchat] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [inclureCompta, setInclureCompta] = useState(true)
  const [capacite, setCapacite] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('extras')
      .select('id,nom,categorie,type_tarification,prix_achat,prix_vente,inclure_comptabilite,capacite')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Extra[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase.from('extras').insert({
      nom: nom.trim(),
      categorie: categorie.trim() || null,
      type_tarification: typeTarif,
      prix_achat: prixAchat ? Number(prixAchat) : 0,
      prix_vente: prixVente ? Number(prixVente) : 0,
      inclure_comptabilite: inclureCompta,
      capacite: capacite ? Number(capacite) : null,
    })
    if (error) {
      setError(error.message)
      return
    }
    setNom('')
    setCategorie('')
    setPrixAchat('')
    setPrixVente('')
    setCapacite('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouvel extra</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Catégorie">
            <input className={inputCls} value={categorie} onChange={(e) => setCategorie(e.target.value)} />
          </Field>
          <Field label="Type de tarification">
            <select className={inputCls} value={typeTarif} onChange={(e) => setTypeTarif(e.target.value)}>
              <option value="PAR_PERSONNE">PAR_PERSONNE</option>
              <option value="PAR_VEHICULE">PAR_VEHICULE</option>
              <option value="PAR_GROUPE">PAR_GROUPE</option>
              <option value="MANUEL">MANUEL</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prix achat">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixAchat}
                onChange={(e) => setPrixAchat(e.target.value)}
              />
            </Field>
            <Field label="Prix vente">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={prixVente}
                onChange={(e) => setPrixVente(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Capacité (si PAR_VEHICULE)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={inclureCompta}
              onChange={(e) => setInclureCompta(e.target.checked)}
            />
            Inclure dans la comptabilité
          </label>
          <SubmitBtn>Ajouter l’extra</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Extras ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="extra" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Catégorie</th>
                  <th className="px-2 py-1">Tarif</th>
                  <th className="px-2 py-1 text-right">Achat</th>
                  <th className="px-2 py-1 text-right">Vente</th>
                  <th className="px-2 py-1 text-center">Compta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="px-2 py-1">{x.nom}</td>
                    <td className="px-2 py-1 text-slate-500">{x.categorie ?? '—'}</td>
                    <td className="px-2 py-1 text-xs text-slate-500">{x.type_tarification}</td>
                    <td className="px-2 py-1 text-right">{x.prix_achat ?? 0}</td>
                    <td className="px-2 py-1 text-right">{x.prix_vente ?? 0}</td>
                    <td className="px-2 py-1 text-center">{x.inclure_comptabilite ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// TRANSPORTS
// ==================================================================
function TransportsPanel() {
  const [rows, setRows] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [type, setType] = useState('PRESTATAIRE')
  const [telephone, setTelephone] = useState('')
  const [tarifSortie, setTarifSortie] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transports')
      .select('id,nom,type_transport,telephone,tarif_sortie')
      .order('nom')
    if (error) setError(error.message)
    setRows((data as Transport[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase.from('transports').insert({
      nom: nom.trim(),
      type_transport: type,
      telephone: telephone.trim() || null,
      tarif_sortie: tarifSortie ? Number(tarifSortie) : null,
    })
    if (error) {
      setError(error.message)
      return
    }
    await creerFournisseur(nom.trim(), 'TRANSPORT', telephone.trim() || null)
    setNom('')
    setTelephone('')
    setTarifSortie('')
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouveau transporteur</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Type de transport">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="FLOTTE_INTERNE">FLOTTE_INTERNE</option>
              <option value="LOCATION_LONGUE_DUREE">LOCATION_LONGUE_DUREE</option>
              <option value="LOCATION_EXCURSION">LOCATION_EXCURSION</option>
              <option value="PRESTATAIRE">PRESTATAIRE</option>
            </select>
          </Field>
          <Field label="Téléphone">
            <input className={inputCls} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </Field>
          <Field label="Tarif / sortie (DT)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={tarifSortie}
              onChange={(e) => setTarifSortie(e.target.value)}
            />
          </Field>
          <SubmitBtn>Ajouter le transporteur</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Transporteurs ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="transporteur" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Nom</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Téléphone</th>
                  <th className="px-2 py-1 text-right">Tarif/sortie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-2 py-1">{t.nom}</td>
                    <td className="px-2 py-1 text-xs text-slate-500">{t.type_transport}</td>
                    <td className="px-2 py-1 text-slate-500">{t.telephone ?? '—'}</td>
                    <td className="px-2 py-1 text-right">
                      {t.tarif_sortie != null ? `${t.tarif_sortie} DT` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================================================================
// VÉHICULES ERP
// ==================================================================
function VehiclesPanel() {
  const [rows, setRows] = useState<Vehicle[]>([])
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [immat, setImmat] = useState('')
  const [type, setType] = useState('van')
  const [capacite, setCapacite] = useState('')
  const [transportId, setTransportId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: veh, error: vErr }, { data: tr }] = await Promise.all([
      supabase.from('erp_vehicles').select('id,immatriculation,type,capacite,transport_id').order('immatriculation'),
      supabase.from('transports').select('id,nom,type_transport,telephone,tarif_sortie').order('nom'),
    ])
    if (vErr) setError(vErr.message)
    setRows((veh as Vehicle[]) ?? [])
    setTransports((tr as Transport[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!immat.trim()) {
      setError('L’immatriculation est obligatoire.')
      return
    }
    const { error } = await supabase.from('erp_vehicles').insert({
      immatriculation: immat.trim(),
      type,
      capacite: capacite ? Number(capacite) : null,
      transport_id: transportId || null,
    })
    if (error) {
      setError(error.message)
      return
    }
    setImmat('')
    setCapacite('')
    setTransportId('')
    load()
  }

  const transportNom = (id: string | null) =>
    id ? (transports.find((t) => t.id === id)?.nom ?? '—') : '—'

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Nouveau véhicule ERP</h3>
        <Feedback error={error} />
        <form onSubmit={add} className="grid gap-3">
          <Field label="Immatriculation *">
            <input className={inputCls} value={immat} onChange={(e) => setImmat(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="berline">berline</option>
              <option value="van">van</option>
              <option value="minibus">minibus</option>
              <option value="coaster">coaster</option>
              <option value="bus">bus</option>
            </select>
          </Field>
          <Field label="Capacité">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
            />
          </Field>
          <Field label="Transporteur">
            <select className={inputCls} value={transportId} onChange={(e) => setTransportId(e.target.value)}>
              <option value="">— aucun —</option>
              {transports.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>
          </Field>
          <SubmitBtn>Ajouter le véhicule</SubmitBtn>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Véhicules ERP ({rows.length})</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <Empty label="véhicule" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Immatriculation</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1 text-right">Capacité</th>
                  <th className="px-2 py-1">Transporteur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="px-2 py-1 font-mono text-xs">{v.immatriculation ?? '—'}</td>
                    <td className="px-2 py-1">{v.type ?? '—'}</td>
                    <td className="px-2 py-1 text-right">{v.capacite ?? '—'}</td>
                    <td className="px-2 py-1 text-slate-500">{transportNom(v.transport_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

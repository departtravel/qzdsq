import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { confirmAdmin } from '../../lib/adminGuard'

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
  telephone: string | null
  email: string | null
  adresse: string | null
  matricule_fiscal: string | null
}
interface Chauffeur {
  id: string
  nom: string
  prenom: string | null
  telephone: string | null
  type_chauffeur: string
  tarif_jour: number | null
  email: string | null
  adresse: string | null
  matricule_fiscal: string | null
}
interface Restaurant {
  id: string
  nom: string
  ville: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  matricule_fiscal: string | null
}
interface Accommodation {
  id: string
  nom: string
  type: string
  ville: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  matricule_fiscal: string | null
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
  prestataire_type: string | null
  prestataire_id: string | null
}

// Un prestataire rattachable à un extra (miroir de ensure_supplier).
interface PrestataireRef {
  type: 'HEBERGEMENT' | 'RESTAURANT' | 'TRANSPORT' | 'GUIDE' | 'CHAUFFEUR'
  id: string
  label: string
}
interface Transport {
  id: string
  nom: string
  type_transport: string
  telephone: string | null
  tarif_sortie: number | null
  email: string | null
  adresse: string | null
  matricule_fiscal: string | null
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

// Charge tous les prestataires rattachables à un extra (hébergements,
// restaurants, transports, guides, chauffeurs).
async function chargerPrestataires(): Promise<PrestataireRef[]> {
  const [acc, resto, tr, gu, ch] = await Promise.all([
    supabase.from('accommodations').select('id,nom').order('nom'),
    supabase.from('restaurants').select('id,nom').order('nom'),
    supabase.from('transports').select('id,nom').order('nom'),
    supabase.from('guides').select('id,nom,prenom').order('nom'),
    supabase.from('chauffeurs').select('id,nom,prenom').order('nom'),
  ])
  const out: PrestataireRef[] = []
  for (const a of (acc.data as { id: string; nom: string }[]) ?? [])
    out.push({ type: 'HEBERGEMENT', id: a.id, label: `Hébergement · ${a.nom}` })
  for (const r of (resto.data as { id: string; nom: string }[]) ?? [])
    out.push({ type: 'RESTAURANT', id: r.id, label: `Restaurant · ${r.nom}` })
  for (const t of (tr.data as { id: string; nom: string }[]) ?? [])
    out.push({ type: 'TRANSPORT', id: t.id, label: `Transport · ${t.nom}` })
  for (const g of (gu.data as { id: string; nom: string; prenom: string | null }[]) ?? [])
    out.push({ type: 'GUIDE', id: g.id, label: `Guide · ${g.nom} ${g.prenom ?? ''}`.trim() })
  for (const c of (ch.data as { id: string; nom: string; prenom: string | null }[]) ?? [])
    out.push({ type: 'CHAUFFEUR', id: c.id, label: `Chauffeur · ${c.nom} ${c.prenom ?? ''}`.trim() })
  return out
}
const prestKey = (type: string, id: string) => `${type}:${id}`

// Supprime une ligne (avec confirmation) puis recharge la liste.
async function supprimerLigne(
  table: string,
  id: string,
  setError: (m: string | null) => void,
  reload: () => void,
) {
  if (!(await confirmAdmin('la suppression définitive de cette entrée'))) return
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    setError(error.message)
    return
  }
  reload()
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

// Version compacte pour l'édition en ligne dans les tableaux.
const editInputCls =
  'w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none'

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

// Boutons Modifier / Supprimer affichés sur chaque ligne.
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      <button
        type="button"
        onClick={onEdit}
        className="rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
      >
        Modifier
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Supprimer
      </button>
    </div>
  )
}

// Boutons Enregistrer / Annuler affichés en mode édition.
function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      <button
        type="button"
        onClick={onSave}
        className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700"
      >
        Enregistrer
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-300"
      >
        Annuler
      </button>
    </div>
  )
}

// ==================================================================
// GUIDES
// ==================================================================
interface GuideDraft {
  nom: string
  prenom: string
  langues: string
  type_guide: string
  salaire_mensuel: string
  telephone: string
  email: string
  adresse: string
  matricule_fiscal: string
}

function GuidesPanel() {
  const [rows, setRows] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [langues, setLangues] = useState('')
  const [typeGuide, setTypeGuide] = useState('EXTRA')
  const [salaire, setSalaire] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [matricule, setMatricule] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<GuideDraft>({
    nom: '',
    prenom: '',
    langues: '',
    type_guide: 'EXTRA',
    salaire_mensuel: '',
    telephone: '',
    email: '',
    adresse: '',
    matricule_fiscal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('guides')
      .select('id,nom,prenom,langues,type_guide,salaire_mensuel,telephone,email,adresse,matricule_fiscal')
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
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        adresse: adresse.trim() || null,
        matricule_fiscal: matricule.trim() || null,
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
    setTelephone('')
    setEmail('')
    setAdresse('')
    setMatricule('')
    load()
  }

  function startEdit(g: Guide) {
    setError(null)
    setEditId(g.id)
    setDraft({
      nom: g.nom,
      prenom: g.prenom ?? '',
      langues: (g.langues ?? []).join(', '),
      type_guide: g.type_guide,
      salaire_mensuel: g.salaire_mensuel != null ? String(g.salaire_mensuel) : '',
      telephone: g.telephone ?? '',
      email: g.email ?? '',
      adresse: g.adresse ?? '',
      matricule_fiscal: g.matricule_fiscal ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const languesArr = draft.langues
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const { error } = await supabase
      .from('guides')
      .update({
        nom: draft.nom.trim(),
        prenom: draft.prenom.trim() || null,
        langues: languesArr.length ? languesArr : null,
        type_guide: draft.type_guide,
        salaire_mensuel: draft.salaire_mensuel ? Number(draft.salaire_mensuel) : null,
        telephone: draft.telephone.trim() || null,
        email: draft.email.trim() || null,
        adresse: draft.adresse.trim() || null,
        matricule_fiscal: draft.matricule_fiscal.trim() || null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone">
              <input className={inputCls} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse">
            <input className={inputCls} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <Field label="Matricule fiscal">
            <input className={inputCls} value={matricule} onChange={(e) => setMatricule(e.target.value)} />
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
                  <th className="px-2 py-1">Coordonnées / M.F.</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) =>
                  editId === g.id ? (
                    <tr key={g.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <input
                            className={editInputCls}
                            value={draft.nom}
                            onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                            placeholder="Nom"
                          />
                          <input
                            className={editInputCls}
                            value={draft.prenom}
                            onChange={(e) => setDraft({ ...draft, prenom: e.target.value })}
                            placeholder="Prénom"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.langues}
                          onChange={(e) => setDraft({ ...draft, langues: e.target.value })}
                          placeholder="fr, en"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type_guide}
                          onChange={(e) => setDraft({ ...draft, type_guide: e.target.value })}
                        >
                          <option value="EXTRA">EXTRA</option>
                          <option value="SALARIE">SALARIE</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.salaire_mensuel}
                          onChange={(e) => setDraft({ ...draft, salaire_mensuel: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="grid gap-1">
                          <input className={editInputCls} placeholder="Téléphone" value={draft.telephone}
                            onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} />
                          <input className={editInputCls} placeholder="E-mail" value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                          <input className={editInputCls} placeholder="Adresse" value={draft.adresse}
                            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} />
                          <input className={editInputCls} placeholder="Matricule fiscal" value={draft.matricule_fiscal}
                            onChange={(e) => setDraft({ ...draft, matricule_fiscal: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
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
                      <td className="px-2 py-1 text-xs text-slate-500">
                        {g.telephone && <div>{g.telephone}</div>}
                        {g.email && <div>{g.email}</div>}
                        {g.adresse && <div>{g.adresse}</div>}
                        {g.matricule_fiscal && <div>M.F. {g.matricule_fiscal}</div>}
                        {!g.telephone && !g.email && !g.adresse && !g.matricule_fiscal && '—'}
                      </td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(g)}
                          onDelete={() => supprimerLigne('guides', g.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface ChauffeurDraft {
  nom: string
  prenom: string
  telephone: string
  type_chauffeur: string
  tarif_jour: string
  email: string
  adresse: string
  matricule_fiscal: string
}

function ChauffeursPanel() {
  const [rows, setRows] = useState<Chauffeur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [type, setType] = useState('EXTRA')
  const [tarifJour, setTarifJour] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [matricule, setMatricule] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ChauffeurDraft>({
    nom: '',
    prenom: '',
    telephone: '',
    type_chauffeur: 'EXTRA',
    tarif_jour: '',
    email: '',
    adresse: '',
    matricule_fiscal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chauffeurs')
      .select('id,nom,prenom,telephone,type_chauffeur,tarif_jour,email,adresse,matricule_fiscal')
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
      email: email.trim() || null,
      adresse: adresse.trim() || null,
      matricule_fiscal: matricule.trim() || null,
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
    setEmail('')
    setAdresse('')
    setMatricule('')
    load()
  }

  function startEdit(c: Chauffeur) {
    setError(null)
    setEditId(c.id)
    setDraft({
      nom: c.nom,
      prenom: c.prenom ?? '',
      telephone: c.telephone ?? '',
      type_chauffeur: c.type_chauffeur,
      tarif_jour: c.tarif_jour != null ? String(c.tarif_jour) : '',
      email: c.email ?? '',
      adresse: c.adresse ?? '',
      matricule_fiscal: c.matricule_fiscal ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase
      .from('chauffeurs')
      .update({
        nom: draft.nom.trim(),
        prenom: draft.prenom.trim() || null,
        telephone: draft.telephone.trim() || null,
        type_chauffeur: draft.type_chauffeur,
        tarif_jour: draft.tarif_jour ? Number(draft.tarif_jour) : null,
        email: draft.email.trim() || null,
        adresse: draft.adresse.trim() || null,
        matricule_fiscal: draft.matricule_fiscal.trim() || null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <Field label="E-mail">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <Field label="Matricule fiscal">
            <input className={inputCls} value={matricule} onChange={(e) => setMatricule(e.target.value)} />
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
                  <th className="px-2 py-1">Coordonnées / M.F.</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) =>
                  editId === c.id ? (
                    <tr key={c.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <input
                            className={editInputCls}
                            value={draft.nom}
                            onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                            placeholder="Nom"
                          />
                          <input
                            className={editInputCls}
                            value={draft.prenom}
                            onChange={(e) => setDraft({ ...draft, prenom: e.target.value })}
                            placeholder="Prénom"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.telephone}
                          onChange={(e) => setDraft({ ...draft, telephone: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type_chauffeur}
                          onChange={(e) => setDraft({ ...draft, type_chauffeur: e.target.value })}
                        >
                          <option value="EXTRA">EXTRA</option>
                          <option value="SALARIE">SALARIE</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.tarif_jour}
                          onChange={(e) => setDraft({ ...draft, tarif_jour: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="grid gap-1">
                          <input className={editInputCls} placeholder="E-mail" value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                          <input className={editInputCls} placeholder="Adresse" value={draft.adresse}
                            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} />
                          <input className={editInputCls} placeholder="Matricule fiscal" value={draft.matricule_fiscal}
                            onChange={(e) => setDraft({ ...draft, matricule_fiscal: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
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
                      <td className="px-2 py-1 text-xs text-slate-500">
                        {c.email && <div>{c.email}</div>}
                        {c.adresse && <div>{c.adresse}</div>}
                        {c.matricule_fiscal && <div>M.F. {c.matricule_fiscal}</div>}
                        {!c.email && !c.adresse && !c.matricule_fiscal && '—'}
                      </td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(c)}
                          onDelete={() => supprimerLigne('chauffeurs', c.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface RestaurantDraft {
  nom: string
  ville: string
  telephone: string
  email: string
  adresse: string
  matricule_fiscal: string
}

function RestaurantsPanel() {
  const [rows, setRows] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [ville, setVille] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [matricule, setMatricule] = useState('')
  const [prixAdulte, setPrixAdulte] = useState('')
  const [prixEnfant, setPrixEnfant] = useState('')
  const [prixBebe, setPrixBebe] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RestaurantDraft>({
    nom: '', ville: '', telephone: '', email: '', adresse: '', matricule_fiscal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,nom,ville,telephone,email,adresse,matricule_fiscal')
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
      .insert({
        nom: nom.trim(), ville: ville.trim() || null,
        telephone: telephone.trim() || null, email: email.trim() || null,
        adresse: adresse.trim() || null, matricule_fiscal: matricule.trim() || null,
      })
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
    setTelephone('')
    setEmail('')
    setAdresse('')
    setMatricule('')
    setPrixAdulte('')
    setPrixEnfant('')
    setPrixBebe('')
    load()
  }

  function startEdit(r: Restaurant) {
    setError(null)
    setEditId(r.id)
    setDraft({
      nom: r.nom, ville: r.ville ?? '',
      telephone: r.telephone ?? '', email: r.email ?? '',
      adresse: r.adresse ?? '', matricule_fiscal: r.matricule_fiscal ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase
      .from('restaurants')
      .update({
        nom: draft.nom.trim(), ville: draft.ville.trim() || null,
        telephone: draft.telephone.trim() || null, email: draft.email.trim() || null,
        adresse: draft.adresse.trim() || null, matricule_fiscal: draft.matricule_fiscal.trim() || null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone">
              <input className={inputCls} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse">
            <input className={inputCls} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <Field label="Matricule fiscal">
            <input className={inputCls} value={matricule} onChange={(e) => setMatricule(e.target.value)} />
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
                  <th className="px-2 py-1">Coordonnées / M.F.</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  editId === r.id ? (
                    <tr key={r.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.nom}
                          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.ville}
                          onChange={(e) => setDraft({ ...draft, ville: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="grid gap-1">
                          <input className={editInputCls} placeholder="Téléphone" value={draft.telephone}
                            onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} />
                          <input className={editInputCls} placeholder="E-mail" value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                          <input className={editInputCls} placeholder="Adresse" value={draft.adresse}
                            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} />
                          <input className={editInputCls} placeholder="Matricule fiscal" value={draft.matricule_fiscal}
                            onChange={(e) => setDraft({ ...draft, matricule_fiscal: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-1">{r.nom}</td>
                      <td className="px-2 py-1 text-slate-500">{r.ville ?? '—'}</td>
                      <td className="px-2 py-1 text-xs text-slate-500">
                        {r.telephone && <div>{r.telephone}</div>}
                        {r.email && <div>{r.email}</div>}
                        {r.adresse && <div>{r.adresse}</div>}
                        {r.matricule_fiscal && <div>M.F. {r.matricule_fiscal}</div>}
                        {!r.telephone && !r.email && !r.adresse && !r.matricule_fiscal && '—'}
                      </td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(r)}
                          onDelete={() => supprimerLigne('restaurants', r.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface AccommodationDraft {
  nom: string
  type: string
  ville: string
  telephone: string
  email: string
  adresse: string
  matricule_fiscal: string
}

function AccommodationsPanel() {
  const [rows, setRows] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [type, setType] = useState('HOTEL')
  const [ville, setVille] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [matricule, setMatricule] = useState('')
  const [prixAdulte, setPrixAdulte] = useState('')
  const [prixEnfant, setPrixEnfant] = useState('')
  const [prixBebe, setPrixBebe] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AccommodationDraft>({
    nom: '', type: 'HOTEL', ville: '', telephone: '', email: '', adresse: '', matricule_fiscal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accommodations')
      .select('id,nom,type,ville,telephone,email,adresse,matricule_fiscal')
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
      .insert({
        nom: nom.trim(), type, ville: ville.trim() || null,
        telephone: telephone.trim() || null, email: email.trim() || null,
        adresse: adresse.trim() || null, matricule_fiscal: matricule.trim() || null,
      })
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
    setTelephone('')
    setEmail('')
    setAdresse('')
    setMatricule('')
    setPrixAdulte('')
    setPrixEnfant('')
    setPrixBebe('')
    load()
  }

  function startEdit(a: Accommodation) {
    setError(null)
    setEditId(a.id)
    setDraft({
      nom: a.nom, type: a.type, ville: a.ville ?? '',
      telephone: a.telephone ?? '', email: a.email ?? '',
      adresse: a.adresse ?? '', matricule_fiscal: a.matricule_fiscal ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase
      .from('accommodations')
      .update({
        nom: draft.nom.trim(), type: draft.type, ville: draft.ville.trim() || null,
        telephone: draft.telephone.trim() || null, email: draft.email.trim() || null,
        adresse: draft.adresse.trim() || null, matricule_fiscal: draft.matricule_fiscal.trim() || null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone">
              <input className={inputCls} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse">
            <input className={inputCls} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <Field label="Matricule fiscal">
            <input className={inputCls} value={matricule} onChange={(e) => setMatricule(e.target.value)} />
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
                  <th className="px-2 py-1">Coordonnées / M.F.</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) =>
                  editId === a.id ? (
                    <tr key={a.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.nom}
                          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type}
                          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                        >
                          <option value="HOTEL">HOTEL</option>
                          <option value="CAMP">CAMP</option>
                          <option value="TENTE">TENTE</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.ville}
                          onChange={(e) => setDraft({ ...draft, ville: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="grid gap-1">
                          <input className={editInputCls} placeholder="Téléphone" value={draft.telephone}
                            onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} />
                          <input className={editInputCls} placeholder="E-mail" value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                          <input className={editInputCls} placeholder="Adresse" value={draft.adresse}
                            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} />
                          <input className={editInputCls} placeholder="Matricule fiscal" value={draft.matricule_fiscal}
                            onChange={(e) => setDraft({ ...draft, matricule_fiscal: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-2 py-1">{a.nom}</td>
                      <td className="px-2 py-1">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {a.type}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-slate-500">{a.ville ?? '—'}</td>
                      <td className="px-2 py-1 text-xs text-slate-500">
                        {a.telephone && <div>{a.telephone}</div>}
                        {a.email && <div>{a.email}</div>}
                        {a.adresse && <div>{a.adresse}</div>}
                        {a.matricule_fiscal && <div>M.F. {a.matricule_fiscal}</div>}
                        {!a.telephone && !a.email && !a.adresse && !a.matricule_fiscal && '—'}
                      </td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(a)}
                          onDelete={() => supprimerLigne('accommodations', a.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface ExtraDraft {
  nom: string
  categorie: string
  type_tarification: string
  prix_achat: string
  prix_vente: string
  inclure_comptabilite: boolean
  prestataire: string // "TYPE:id" ou ''
}

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
  const [prestataire, setPrestataire] = useState('') // "TYPE:id" ou ''
  const [prestataires, setPrestataires] = useState<PrestataireRef[]>([])

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ExtraDraft>({
    nom: '',
    categorie: '',
    type_tarification: 'PAR_PERSONNE',
    prix_achat: '',
    prix_vente: '',
    inclure_comptabilite: true,
    prestataire: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data, error }, prests] = await Promise.all([
      supabase
        .from('extras')
        .select('id,nom,categorie,type_tarification,prix_achat,prix_vente,inclure_comptabilite,capacite,prestataire_type,prestataire_id')
        .order('nom'),
      chargerPrestataires(),
    ])
    if (error) setError(error.message)
    setRows((data as Extra[]) ?? [])
    setPrestataires(prests)
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const prestLabel = (type: string | null, id: string | null) => {
    if (!type || !id) return '—'
    return prestataires.find((p) => p.type === type && p.id === id)?.label ?? `${type}`
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const [ptype, pid] = prestataire ? prestataire.split(':') : [null, null]
    const { error } = await supabase.from('extras').insert({
      nom: nom.trim(),
      categorie: categorie.trim() || null,
      type_tarification: typeTarif,
      prix_achat: prixAchat ? Number(prixAchat) : 0,
      prix_vente: prixVente ? Number(prixVente) : 0,
      inclure_comptabilite: inclureCompta,
      capacite: capacite ? Number(capacite) : null,
      prestataire_type: ptype,
      prestataire_id: pid,
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
    setPrestataire('')
    load()
  }

  function startEdit(x: Extra) {
    setError(null)
    setEditId(x.id)
    setDraft({
      nom: x.nom,
      categorie: x.categorie ?? '',
      type_tarification: x.type_tarification,
      prix_achat: x.prix_achat != null ? String(x.prix_achat) : '',
      prix_vente: x.prix_vente != null ? String(x.prix_vente) : '',
      inclure_comptabilite: x.inclure_comptabilite,
      prestataire: x.prestataire_type && x.prestataire_id ? prestKey(x.prestataire_type, x.prestataire_id) : '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const [ptype, pid] = draft.prestataire ? draft.prestataire.split(':') : [null, null]
    const { error } = await supabase
      .from('extras')
      .update({
        nom: draft.nom.trim(),
        categorie: draft.categorie.trim() || null,
        type_tarification: draft.type_tarification,
        prix_achat: draft.prix_achat ? Number(draft.prix_achat) : 0,
        prix_vente: draft.prix_vente ? Number(draft.prix_vente) : 0,
        inclure_comptabilite: draft.inclure_comptabilite,
        prestataire_type: ptype,
        prestataire_id: pid,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <Field label="Prestataire associé (la fiche compta tombe chez lui)">
            <select className={inputCls} value={prestataire} onChange={(e) => setPrestataire(e.target.value)}>
              <option value="">— extra autonome (fiche à son nom) —</option>
              {prestataires.map((p) => (
                <option key={prestKey(p.type, p.id)} value={prestKey(p.type, p.id)}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-400">
            Ex : « supplément single / tente de luxe » rattachés à l’hébergement ;
            « quad / dromadaire / 4×4 » rattachés à leur prestataire. La dépense apparaît
            alors dans la fiche comptabilité de ce prestataire, à la même date et excursion.
          </p>
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
                  <th className="px-2 py-1">Prestataire</th>
                  <th className="px-2 py-1 text-center">Compta</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) =>
                  editId === x.id ? (
                    <tr key={x.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.nom}
                          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.categorie}
                          onChange={(e) => setDraft({ ...draft, categorie: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type_tarification}
                          onChange={(e) => setDraft({ ...draft, type_tarification: e.target.value })}
                        >
                          <option value="PAR_PERSONNE">PAR_PERSONNE</option>
                          <option value="PAR_VEHICULE">PAR_VEHICULE</option>
                          <option value="PAR_GROUPE">PAR_GROUPE</option>
                          <option value="MANUEL">MANUEL</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.prix_achat}
                          onChange={(e) => setDraft({ ...draft, prix_achat: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.prix_vente}
                          onChange={(e) => setDraft({ ...draft, prix_vente: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.prestataire}
                          onChange={(e) => setDraft({ ...draft, prestataire: e.target.value })}
                        >
                          <option value="">— autonome —</option>
                          {prestataires.map((p) => (
                            <option key={prestKey(p.type, p.id)} value={prestKey(p.type, p.id)}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={draft.inclure_comptabilite}
                          onChange={(e) =>
                            setDraft({ ...draft, inclure_comptabilite: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={x.id} className="border-b last:border-0">
                      <td className="px-2 py-1">{x.nom}</td>
                      <td className="px-2 py-1 text-slate-500">{x.categorie ?? '—'}</td>
                      <td className="px-2 py-1 text-xs text-slate-500">{x.type_tarification}</td>
                      <td className="px-2 py-1 text-right">{x.prix_achat ?? 0}</td>
                      <td className="px-2 py-1 text-right">{x.prix_vente ?? 0}</td>
                      <td className="px-2 py-1 text-xs text-slate-500">{prestLabel(x.prestataire_type, x.prestataire_id)}</td>
                      <td className="px-2 py-1 text-center">{x.inclure_comptabilite ? '✓' : '—'}</td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(x)}
                          onDelete={() => supprimerLigne('extras', x.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface TransportDraft {
  nom: string
  type_transport: string
  telephone: string
  tarif_sortie: string
  email: string
  adresse: string
  matricule_fiscal: string
}

function TransportsPanel() {
  const [rows, setRows] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [type, setType] = useState('PRESTATAIRE')
  const [telephone, setTelephone] = useState('')
  const [tarifSortie, setTarifSortie] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [matricule, setMatricule] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TransportDraft>({
    nom: '',
    type_transport: 'PRESTATAIRE',
    telephone: '',
    tarif_sortie: '',
    email: '',
    adresse: '',
    matricule_fiscal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transports')
      .select('id,nom,type_transport,telephone,tarif_sortie,email,adresse,matricule_fiscal')
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
      email: email.trim() || null,
      adresse: adresse.trim() || null,
      matricule_fiscal: matricule.trim() || null,
    })
    if (error) {
      setError(error.message)
      return
    }
    await creerFournisseur(nom.trim(), 'TRANSPORT', telephone.trim() || null)
    setNom('')
    setTelephone('')
    setTarifSortie('')
    setEmail('')
    setAdresse('')
    setMatricule('')
    load()
  }

  function startEdit(t: Transport) {
    setError(null)
    setEditId(t.id)
    setDraft({
      nom: t.nom,
      type_transport: t.type_transport,
      telephone: t.telephone ?? '',
      tarif_sortie: t.tarif_sortie != null ? String(t.tarif_sortie) : '',
      email: t.email ?? '',
      adresse: t.adresse ?? '',
      matricule_fiscal: t.matricule_fiscal ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    const { error } = await supabase
      .from('transports')
      .update({
        nom: draft.nom.trim(),
        type_transport: draft.type_transport,
        telephone: draft.telephone.trim() || null,
        tarif_sortie: draft.tarif_sortie ? Number(draft.tarif_sortie) : null,
        email: draft.email.trim() || null,
        adresse: draft.adresse.trim() || null,
        matricule_fiscal: draft.matricule_fiscal.trim() || null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
          <Field label="E-mail">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <Field label="Matricule fiscal">
            <input className={inputCls} value={matricule} onChange={(e) => setMatricule(e.target.value)} />
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
                  <th className="px-2 py-1">Adresse / M.F.</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) =>
                  editId === t.id ? (
                    <tr key={t.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.nom}
                          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type_transport}
                          onChange={(e) => setDraft({ ...draft, type_transport: e.target.value })}
                        >
                          <option value="FLOTTE_INTERNE">FLOTTE_INTERNE</option>
                          <option value="LOCATION_LONGUE_DUREE">LOCATION_LONGUE_DUREE</option>
                          <option value="LOCATION_EXCURSION">LOCATION_EXCURSION</option>
                          <option value="PRESTATAIRE">PRESTATAIRE</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.telephone}
                          onChange={(e) => setDraft({ ...draft, telephone: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.tarif_sortie}
                          onChange={(e) => setDraft({ ...draft, tarif_sortie: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="grid gap-1">
                          <input className={editInputCls} placeholder="E-mail" value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                          <input className={editInputCls} placeholder="Adresse" value={draft.adresse}
                            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} />
                          <input className={editInputCls} placeholder="Matricule fiscal" value={draft.matricule_fiscal}
                            onChange={(e) => setDraft({ ...draft, matricule_fiscal: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-2 py-1">{t.nom}</td>
                      <td className="px-2 py-1 text-xs text-slate-500">{t.type_transport}</td>
                      <td className="px-2 py-1 text-slate-500">{t.telephone ?? '—'}</td>
                      <td className="px-2 py-1 text-right">
                        {t.tarif_sortie != null ? `${t.tarif_sortie} DT` : '—'}
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-500">
                        {t.email && <div>{t.email}</div>}
                        {t.adresse && <div>{t.adresse}</div>}
                        {t.matricule_fiscal && <div>M.F. {t.matricule_fiscal}</div>}
                        {!t.email && !t.adresse && !t.matricule_fiscal && '—'}
                      </td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(t)}
                          onDelete={() => supprimerLigne('transports', t.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
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
interface VehicleDraft {
  immatriculation: string
  type: string
  capacite: string
}

function VehiclesPanel() {
  const [rows, setRows] = useState<Vehicle[]>([])
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [immat, setImmat] = useState('')
  const [type, setType] = useState('van')
  const [capacite, setCapacite] = useState('')
  const [transportId, setTransportId] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<VehicleDraft>({ immatriculation: '', type: 'van', capacite: '' })

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

  function startEdit(v: Vehicle) {
    setError(null)
    setEditId(v.id)
    setDraft({
      immatriculation: v.immatriculation ?? '',
      type: v.type ?? 'van',
      capacite: v.capacite != null ? String(v.capacite) : '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setError(null)
    if (!draft.immatriculation.trim()) {
      setError('L’immatriculation est obligatoire.')
      return
    }
    const { error } = await supabase
      .from('erp_vehicles')
      .update({
        immatriculation: draft.immatriculation.trim(),
        type: draft.type,
        capacite: draft.capacite ? Number(draft.capacite) : null,
      })
      .eq('id', editId)
    if (error) {
      setError(error.message)
      return
    }
    setEditId(null)
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
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) =>
                  editId === v.id ? (
                    <tr key={v.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-2 py-1">
                        <input
                          className={editInputCls}
                          value={draft.immatriculation}
                          onChange={(e) => setDraft({ ...draft, immatriculation: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={editInputCls}
                          value={draft.type}
                          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                        >
                          <option value="berline">berline</option>
                          <option value="van">van</option>
                          <option value="minibus">minibus</option>
                          <option value="coaster">coaster</option>
                          <option value="bus">bus</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className={editInputCls}
                          value={draft.capacite}
                          onChange={(e) => setDraft({ ...draft, capacite: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 text-slate-500">{transportNom(v.transport_id)}</td>
                      <td className="px-2 py-1">
                        <EditActions onSave={saveEdit} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-2 py-1 font-mono text-xs">{v.immatriculation ?? '—'}</td>
                      <td className="px-2 py-1">{v.type ?? '—'}</td>
                      <td className="px-2 py-1 text-right">{v.capacite ?? '—'}</td>
                      <td className="px-2 py-1 text-slate-500">{transportNom(v.transport_id)}</td>
                      <td className="px-2 py-1">
                        <RowActions
                          onEdit={() => startEdit(v)}
                          onDelete={() => supprimerLigne('erp_vehicles', v.id, setError, load)}
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

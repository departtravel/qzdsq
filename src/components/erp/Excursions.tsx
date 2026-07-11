import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
} from '../../lib/erp'
import { ExcursionForm } from './ExcursionForm'
import { useErpRole, peutEcrire } from '../../lib/roles'

// Vue catalogue des excursions OTA + simulateur de rentabilité.
export function Excursions() {
  const { role } = useErpRole()
  const [excursions, setExcursions] = useState<Excursion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('excursions')
      .select('*')
      .order('code_interne')
    if (error) setError(error.message)
    setExcursions((data as Excursion[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Chargement du catalogue…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  const selected = excursions.find((e) => e.id === selectedId) ?? null
  if (selected)
    return <ExcursionDetail excursion={selected} onBack={() => setSelectedId(null)} />

  if (showForm)
    return (
      <ExcursionForm
        onCancel={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false)
          load()
        }}
      />
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Catalogue excursions ({excursions.length})</h2>
        {peutEcrire.catalogue(role) && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Ajouter une excursion
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Compte OTA</th>
              <th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2 text-right">Adulte</th>
              <th className="px-3 py-2 text-right">Enfant</th>
            </tr>
          </thead>
          <tbody>
            {excursions.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="cursor-pointer border-b last:border-0 hover:bg-blue-50"
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{e.code_interne}</td>
                <td className="px-3 py-2">{e.nom}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{e.compte_ota}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{e.duree}</td>
                <td className="px-3 py-2 text-right">{e.prix_adulte} €</td>
                <td className="px-3 py-2 text-right">{e.prix_enfant} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {excursions.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Aucune excursion. Exécute <code>supabase/seed.sql</code> pour charger le catalogue.
        </p>
      )}
    </div>
  )
}

function ExcursionDetail({ excursion, onBack }: { excursion: Excursion; onBack: () => void }) {
  const { role } = useErpRole()
  const canWrite = peutEcrire.catalogue(role)
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [loading, setLoading] = useState(true)
  const [adultes, setAdultes] = useState(10)
  const [enfants, setEnfants] = useState(0)
  const [bebes, setBebes] = useState(0)
  const [capacite, setCapacite] = useState(5)
  // Prix de vente modifiables
  const [pa, setPa] = useState(excursion.prix_adulte)
  const [pe, setPe] = useState(excursion.prix_enfant)
  const [pb, setPb] = useState(excursion.prix_bebe)

  async function savePrix(patch: { prix_adulte?: number; prix_enfant?: number; prix_bebe?: number }) {
    await supabase.from('excursions').update(patch).eq('id', excursion.id)
  }

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('excursion_cost_lines')
      .select('*')
      .eq('excursion_id', excursion.id)
      .order('jour')
    setLignes((data as CostLine[]) ?? [])
    setLoading(false)
  }, [excursion.id])

  useEffect(() => {
    reload()
  }, [reload])

  const r = useMemo(
    () =>
      calculerRentabilite({
        excursion: { ...excursion, prix_adulte: pa, prix_enfant: pe, prix_bebe: pb },
        lignes,
        adultes,
        enfants,
        bebes,
        capaciteVehicule: capacite,
      }),
    [excursion, lignes, adultes, enfants, bebes, capacite, pa, pe, pb],
  )

  const positif = r.margeTnd >= 0

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-blue-700 hover:underline">
        ← Retour au catalogue
      </button>
      <div className="mb-4">
        <p className="font-mono text-xs text-slate-400">{excursion.code_interne}</p>
        <h2 className="text-xl font-bold">{excursion.nom}</h2>
        <p className="text-sm text-slate-500">
          {excursion.compte_ota} · {excursion.duree} · Commission {excursion.commission_ota}% · Taux{' '}
          {excursion.taux_conversion} TND/EUR
        </p>
      </div>

      {/* Prix de vente (modifiables) */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <p className="mb-2 text-xs text-slate-500">💶 Prix de vente (EUR) — modifiables</p>
        <div className="flex flex-wrap gap-4">
          <PrixField label="Prix adulte" value={pa} onChange={setPa} onSave={(v) => savePrix({ prix_adulte: v })} disabled={!canWrite} />
          <PrixField label="Prix enfant" value={pe} onChange={setPe} onSave={(v) => savePrix({ prix_enfant: v })} disabled={!canWrite} />
          <PrixField label="Prix bébé" value={pb} onChange={setPb} onSave={(v) => savePrix({ prix_bebe: v })} disabled={!canWrite} />
        </div>
      </div>

      {/* Simulateur d'effectif */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <p className="mb-2 text-xs text-slate-500">
          🧮 <strong>Simulateur</strong> — teste une rentabilité « si j'avais X participants ».
          Ces chiffres ne sont pas une vraie réservation ; modifie-les librement.
        </p>
        <div className="flex flex-wrap gap-4">
          <NumField label="Adultes" value={adultes} onChange={setAdultes} />
          <NumField label="Enfants" value={enfants} onChange={setEnfants} />
          <NumField label="Bébés" value={bebes} onChange={setBebes} />
          <NumField label="Capacité véhicule" value={capacite} onChange={setCapacite} min={1} />
        </div>
      </div>

      {/* Cartes résultat */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="CA net" value={`${r.caNetTnd.toFixed(0)} TND`} sub={`${r.caNetEur.toFixed(0)} €`} />
        <Stat label="Coût total" value={`${r.coutTotalTnd.toFixed(0)} TND`} sub={`${r.coutParPersonneTnd.toFixed(1)}/pers`} />
        <Stat
          label="Marge"
          value={`${r.margeTnd.toFixed(0)} TND`}
          sub={`${r.margePct.toFixed(1)} %`}
          tone={positif ? 'good' : 'bad'}
        />
        <Stat
          label="Seuil rentabilité"
          value={r.seuilRentabilite == null ? '∞' : `${r.seuilRentabilite} pers`}
          sub="minimum payants"
          tone={r.seuilRentabilite == null ? 'bad' : 'neutral'}
        />
      </div>

      {/* Détail des coûts */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Détail des coûts ({loading ? '…' : lignes.length} lignes)</h3>
        {r.detail.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune ligne de coût saisie pour cette excursion.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Catégorie</th>
                <th className="py-1">Dépense</th>
                <th className="py-1">Type</th>
                <th className="py-1 text-right">Total TND</th>
              </tr>
            </thead>
            <tbody>
              {r.detail.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 text-slate-500">{d.categorie}</td>
                  <td className="py-1">{d.nom}</td>
                  <td className="py-1">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${d.variable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.variable ? 'variable' : 'fixe'}
                    </span>
                  </td>
                  <td className="py-1 text-right">{d.totalTnd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canWrite && <CostLinesEditor excursionId={excursion.id} nombreJours={excursion.nombre_jours || 1} lignes={lignes} onChanged={reload} />}
    </div>
  )
}

const TYPES = ['PAR_PERSONNE', 'PAR_VEHICULE', 'PAR_GROUPE', 'FIXE'] as const

// Catégories de dépense proposées (les 3 premières mises en avant).
const CAT_DEPENSE: { v: string; label: string }[] = [
  { v: 'RESTAURANT', label: 'Restaurant' },
  { v: 'HEBERGEMENT', label: 'Hébergement' },
  { v: 'EXTRA', label: 'Extra' },
  { v: 'TRANSPORT', label: 'Transport' },
  { v: 'GUIDE', label: 'Guide' },
  { v: 'CHAUFFEUR', label: 'Chauffeur' },
  { v: 'GASOIL', label: 'Gasoil' },
  { v: 'PEAGE', label: 'Péage' },
  { v: 'PARKING', label: 'Parking' },
  { v: 'AUTRE', label: 'Autre' },
]
const CAT_LABEL: Record<string, string> = Object.fromEntries(CAT_DEPENSE.map((c) => [c.v, c.label]))
// Catégories rattachées à un référentiel (donc à une fiche compta).
type PrestKind = 'RESTAURANT' | 'HEBERGEMENT' | 'EXTRA' | 'TRANSPORT' | 'GUIDE' | 'CHAUFFEUR'
const KIND_TABLE: Record<PrestKind, string> = {
  RESTAURANT: 'restaurants', HEBERGEMENT: 'accommodations', EXTRA: 'extras',
  TRANSPORT: 'transports', GUIDE: 'guides', CHAUFFEUR: 'chauffeurs',
}

interface Prest { kind: PrestKind; id: string; nom: string; prixA: number | null; prixE: number | null; devise: string | null }

interface LigneDraft {
  categorie: string
  prestKey: string // "KIND:id" (prestataire de la fiche compta) ou ''
  type_depense: string
  nom: string
  prixA: string
  prixE: string
  devise: string
  tva: string
}
const DRAFT_VIDE: LigneDraft = {
  categorie: 'RESTAURANT', prestKey: '', type_depense: 'PAR_PERSONNE',
  nom: '', prixA: '', prixE: '', devise: 'TND', tva: '19',
}

// Éditeur des dépenses d'une excursion, séparé par JOUR. Chaque dépense est
// reliée (facultativement) à un prestataire -> sa fiche comptabilité.
function CostLinesEditor({
  excursionId, nombreJours, lignes, onChanged,
}: { excursionId: string; nombreJours: number; lignes: CostLine[]; onChanged: () => void | Promise<void> }) {
  const [prests, setPrests] = useState<Prest[]>([])
  // Fournisseur (prestataire) rattaché à chaque extra dans la base Extras.
  const [extraFour, setExtraFour] = useState<Map<string, { type: string; id: string }>>(new Map())
  const [jours, setJours] = useState(Math.max(1, nombreJours))
  const [openDay, setOpenDay] = useState<number | null>(null) // jour dont le formulaire d'ajout est ouvert
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<LigneDraft>(DRAFT_VIDE)
  const [error, setError] = useState<string | null>(null)

  const loadPrests = useCallback(async () => {
    const [r, a, e, tr, gu, ch, rp, ap] = await Promise.all([
      supabase.from('restaurants').select('id, nom').order('nom'),
      supabase.from('accommodations').select('id, nom').order('nom'),
      supabase.from('extras').select('id, nom, prix_achat, prix_achat_enfant, devise_achat, prestataire_type, prestataire_id').order('nom'),
      supabase.from('transports').select('id, nom').order('nom'),
      supabase.from('guides').select('id, nom, prenom').order('nom'),
      supabase.from('chauffeurs').select('id, nom, prenom').order('nom'),
      supabase.from('restaurant_prices').select('restaurant_id, prix_adulte, prix_enfant, date_debut').order('date_debut', { ascending: false }),
      supabase.from('accommodation_prices').select('accommodation_id, prix_adulte, prix_enfant, date').order('date', { ascending: false }),
    ])
    const rm = new Map<string, { a: number; e: number }>()
    for (const x of (rp.data as { restaurant_id: string; prix_adulte: number; prix_enfant: number }[]) ?? [])
      if (!rm.has(x.restaurant_id)) rm.set(x.restaurant_id, { a: x.prix_adulte, e: x.prix_enfant })
    const am = new Map<string, { a: number; e: number }>()
    for (const x of (ap.data as { accommodation_id: string; prix_adulte: number; prix_enfant: number }[]) ?? [])
      if (!am.has(x.accommodation_id)) am.set(x.accommodation_id, { a: x.prix_adulte, e: x.prix_enfant })
    const list: Prest[] = []
    for (const x of (r.data as { id: string; nom: string }[]) ?? [])
      list.push({ kind: 'RESTAURANT', id: x.id, nom: x.nom, prixA: rm.get(x.id)?.a ?? null, prixE: rm.get(x.id)?.e ?? null, devise: 'TND' })
    for (const x of (a.data as { id: string; nom: string }[]) ?? [])
      list.push({ kind: 'HEBERGEMENT', id: x.id, nom: x.nom, prixA: am.get(x.id)?.a ?? null, prixE: am.get(x.id)?.e ?? null, devise: 'TND' })
    const efMap = new Map<string, { type: string; id: string }>()
    for (const x of (e.data as { id: string; nom: string; prix_achat: number | null; prix_achat_enfant: number | null; devise_achat: string | null; prestataire_type: string | null; prestataire_id: string | null }[]) ?? []) {
      list.push({ kind: 'EXTRA', id: x.id, nom: x.nom, prixA: x.prix_achat, prixE: x.prix_achat_enfant, devise: x.devise_achat ?? 'TND' })
      if (x.prestataire_type && x.prestataire_id) efMap.set(x.id, { type: x.prestataire_type, id: x.prestataire_id })
    }
    setExtraFour(efMap)
    for (const x of (tr.data as { id: string; nom: string }[]) ?? [])
      list.push({ kind: 'TRANSPORT', id: x.id, nom: x.nom, prixA: null, prixE: null, devise: 'TND' })
    for (const x of (gu.data as { id: string; nom: string; prenom: string | null }[]) ?? [])
      list.push({ kind: 'GUIDE', id: x.id, nom: `${x.nom} ${x.prenom ?? ''}`.trim(), prixA: null, prixE: null, devise: 'TND' })
    for (const x of (ch.data as { id: string; nom: string; prenom: string | null }[]) ?? [])
      list.push({ kind: 'CHAUFFEUR', id: x.id, nom: `${x.nom} ${x.prenom ?? ''}`.trim(), prixA: null, prixE: null, devise: 'TND' })
    setPrests(list)
  }, [])

  useEffect(() => { loadPrests() }, [loadPrests])

  // Le nombre de jours affichés couvre toujours les dépenses déjà saisies.
  useEffect(() => {
    const maxJ = lignes.reduce((m, l) => Math.max(m, l.jour || 1), 1)
    setJours((j) => Math.max(j, maxJ, Math.max(1, nombreJours)))
  }, [lignes, nombreJours])

  const prestKey = (kind: string, id: string) => `${kind}:${id}`
  const prestLabel = (l: CostLine) =>
    l.partner_id && l.partner_type
      ? (prests.find((p) => p.kind === l.partner_type && p.id === l.partner_id)?.nom ?? l.partner_type)
      : '—'

  // Options prestataires proposées selon la catégorie choisie.
  function optionsPour(categorie: string): Prest[] {
    if (['RESTAURANT', 'HEBERGEMENT', 'EXTRA', 'TRANSPORT', 'GUIDE', 'CHAUFFEUR'].includes(categorie))
      return prests.filter((p) => p.kind === categorie)
    return prests // gasoil/péage/parking/autre : associable librement (facultatif)
  }

  function ouvrirAjout(jour: number) {
    setEditId(null); setError(null)
    setOpenDay(jour)
    setDraft({ ...DRAFT_VIDE })
  }
  function ouvrirEdition(l: CostLine) {
    setError(null); setOpenDay(null)
    setEditId(l.id)
    setDraft({
      categorie: l.categorie,
      prestKey: l.partner_type && l.partner_id ? prestKey(l.partner_type, l.partner_id) : '',
      type_depense: l.type_depense ?? 'PAR_PERSONNE',
      nom: l.nom_depense,
      prixA: l.prix_unitaire != null ? String(l.prix_unitaire) : '',
      prixE: l.prix_enfant != null ? String(l.prix_enfant) : '',
      devise: l.devise ?? 'TND',
      tva: l.taux_tva != null ? String(l.taux_tva) : '19',
    })
  }
  function annuler() { setOpenDay(null); setEditId(null); setDraft(DRAFT_VIDE); setError(null) }

  function choisirPrestataire(key: string) {
    const d = { ...draft, prestKey: key }
    if (key) {
      const [kind, id] = key.split(':')
      const p = prests.find((x) => x.kind === kind && x.id === id)
      if (p) {
        d.nom = p.nom
        if (p.prixA != null) d.prixA = String(p.prixA)
        if (p.prixE != null) d.prixE = String(p.prixE)
        if (p.devise) d.devise = p.devise
      }
    }
    setDraft(d)
  }

  // Détermine (partner_type, partner_id) et crée le prestataire si nom nouveau.
  async function resolvePartner(d: LigneDraft): Promise<{ type: string | null; id: string | null } | 'ERR'> {
    if (d.prestKey) {
      const [kind, id] = d.prestKey.split(':')
      // Un extra facture chez SON fournisseur (défini dans la base Extras) s'il en a un.
      if (kind === 'EXTRA') {
        const f = extraFour.get(id)
        if (f) return { type: f.type, id: f.id }
      }
      return { type: kind, id }
    }
    // Pas de prestataire choisi : pour une catégorie rattachable, on relie par nom
    // (réutilise la fiche si le nom existe, sinon crée le prestataire + sa fiche).
    const kind = d.categorie as PrestKind
    if (!(kind in KIND_TABLE)) return { type: null, id: null } // gasoil/péage/parking/autre : pas de fiche
    const existant = prests.find((p) => p.kind === kind && p.nom.trim().toLowerCase() === d.nom.trim().toLowerCase())
    if (existant) return { type: kind, id: existant.id }
    const payload: Record<string, unknown> =
      kind === 'EXTRA'
        ? {
            nom: d.nom.trim(), categorie: 'AUTRE', type_tarification: d.type_depense,
            prix_achat: d.prixA ? Number(d.prixA) : 0,
            prix_achat_enfant: d.prixE ? Number(d.prixE) : null,
            devise_achat: d.devise,
          }
        : { nom: d.nom.trim() }
    const { data, error } = await supabase.from(KIND_TABLE[kind]).insert(payload).select('id').single()
    if (error) { setError('Création du prestataire : ' + error.message); return 'ERR' }
    await loadPrests()
    return { type: kind, id: (data as { id: string }).id }
  }

  async function enregistrer(jour: number) {
    setError(null)
    if (!draft.nom.trim()) { setError('Nom de la dépense requis.'); return }
    const partner = await resolvePartner(draft)
    if (partner === 'ERR') return
    const payload = {
      excursion_id: excursionId,
      jour,
      categorie: draft.categorie,
      type_depense: draft.type_depense,
      nom_depense: draft.nom.trim(),
      prix_unitaire: draft.prixA ? Number(draft.prixA) : 0,
      prix_enfant: draft.prixE !== '' ? Number(draft.prixE) : null,
      devise: draft.devise,
      taux_tva: Number(draft.tva) || 0,
      inclure_comptabilite: true,
      partner_type: partner.type,
      partner_id: partner.id,
    }
    const res = editId
      ? await supabase.from('excursion_cost_lines').update(payload).eq('id', editId)
      : await supabase.from('excursion_cost_lines').insert(payload)
    if (res.error) { setError(res.error.message); return }
    annuler()
    onChanged()
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer cette dépense ?')) return
    await supabase.from('excursion_cost_lines').delete().eq('id', id)
    if (editId === id) annuler()
    onChanged()
  }

  async function ajouterJournee() {
    const n = jours + 1
    setJours(n)
    await supabase.from('excursions').update({ nombre_jours: n }).eq('id', excursionId)
    ouvrirAjout(n)
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Dépenses par jour</h3>
        <button onClick={ajouterJournee} className="rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50">
          ＋ Ajouter une journée
        </button>
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {Array.from({ length: jours }, (_, i) => i + 1).map((jour) => {
        const dujour = lignes.filter((l) => (l.jour || 1) === jour)
        return (
          <div key={jour} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold text-slate-700">Jour {jour}</h4>
              <button
                onClick={() => (openDay === jour ? annuler() : ouvrirAjout(jour))}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                {openDay === jour ? 'Fermer' : '＋ Ajouter une dépense'}
              </button>
            </div>

            {dujour.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune dépense pour ce jour.</p>
            ) : (
              <div className="divide-y">
                {dujour.map((l) =>
                  editId === l.id ? (
                    <DepenseForm
                      key={l.id} draft={draft} setDraft={setDraft} options={optionsPour(draft.categorie)}
                      onPrest={choisirPrestataire} onSave={() => enregistrer(jour)} onCancel={annuler} prestKey={prestKey}
                    />
                  ) : (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{CAT_LABEL[l.categorie] ?? l.categorie}</span>
                      <span className="font-medium">{l.nom_depense}</span>
                      <span className="text-xs text-slate-400">{l.type_depense}</span>
                      <span className="text-slate-600">
                        {l.prix_unitaire} {l.devise}
                        {l.prix_enfant != null && <span className="text-slate-400"> · enf. {l.prix_enfant}</span>}
                      </span>
                      <span className="text-xs text-slate-400">→ {prestLabel(l)}</span>
                      <span className="ml-auto flex gap-2">
                        <button onClick={() => ouvrirEdition(l)} className="text-xs font-medium text-blue-600 hover:underline">Modifier</button>
                        <button onClick={() => supprimer(l.id)} className="text-xs font-medium text-red-600 hover:underline">Supprimer</button>
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}

            {openDay === jour && !editId && (
              <div className="mt-3 border-t pt-3">
                <DepenseForm
                  draft={draft} setDraft={setDraft} options={optionsPour(draft.categorie)}
                  onPrest={choisirPrestataire} onSave={() => enregistrer(jour)} onCancel={annuler} prestKey={prestKey}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Formulaire d'une dépense (ajout ou édition), réutilisé partout.
function DepenseForm({
  draft, setDraft, options, onPrest, onSave, onCancel, prestKey,
}: {
  draft: LigneDraft
  setDraft: (d: LigneDraft) => void
  options: Prest[]
  onPrest: (key: string) => void
  onSave: () => void
  onCancel: () => void
  prestKey: (kind: string, id: string) => string
}) {
  const estExtra = draft.categorie === 'EXTRA'
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4 lg:grid-cols-8">
      <Lbl t="Type de dépense">
        <select value={draft.categorie} onChange={(e) => setDraft({ ...draft, categorie: e.target.value, prestKey: '' })} className={ipt}>
          {CAT_DEPENSE.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      </Lbl>
      <Lbl t={estExtra ? 'Extra (base de données)' : 'Prestataire (fiche compta)'}>
        <select value={draft.prestKey} onChange={(e) => onPrest(e.target.value)} className={ipt}>
          <option value="">{estExtra ? '— choisir un extra / saisir le nom —' : '— choisir / saisir le nom —'}</option>
          {options.map((p) => (
            <option key={prestKey(p.kind, p.id)} value={prestKey(p.kind, p.id)}>{p.nom}</option>
          ))}
        </select>
      </Lbl>
      <Lbl t="Nom"><input value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} className={ipt} /></Lbl>
      <Lbl t="Mode">
        <select value={draft.type_depense} onChange={(e) => setDraft({ ...draft, type_depense: e.target.value })} className={ipt}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Lbl>
      <Lbl t="Prix adulte"><input type="number" min={0} step="0.01" value={draft.prixA} onChange={(e) => setDraft({ ...draft, prixA: e.target.value })} className={ipt} /></Lbl>
      <Lbl t="Prix enfant"><input type="number" min={0} step="0.01" value={draft.prixE} placeholder="= adulte si vide" onChange={(e) => setDraft({ ...draft, prixE: e.target.value })} className={ipt} /></Lbl>
      <Lbl t="Devise"><input value={draft.devise} onChange={(e) => setDraft({ ...draft, devise: e.target.value })} className={ipt} /></Lbl>
      <Lbl t="TVA (TTC)">
        <select value={draft.tva} onChange={(e) => setDraft({ ...draft, tva: e.target.value })} className={ipt}>
          <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option>
        </select>
      </Lbl>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-8">
        <button onClick={onSave} className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700">Enregistrer</button>
        <button onClick={onCancel} className="rounded bg-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-300">Annuler</button>
      </div>
    </div>
  )
}

function PrixField({
  label, value, onChange, onSave, disabled,
}: { label: string; value: number; onChange: (n: number) => void; onSave: (n: number) => void; disabled?: boolean }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} step="0.01" value={value} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          onBlur={(e) => !disabled && onSave(Number(e.target.value) || 0)}
          className="w-24 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-50"
        />
        <span className="text-slate-400">€</span>
      </div>
    </label>
  )
}

const ipt = 'w-full rounded border border-slate-300 px-2 py-1'
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="mb-1 block text-slate-500">{t}</span>{children}</label>
}

function NumField({
  label, value, onChange, min = 0,
}: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-24 rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function Stat({
  label, value, sub, tone = 'neutral',
}: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

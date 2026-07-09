import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CostCategory, CostType } from '../../lib/erp'

// Formulaire de création d'une excursion complète + ses lignes de coût.

interface OtaOption {
  id: string
  nom: string
}

interface PartnerOption {
  id: string
  nom: string
}

interface ExtraOption {
  id: string
  nom: string
  prix_achat: number
  devise_achat: string
  type_tarification: string | null
}

interface CostLineDraft {
  jour: number
  categorie: CostCategory
  type_depense: CostType
  nom_depense: string
  prix_unitaire: number
  devise: string
  taux_tva: number
  inclure_comptabilite: boolean
  /** id de l'extra sélectionné, '' = saisie manuelle. */
  extraId: string
  /** id du partenaire (restaurant ou hébergement) sélectionné, '' = saisie manuelle. */
  partnerId: string
}

const CATEGORIES: CostCategory[] = [
  'TRANSPORT', 'GUIDE', 'CHAUFFEUR', 'RESTAURANT', 'HEBERGEMENT',
  'EXTRA', 'GASOIL', 'PEAGE', 'PARKING', 'AUTRE',
]

const TYPES: CostType[] = ['PAR_PERSONNE', 'PAR_VEHICULE', 'PAR_GROUPE', 'FIXE']

const DUREES = [
  'demi-journée', 'journée', '2 jours', '3 jours', '5 jours',
  'transfert', 'activité', 'soirée',
]

function emptyLine(): CostLineDraft {
  return {
    jour: 1,
    categorie: 'TRANSPORT',
    type_depense: 'PAR_GROUPE',
    nom_depense: '',
    prix_unitaire: 0,
    devise: 'TND',
    taux_tva: 19,
    inclure_comptabilite: true,
    extraId: '',
    partnerId: '',
  }
}

/** Devine un type de dépense à partir du type_tarification d'un extra. */
function typeDepuisExtra(t: string | null): CostType {
  switch (t) {
    case 'PAR_PERSONNE': return 'PAR_PERSONNE'
    case 'PAR_VEHICULE': return 'PAR_VEHICULE'
    case 'PAR_GROUPE': return 'PAR_GROUPE'
    case 'FIXE': return 'FIXE'
    default: return 'PAR_PERSONNE'
  }
}

export function ExcursionForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [otaChannels, setOtaChannels] = useState<OtaOption[]>([])
  const [extras, setExtras] = useState<ExtraOption[]>([])
  const [restaurants, setRestaurants] = useState<PartnerOption[]>([])
  const [accommodations, setAccommodations] = useState<PartnerOption[]>([])

  const [codeInterne, setCodeInterne] = useState('')
  const [nom, setNom] = useState('')
  const [otaChannelId, setOtaChannelId] = useState('')
  const [compteOta, setCompteOta] = useState('')
  const [villeDepart, setVilleDepart] = useState('')
  const [duree, setDuree] = useState('journée')
  const [nombreJours, setNombreJours] = useState(1)
  const [prixAdulte, setPrixAdulte] = useState(0)
  const [prixEnfant, setPrixEnfant] = useState(0)
  const [prixBebe, setPrixBebe] = useState(0)
  const [commissionOta, setCommissionOta] = useState(30)
  const [tauxConversion, setTauxConversion] = useState(3.34)

  const [lignes, setLignes] = useState<CostLineDraft[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ota_channels')
      .select('id,nom')
      .order('nom')
      .then(({ data }) => setOtaChannels((data as OtaOption[]) ?? []))
    supabase
      .from('extras')
      .select('id,nom,prix_achat,devise_achat,type_tarification')
      .order('nom')
      .then(({ data }) => setExtras((data as ExtraOption[]) ?? []))
    supabase
      .from('restaurants')
      .select('id,nom')
      .order('nom')
      .then(({ data }) => setRestaurants((data as PartnerOption[]) ?? []))
    supabase
      .from('accommodations')
      .select('id,nom')
      .order('nom')
      .then(({ data }) => setAccommodations((data as PartnerOption[]) ?? []))
  }, [])

  function updateLine(index: number, patch: Partial<CostLineDraft>) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    )
  }

  function onCategorieChange(index: number, categorie: CostCategory) {
    // On réinitialise les sélecteurs de partenaire quand la catégorie change.
    updateLine(index, { categorie, extraId: '', partnerId: '' })
  }

  function onPartnerChange(
    index: number,
    categorie: 'RESTAURANT' | 'HEBERGEMENT',
    partnerId: string,
  ) {
    if (partnerId === '') {
      updateLine(index, { partnerId: '' })
      return
    }
    const list = categorie === 'RESTAURANT' ? restaurants : accommodations
    const partner = list.find((p) => p.id === partnerId)
    if (!partner) {
      updateLine(index, { partnerId })
      return
    }
    updateLine(index, { partnerId, nom_depense: partner.nom })
  }

  function onExtraChange(index: number, extraId: string) {
    if (extraId === '') {
      updateLine(index, { extraId: '' })
      return
    }
    const extra = extras.find((e) => e.id === extraId)
    if (!extra) {
      updateLine(index, { extraId })
      return
    }
    updateLine(index, {
      extraId,
      nom_depense: extra.nom,
      prix_unitaire: extra.prix_achat,
      devise: extra.devise_achat,
      type_depense: typeDepuisExtra(extra.type_tarification),
    })
  }

  async function handleSubmit() {
    setError(null)
    if (!codeInterne.trim() || !nom.trim()) {
      setError('Le code interne et le nom sont obligatoires.')
      return
    }
    setSaving(true)

    const { data, error: insErr } = await supabase
      .from('excursions')
      .insert({
        code_interne: codeInterne.trim(),
        nom: nom.trim(),
        ota_channel_id: otaChannelId || null,
        compte_ota: compteOta.trim() || null,
        ville_depart: villeDepart.trim() || null,
        duree,
        nombre_jours: nombreJours,
        prix_adulte: prixAdulte,
        prix_enfant: prixEnfant,
        prix_bebe: prixBebe,
        commission_ota: commissionOta,
        taux_conversion: tauxConversion,
        statut: 'ACTIVE',
      })
      .select()
      .single()

    if (insErr || !data) {
      setError(insErr?.message ?? "Échec de la création de l'excursion.")
      setSaving(false)
      return
    }

    const excursionId = (data as { id: string }).id

    if (lignes.length > 0) {
      const rows = lignes.map((l) => {
        let partner_type: string | null = null
        let partner_id: string | null = null
        if (l.categorie === 'EXTRA' && l.extraId) {
          partner_type = 'EXTRA'
          partner_id = l.extraId
        } else if (l.categorie === 'RESTAURANT' && l.partnerId) {
          partner_type = 'RESTAURANT'
          partner_id = l.partnerId
        } else if (l.categorie === 'HEBERGEMENT' && l.partnerId) {
          partner_type = 'HEBERGEMENT'
          partner_id = l.partnerId
        }
        return {
          excursion_id: excursionId,
          jour: l.jour,
          categorie: l.categorie,
          type_depense: l.type_depense,
          nom_depense: l.nom_depense.trim(),
          quantite: 1,
          prix_unitaire: l.prix_unitaire,
          devise: l.devise,
          taux_tva: l.taux_tva,
          inclure_comptabilite: l.inclure_comptabilite,
          partner_type,
          partner_id,
        }
      })
      const { error: linesErr } = await supabase
        .from('excursion_cost_lines')
        .insert(rows)
      if (linesErr) {
        setError(
          `Excursion créée mais erreur sur les lignes de coût : ${linesErr.message}`,
        )
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onCreated()
  }

  return (
    <div>
      <button
        onClick={onCancel}
        className="mb-4 text-sm text-blue-700 hover:underline"
      >
        ← Annuler
      </button>
      <h2 className="mb-4 text-lg font-semibold">Nouvelle excursion</h2>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Champs de l'excursion */}
      <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Code interne *" value={codeInterne} onChange={setCodeInterne} />
        <TextField label="Nom *" value={nom} onChange={setNom} />
        <SelectField
          label="Canal OTA"
          value={otaChannelId}
          onChange={setOtaChannelId}
          options={[{ value: '', label: '— Aucun —' }, ...otaChannels.map((o) => ({ value: o.id, label: o.nom }))]}
        />
        <TextField label="Compte OTA" value={compteOta} onChange={setCompteOta} />
        <TextField label="Ville de départ" value={villeDepart} onChange={setVilleDepart} />
        <SelectField
          label="Durée"
          value={duree}
          onChange={setDuree}
          options={DUREES.map((d) => ({ value: d, label: d }))}
        />
        <NumberField label="Nombre de jours" value={nombreJours} onChange={setNombreJours} min={1} />
        <NumberField label="Prix adulte (€)" value={prixAdulte} onChange={setPrixAdulte} step={0.01} />
        <NumberField label="Prix enfant (€)" value={prixEnfant} onChange={setPrixEnfant} step={0.01} />
        <NumberField label="Prix bébé (€)" value={prixBebe} onChange={setPrixBebe} step={0.01} />
        <NumberField label="Commission OTA (%)" value={commissionOta} onChange={setCommissionOta} step={0.01} />
        <NumberField label="Taux conversion (TND/€)" value={tauxConversion} onChange={setTauxConversion} step={0.01} />
      </div>

      {/* Lignes de coût */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Lignes de coût ({lignes.length})</h3>
          <button
            onClick={() => setLignes((prev) => [...prev, emptyLine()])}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Ajouter une ligne de coût
          </button>
        </div>

        {lignes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune ligne de coût. Ajoute-en une si besoin.</p>
        ) : (
          <div className="space-y-3">
            {lignes.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-3 rounded border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <NumberField label="Jour" value={l.jour} onChange={(v) => updateLine(i, { jour: v })} min={1} />
                <SelectField
                  label="Catégorie"
                  value={l.categorie}
                  onChange={(v) => onCategorieChange(i, v as CostCategory)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
                {l.categorie === 'EXTRA' && (
                  <SelectField
                    label="Extra"
                    value={l.extraId}
                    onChange={(v) => onExtraChange(i, v)}
                    options={[
                      { value: '', label: '➕ Saisir manuellement' },
                      ...extras.map((e) => ({ value: e.id, label: e.nom })),
                    ]}
                  />
                )}
                {l.categorie === 'RESTAURANT' && (
                  <SelectField
                    label="Restaurant"
                    value={l.partnerId}
                    onChange={(v) => onPartnerChange(i, 'RESTAURANT', v)}
                    options={[
                      { value: '', label: '➕ Saisir manuellement' },
                      ...restaurants.map((r) => ({ value: r.id, label: r.nom })),
                    ]}
                  />
                )}
                {l.categorie === 'HEBERGEMENT' && (
                  <SelectField
                    label="Hébergement"
                    value={l.partnerId}
                    onChange={(v) => onPartnerChange(i, 'HEBERGEMENT', v)}
                    options={[
                      { value: '', label: '➕ Saisir manuellement' },
                      ...accommodations.map((a) => ({ value: a.id, label: a.nom })),
                    ]}
                  />
                )}
                <SelectField
                  label="Type de dépense"
                  value={l.type_depense}
                  onChange={(v) => updateLine(i, { type_depense: v as CostType })}
                  options={TYPES.map((t) => ({ value: t, label: t }))}
                />
                <TextField
                  label="Nom de la dépense"
                  value={l.nom_depense}
                  onChange={(v) => updateLine(i, { nom_depense: v })}
                />
                <NumberField
                  label="Prix unitaire"
                  value={l.prix_unitaire}
                  onChange={(v) => updateLine(i, { prix_unitaire: v })}
                  step={0.01}
                />
                <TextField
                  label="Devise"
                  value={l.devise}
                  onChange={(v) => updateLine(i, { devise: v })}
                />
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">TVA (TTC)</span>
                  <select
                    value={l.taux_tva}
                    onChange={(e) => updateLine(i, { taux_tva: Number(e.target.value) })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5"
                  >
                    <option value={19}>19 %</option>
                    <option value={7}>7 %</option>
                    <option value={0}>0 %</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={l.inclure_comptabilite}
                    onChange={(e) => updateLine(i, { inclure_comptabilite: e.target.checked })}
                    className="mb-1.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="mb-1 text-slate-600">Inclure en comptabilité</span>
                </label>
                <div className="flex items-end">
                  <button
                    onClick={() => setLignes((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Création…' : "Créer l'excursion"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function NumberField({
  label, value, onChange, min, step,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isNaN(n) ? 0 : n)
        }}
        className="w-full rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

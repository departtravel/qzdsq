import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
  type RentabilityResult,
} from '../../lib/erp'

// ============================================================
//  MODULE IA ANALYTIQUE (basé sur des règles, sans API externe)
//  - Explique pourquoi la marge baisse (historique des coûts)
//  - Simule l'impact d'un choc (carburant, participants...)
//  - Recommande location longue durée vs ponctuelle
// ============================================================

// ----- Types locaux (miroir des tables, lecture seule) ------
interface CostHistoryRow {
  id: string
  categorie: string | null
  reference_id: string | null
  ancien_prix: number | null
  nouveau_prix: number | null
  date: string
}

interface RestaurantPriceRow {
  id: string
  restaurant_id: string
  date_debut: string
  date_fin: string | null
  prix_adulte: number
  prix_enfant: number
  prix_bebe: number
  created_at: string
}

// ----- Sévérité d'une explication ---------------------------
type Severity = 'high' | 'medium' | 'low'

interface Explanation {
  titre: string
  detail: string
  impact: string
  severity: Severity
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ============================================================
//  LOGIQUE D'ANALYSE (fonctions pures)
// ============================================================

/**
 * Analyse "Pourquoi la marge baisse ?".
 * Parcourt l'historique des coûts (cost_history) et les grilles
 * restaurant (restaurant_prices) pour produire des explications
 * lisibles avec impact estimé, triées par sévérité.
 */
export function analyserBaisseMarge(
  historique: CostHistoryRow[],
  prixRestaurants: RestaurantPriceRow[],
  payants: number,
): Explanation[] {
  const explications: Explanation[] = []
  const pax = Math.max(1, payants)

  // --- 1) Historique générique des coûts (cost_history) ---
  for (const h of historique) {
    const ancien = h.ancien_prix ?? 0
    const nouveau = h.nouveau_prix ?? 0
    const delta = nouveau - ancien
    if (delta <= 0) continue // on ne signale que les hausses de coût

    const cat = (h.categorie ?? 'AUTRE').toUpperCase()
    const pct = ancien > 0 ? (delta / ancien) * 100 : 100
    const severity: Severity = pct >= 20 ? 'high' : pct >= 8 ? 'medium' : 'low'
    const quand = formatDate(h.date)

    let titre: string
    let variableParPers = false
    switch (cat) {
      case 'RESTAURANT':
        titre = 'Hausse du prix restaurant'
        variableParPers = true
        break
      case 'TRANSPORT':
      case 'GASOIL':
        titre = cat === 'GASOIL' ? 'Hausse du carburant' : 'Hausse du transport'
        break
      case 'GUIDE':
        titre = 'Changement / hausse guide'
        break
      case 'CHAUFFEUR':
        titre = 'Hausse tarif chauffeur'
        break
      default:
        titre = `Hausse coût ${cat.toLowerCase()}`
    }

    // Impact: par personne pour les coûts variables, sinon par groupe.
    const impactGroupe = variableParPers ? delta * pax : delta
    const impact = variableParPers
      ? `+${round2(delta)} TND/pers, soit +${round2(impactGroupe)} TND sur le groupe (${pax} pax)`
      : `+${round2(delta)} TND par départ`

    explications.push({
      titre,
      detail: `${quand} : passé de ${round2(ancien)} à ${round2(nouveau)} TND (+${round2(pct)} %).`,
      impact,
      severity,
    })
  }

  // --- 2) Grilles restaurant successives (restaurant_prices) ---
  // On regroupe par restaurant et on compare la grille la plus
  // récente à la précédente pour détecter une revalorisation.
  const parResto = new Map<string, RestaurantPriceRow[]>()
  for (const p of prixRestaurants) {
    const list = parResto.get(p.restaurant_id) ?? []
    list.push(p)
    parResto.set(p.restaurant_id, list)
  }
  for (const [restaurantId, grilles] of parResto) {
    if (grilles.length < 2) continue
    const triees = [...grilles].sort(
      (a, b) => +new Date(a.date_debut) - +new Date(b.date_debut),
    )
    const avant = triees[triees.length - 2]
    const apres = triees[triees.length - 1]
    const delta = apres.prix_adulte - avant.prix_adulte
    if (delta <= 0) continue
    const pct = avant.prix_adulte > 0 ? (delta / avant.prix_adulte) * 100 : 100
    const severity: Severity = pct >= 20 ? 'high' : pct >= 8 ? 'medium' : 'low'
    explications.push({
      titre: 'Revalorisation grille restaurant',
      detail: `Restaurant ${restaurantId.slice(0, 8)}… : menu adulte passé de ${round2(
        avant.prix_adulte,
      )} à ${round2(apres.prix_adulte)} TND le ${formatDate(apres.date_debut)}.`,
      impact: `+${round2(delta)} TND/pers, soit +${round2(delta * pax)} TND sur le groupe (${pax} pax)`,
      severity,
    })
  }

  const rang: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return explications.sort((a, b) => rang[a.severity] - rang[b.severity])
}

/**
 * Applique un scénario de simulation aux lignes de coût :
 * - augmentation carburant/transport de `carburantPct` %
 * - variation de l'effectif payant de `deltaParticipants`
 * Renvoie la rentabilité "avant" et "après".
 */
export function simulerScenario(
  excursion: Excursion,
  lignes: CostLine[],
  adultes: number,
  enfants: number,
  bebes: number,
  capacite: number,
  carburantPct: number,
  deltaParticipants: number,
): { avant: RentabilityResult; apres: RentabilityResult } {
  const avant = calculerRentabilite({
    excursion,
    lignes,
    adultes,
    enfants,
    bebes,
    capaciteVehicule: capacite,
  })

  const facteur = 1 + carburantPct / 100
  const lignesModifiees: CostLine[] = lignes.map((l) => {
    const cat = l.categorie
    if (cat === 'GASOIL' || cat === 'TRANSPORT' || cat === 'PEAGE') {
      return { ...l, prix_unitaire: l.prix_unitaire * facteur }
    }
    return l
  })

  // On applique la variation de participants aux adultes (plancher 0).
  const nouvAdultes = Math.max(0, adultes + deltaParticipants)
  const apres = calculerRentabilite({
    excursion,
    lignes: lignesModifiees,
    adultes: nouvAdultes,
    enfants,
    bebes,
    capaciteVehicule: capacite,
  })

  return { avant, apres }
}

export interface LocationRecommandation {
  mode: 'LONGUE_DUREE' | 'PONCTUELLE'
  coutLongueDuree: number
  coutPonctuel: number
  economie: number
  pointBascule: number | null
  message: string
}

/**
 * Recommande location longue durée (loyer mensuel fixe) vs ponctuelle
 * (prix/jour × jours utilisés). Calcule le point de bascule en jours/mois.
 */
export function recommanderLocation(
  loyerMensuel: number,
  joursParMois: number,
  prixPonctuelJour: number,
): LocationRecommandation {
  const coutLongueDuree = round2(loyerMensuel)
  const coutPonctuel = round2(prixPonctuelJour * joursParMois)
  const economie = round2(Math.abs(coutLongueDuree - coutPonctuel))
  const pointBascule =
    prixPonctuelJour > 0 ? round2(loyerMensuel / prixPonctuelJour) : null

  const longueDureeMoinsChere = coutLongueDuree < coutPonctuel
  const mode = longueDureeMoinsChere ? 'LONGUE_DUREE' : 'PONCTUELLE'
  const bascule =
    pointBascule == null
      ? ''
      : ` Point de bascule : ${pointBascule} jours/mois (au-delà, la longue durée devient plus avantageuse).`

  const message = longueDureeMoinsChere
    ? `À ${joursParMois} jours/mois, la location longue durée coûte ${coutLongueDuree} TND contre ${coutPonctuel} TND en ponctuel : vous économisez ${economie} TND/mois.${bascule}`
    : `À ${joursParMois} jours/mois, la location ponctuelle coûte ${coutPonctuel} TND contre ${coutLongueDuree} TND en longue durée : vous économisez ${economie} TND/mois.${bascule}`

  return { mode, coutLongueDuree, coutPonctuel, economie, pointBascule, message }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(+d)) return iso
  return d.toLocaleDateString('fr-FR')
}

// ============================================================
//  COMPOSANT REACT
// ============================================================

export function IAAnalytics() {
  const [excursions, setExcursions] = useState<Excursion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('excursions')
      .select('*')
      .order('code_interne')
    if (error) setError(error.message)
    const list = (data as Excursion[]) ?? []
    setExcursions(list)
    if (list.length > 0) setSelectedId((prev) => prev || list[0].id)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => excursions.find((e) => e.id === selectedId) ?? null,
    [excursions, selectedId],
  )

  if (loading) return <p className="text-slate-500">Chargement de l'assistant d'analyse…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Assistant IA analytique</h2>
        <p className="text-sm text-slate-500">
          Analyse par règles (sans API externe) : diagnostic de marge, simulation et arbitrage location.
        </p>
      </div>

      {excursions.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune excursion. Exécute <code>supabase/seed.sql</code> pour charger le catalogue.
        </p>
      ) : (
        <>
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Excursion analysée</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full max-w-md rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {excursions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code_interne} — {e.nom}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected && <AnalyseExcursion key={selected.id} excursion={selected} />}
        </>
      )}

      <LocationAdvisor />
    </div>
  )
}

// ----- Bloc dépendant de l'excursion sélectionnée -----------
function AnalyseExcursion({ excursion }: { excursion: Excursion }) {
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [historique, setHistorique] = useState<CostHistoryRow[]>([])
  const [prixRestos, setPrixRestos] = useState<RestaurantPriceRow[]>([])
  const [loading, setLoading] = useState(true)

  const [adultes, setAdultes] = useState(10)
  const [enfants, setEnfants] = useState(0)
  const [bebes, setBebes] = useState(0)
  const [capacite, setCapacite] = useState(5)
  const [carburantPct, setCarburantPct] = useState(0)
  const [deltaParticipants, setDeltaParticipants] = useState(0)

  useEffect(() => {
    let actif = true
    setLoading(true)
    Promise.all([
      supabase.from('excursion_cost_lines').select('*').eq('excursion_id', excursion.id).order('jour'),
      supabase.from('cost_history').select('*').order('date', { ascending: false }),
      supabase.from('restaurant_prices').select('*'),
    ]).then(([lignesRes, histRes, restoRes]) => {
      if (!actif) return
      setLignes((lignesRes.data as CostLine[]) ?? [])
      setHistorique((histRes.data as CostHistoryRow[]) ?? [])
      setPrixRestos((restoRes.data as RestaurantPriceRow[]) ?? [])
      setLoading(false)
    })
    return () => {
      actif = false
    }
  }, [excursion.id])

  const payants = adultes + enfants

  const explications = useMemo(
    () => analyserBaisseMarge(historique, prixRestos, payants),
    [historique, prixRestos, payants],
  )

  const { avant, apres } = useMemo(
    () =>
      simulerScenario(
        excursion,
        lignes,
        adultes,
        enfants,
        bebes,
        capacite,
        carburantPct,
        deltaParticipants,
      ),
    [excursion, lignes, adultes, enfants, bebes, capacite, carburantPct, deltaParticipants],
  )

  const deltaMarge = round2(apres.margeTnd - avant.margeTnd)

  return (
    <div className="space-y-4">
      {/* Effectif de référence */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow">
        <NumField label="Adultes" value={adultes} onChange={setAdultes} />
        <NumField label="Enfants" value={enfants} onChange={setEnfants} />
        <NumField label="Bébés" value={bebes} onChange={setBebes} />
        <NumField label="Capacité véhicule" value={capacite} onChange={setCapacite} min={1} />
      </div>

      {/* Pourquoi la marge baisse ? */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Pourquoi la marge baisse ?</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Analyse de l'historique…</p>
        ) : explications.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune hausse de coût détectée dans l'historique (<code>cost_history</code>,{' '}
            <code>restaurant_prices</code>). La marge est stable.
          </p>
        ) : (
          <ul className="space-y-2">
            {explications.map((ex, i) => (
              <li key={i} className="rounded border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={ex.severity} />
                  <span className="font-medium">{ex.titre}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{ex.detail}</p>
                <p className="mt-1 text-sm font-medium text-red-700">Impact : {ex.impact}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Simulation */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Simulation d'un scénario</h3>
        <div className="mb-4 flex flex-wrap gap-6">
          <SliderField
            label={`Augmenter carburant / transport de ${carburantPct} %`}
            value={carburantPct}
            min={-50}
            max={100}
            step={5}
            onChange={setCarburantPct}
          />
          <SliderField
            label={`Variation participants : ${deltaParticipants >= 0 ? '+' : ''}${deltaParticipants}`}
            value={deltaParticipants}
            min={-20}
            max={20}
            step={1}
            onChange={setDeltaParticipants}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Marge avant" value={`${avant.margeTnd.toFixed(0)} TND`} sub={`${avant.margePct.toFixed(1)} %`} />
          <Stat
            label="Marge après"
            value={`${apres.margeTnd.toFixed(0)} TND`}
            sub={`${apres.margePct.toFixed(1)} %`}
            tone={apres.margeTnd >= 0 ? 'good' : 'bad'}
          />
          <Stat
            label="Écart marge"
            value={`${deltaMarge >= 0 ? '+' : ''}${deltaMarge.toFixed(0)} TND`}
            sub="impact scénario"
            tone={deltaMarge >= 0 ? 'good' : 'bad'}
          />
          <Stat
            label="Seuil après"
            value={apres.seuilRentabilite == null ? '∞' : `${apres.seuilRentabilite} pers`}
            sub="minimum payants"
            tone={apres.seuilRentabilite == null ? 'bad' : 'neutral'}
          />
        </div>
      </div>
    </div>
  )
}

// ----- Arbitrage location longue durée vs ponctuelle --------
function LocationAdvisor() {
  const [loyer, setLoyer] = useState(2500)
  const [jours, setJours] = useState(12)
  const [prixJour, setPrixJour] = useState(180)

  const reco = useMemo(
    () => recommanderLocation(loyer, jours, prixJour),
    [loyer, jours, prixJour],
  )

  return (
    <div className="mt-4 rounded-lg bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold">Location véhicule : longue durée vs ponctuelle</h3>
      <div className="mb-4 flex flex-wrap gap-4">
        <NumField label="Loyer mensuel (TND)" value={loyer} onChange={setLoyer} />
        <NumField label="Jours d'utilisation / mois" value={jours} onChange={setJours} min={0} />
        <NumField label="Prix location ponctuelle / jour (TND)" value={prixJour} onChange={setPrixJour} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Longue durée"
          value={`${reco.coutLongueDuree.toFixed(0)} TND`}
          sub="loyer mensuel"
          tone={reco.mode === 'LONGUE_DUREE' ? 'good' : 'neutral'}
        />
        <Stat
          label="Ponctuelle"
          value={`${reco.coutPonctuel.toFixed(0)} TND`}
          sub={`${jours} j × ${prixJour} TND`}
          tone={reco.mode === 'PONCTUELLE' ? 'good' : 'neutral'}
        />
        <Stat
          label="Point de bascule"
          value={reco.pointBascule == null ? '—' : `${reco.pointBascule.toFixed(1)} j/mois`}
          sub="seuil d'équilibre"
        />
      </div>
      <div
        className={`rounded border px-4 py-3 text-sm ${
          reco.mode === 'LONGUE_DUREE'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : 'border-green-200 bg-green-50 text-green-800'
        }`}
      >
        <strong>Recommandation : {reco.mode === 'LONGUE_DUREE' ? 'location longue durée' : 'location ponctuelle'}.</strong>{' '}
        {reco.message}
      </div>
    </div>
  )
}

// ============================================================
//  Sous-composants UI
// ============================================================

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, { cls: string; label: string }> = {
    high: { cls: 'bg-red-100 text-red-700', label: 'élevé' },
    medium: { cls: 'bg-amber-100 text-amber-700', label: 'moyen' },
    low: { cls: 'bg-slate-100 text-slate-600', label: 'faible' },
  }
  const { cls, label } = map[severity]
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>Impact {label}</span>
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-40 rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-56 accent-blue-600"
      />
    </label>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
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

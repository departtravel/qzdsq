import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
  type RentabilityResult,
} from '../../lib/erp'

// ----- Types locaux (miroir lecture seule des tables Supabase) -----
interface Supplier {
  id: string
  nom: string
  type: string | null
  solde_actuel: number
  actif: boolean
}

interface SupplierInvoice {
  id: string
  supplier_id: string
  montant: number | null
  statut: string // RECUE | MANQUANTE | VALIDEE | PAYEE
}

interface FixedCharge {
  montant: number
  periodicite: string
  actif: boolean
}

interface Booking {
  id: string
  excursion_id: string | null
  date_excursion: string | null
  client_nom: string | null
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  statut: string
  guide_id: string | null
  vehicle_id: string | null
  driver_id: string | null
}

// Effectif de référence utilisé quand aucune réservation réelle n'existe.
const CAPACITE_VEHICULE_DEFAUT = 5

interface ExcursionKpi {
  excursion: Excursion
  result: RentabilityResult
  reel: boolean // true si basé sur des bookings réels
}

// Tableau de bord agrégé pour la direction.
export function DashboardDirection() {
  const [excursions, setExcursions] = useState<Excursion[]>([])
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [charges, setCharges] = useState<FixedCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Mois analysé pour le résultat net (défaut : mois courant).
  const now = new Date()
  const [mois, setMois] = useState(now.toISOString().slice(0, 7)) // 'YYYY-MM'

  useEffect(() => {
    let annule = false
    async function load() {
      setLoading(true)
      setError(null)
      const [exc, lin, boo, sup, inv, chg] = await Promise.all([
        supabase.from('excursions').select('*').order('code_interne'),
        supabase.from('excursion_cost_lines').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('suppliers').select('*').order('nom'),
        supabase.from('supplier_invoices').select('*'),
        supabase.from('fixed_charges').select('montant, periodicite, actif'),
      ])
      if (annule) return
      const firstError =
        exc.error || lin.error || boo.error || sup.error || inv.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }
      setExcursions((exc.data as Excursion[]) ?? [])
      setLignes((lin.data as CostLine[]) ?? [])
      setBookings((boo.data as Booking[]) ?? [])
      setSuppliers((sup.data as Supplier[]) ?? [])
      setInvoices((inv.data as SupplierInvoice[]) ?? [])
      setCharges((chg.data as FixedCharge[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      annule = true
    }
  }, [])

  // Calcul de rentabilité par excursion — UNIQUEMENT sur les réservations
  // réelles. Le tableau de bord reste vide tant qu'aucune réservation n'existe.
  const kpis = useMemo<ExcursionKpi[]>(() => {
    return excursions
      .map((excursion): ExcursionKpi | null => {
        const bookingsExc = bookings.filter(
          (b) => b.excursion_id === excursion.id && b.statut !== 'ANNULEE',
        )
        const adultes = bookingsExc.reduce((s, b) => s + b.nombre_adultes, 0)
        const enfants = bookingsExc.reduce((s, b) => s + b.nombre_enfants, 0)
        const bebes = bookingsExc.reduce((s, b) => s + b.nombre_bebes, 0)
        // Pas de réservation payante -> on n'affiche pas cette excursion.
        if (adultes + enfants + bebes === 0) return null
        const lignesExc = lignes.filter((l) => l.excursion_id === excursion.id)
        const result = calculerRentabilite({
          excursion,
          lignes: lignesExc,
          adultes,
          enfants,
          bebes,
          capaciteVehicule: CAPACITE_VEHICULE_DEFAUT,
        })
        return { excursion, result, reel: true }
      })
      .filter((k): k is ExcursionKpi => k !== null)
  }, [excursions, lignes, bookings])

  // Agrégats globaux.
  const totaux = useMemo(() => {
    return kpis.reduce(
      (acc, k) => {
        acc.caBrutEur += k.result.caBrutEur
        acc.commissionEur += k.result.commissionEur
        acc.caNetEur += k.result.caNetEur
        acc.coutTotalTnd += k.result.coutTotalTnd
        acc.margeTnd += k.result.margeTnd
        return acc
      },
      {
        caBrutEur: 0,
        commissionEur: 0,
        caNetEur: 0,
        coutTotalTnd: 0,
        margeTnd: 0,
      },
    )
  }, [kpis])

  // Charges fixes ramenées au mois.
  const chargesMensuelles = useMemo(() => {
    return charges
      .filter((c) => c.actif)
      .reduce((s, c) => {
        if (c.periodicite === 'ANNUEL') return s + c.montant / 12
        if (c.periodicite === 'TRIMESTRIEL') return s + c.montant / 3
        if (c.periodicite === 'PONCTUEL') return s
        return s + c.montant
      }, 0)
  }, [charges])

  // Résultat net du mois sélectionné = marge des sorties du mois − charges fixes.
  const resultatMois = useMemo(() => {
    let margeMois = 0
    for (const excursion of excursions) {
      const bk = bookings.filter(
        (b) =>
          b.excursion_id === excursion.id &&
          b.statut !== 'ANNULEE' &&
          (b.date_excursion ?? '').slice(0, 7) === mois,
      )
      const ad = bk.reduce((s, b) => s + b.nombre_adultes, 0)
      const en = bk.reduce((s, b) => s + b.nombre_enfants, 0)
      const be = bk.reduce((s, b) => s + b.nombre_bebes, 0)
      if (ad + en + be === 0) continue
      const lignesExc = lignes.filter((l) => l.excursion_id === excursion.id)
      const r = calculerRentabilite({
        excursion, lignes: lignesExc, adultes: ad, enfants: en, bebes: be,
        capaciteVehicule: CAPACITE_VEHICULE_DEFAUT,
      })
      margeMois += r.margeTnd
    }
    return { margeMois, net: margeMois - chargesMensuelles }
  }, [excursions, bookings, lignes, mois, chargesMensuelles])

  // À faire en urgence.
  const urgences = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const nomExc = (id: string | null) =>
      excursions.find((e) => e.id === id)?.nom ?? 'Excursion'
    const aConfirmer = bookings.filter((b) => b.statut === 'NOUVELLE')
    const aVenirSansAffectation = bookings.filter(
      (b) =>
        b.statut !== 'ANNULEE' &&
        b.statut !== 'CLOTUREE' &&
        (b.date_excursion ?? '') >= today &&
        (!b.guide_id || !b.vehicle_id || !b.driver_id),
    )
    return { today, nomExc, aConfirmer, aVenirSansAffectation }
  }, [bookings, excursions])

  const topRentables = useMemo(
    () => [...kpis].sort((a, b) => b.result.margeTnd - a.result.margeTnd).slice(0, 10),
    [kpis],
  )
  const deficitaires = useMemo(
    () =>
      kpis
        .filter((k) => k.result.margeTnd < 0)
        .sort((a, b) => a.result.margeTnd - b.result.margeTnd),
    [kpis],
  )

  // Fournisseurs à payer (solde positif = dû) et factures manquantes.
  const facturesManquantesParFournisseur = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of invoices) {
      if (inv.statut === 'MANQUANTE') {
        map.set(inv.supplier_id, (map.get(inv.supplier_id) ?? 0) + 1)
      }
    }
    return map
  }, [invoices])

  const fournisseursAPayer = useMemo(
    () =>
      [...suppliers]
        .filter((s) => s.solde_actuel > 0)
        .sort((a, b) => b.solde_actuel - a.solde_actuel),
    [suppliers],
  )

  const totalFacturesManquantes = useMemo(
    () => invoices.filter((i) => i.statut === 'MANQUANTE').length,
    [invoices],
  )
  const totalDuFournisseursTnd = useMemo(
    () => suppliers.reduce((s, f) => s + Math.max(0, f.solde_actuel), 0),
    [suppliers],
  )

  const supplierName = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliers) m.set(s.id, s.nom)
    return m
  }, [suppliers])

  if (loading) return <p className="text-slate-500">Chargement du tableau de bord…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  if (excursions.length === 0)
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Tableau de bord direction</h2>
        <p className="text-sm text-slate-500">
          Aucune donnée. Exécute <code>supabase/seed.sql</code> pour charger le catalogue.
        </p>
      </div>
    )

  const margeGlobalePositive = totaux.margeTnd >= 0

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Tableau de bord direction</h2>
        <p className="text-sm text-slate-500">
          {excursions.length} excursions au catalogue · chiffres basés uniquement sur les
          réservations réelles ({kpis.length} excursion(s) avec réservations).
        </p>
      </div>

      {/* À faire en urgence */}
      {(urgences.aConfirmer.length > 0 ||
        urgences.aVenirSansAffectation.length > 0 ||
        totalFacturesManquantes > 0) && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-semibold text-amber-900">⚠️ À faire en urgence</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <UrgenceCard
              n={urgences.aConfirmer.length}
              label="réservation(s) à confirmer"
              detail={urgences.aConfirmer.slice(0, 4).map(
                (b) => `${b.date_excursion ?? '?'} · ${urgences.nomExc(b.excursion_id)}`,
              )}
            />
            <UrgenceCard
              n={urgences.aVenirSansAffectation.length}
              label="sortie(s) à venir sans guide/véhicule/chauffeur"
              detail={urgences.aVenirSansAffectation.slice(0, 4).map(
                (b) => `${b.date_excursion ?? '?'} · ${urgences.nomExc(b.excursion_id)}`,
              )}
            />
            <UrgenceCard
              n={totalFacturesManquantes}
              label="facture(s) fournisseur manquante(s)"
              detail={[]}
            />
          </div>
        </div>
      )}

      {/* Résultat net du mois */}
      <div className="mb-6 rounded-lg border bg-white p-4 shadow">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Résultat net du mois</h3>
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Marge des sorties (mois)" value={`${resultatMois.margeMois.toFixed(0)} TND`} tone={resultatMois.margeMois >= 0 ? 'good' : 'bad'} />
          <Stat label="Charges fixes / mois" value={`${chargesMensuelles.toFixed(0)} TND`} tone="bad" />
          <Stat
            label="RÉSULTAT NET"
            value={`${resultatMois.net.toFixed(0)} TND`}
            tone={resultatMois.net >= 0 ? 'good' : 'bad'}
            sub={resultatMois.net >= 0 ? 'bénéfice' : 'perte'}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Marge des sorties du mois (CA net − coûts variables) moins les charges fixes mensualisées.
        </p>
      </div>

      {/* Cartes KPI (cumul basé sur les réservations réelles) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="CA brut total" value={`${totaux.caBrutEur.toFixed(0)} €`} />
        <Stat label="Commissions OTA" value={`${totaux.commissionEur.toFixed(0)} €`} tone="bad" />
        <Stat label="CA net total" value={`${totaux.caNetEur.toFixed(0)} €`} />
        <Stat label="Coût total estimé" value={`${totaux.coutTotalTnd.toFixed(0)} TND`} />
        <Stat
          label="Marge globale"
          value={`${totaux.margeTnd.toFixed(0)} TND`}
          tone={margeGlobalePositive ? 'good' : 'bad'}
        />
      </div>

      {/* Top excursions rentables */}
      <section className="mb-6">
        <h3 className="mb-2 font-semibold">Top excursions rentables</h3>
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2 text-center">Base</th>
                <th className="px-3 py-2 text-right">CA net TND</th>
                <th className="px-3 py-2 text-right">Coût TND</th>
                <th className="px-3 py-2 text-right">Marge TND</th>
                <th className="px-3 py-2 text-right">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {topRentables.map((k) => (
                <tr key={k.excursion.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
                    {k.excursion.code_interne}
                  </td>
                  <td className="px-3 py-2">{k.excursion.nom}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        k.reel ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {k.reel ? 'réel' : 'réf.'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{k.result.caNetTnd.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right">{k.result.coutTotalTnd.toFixed(0)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      k.result.margeTnd >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {k.result.margeTnd.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {k.result.margePct.toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Excursions déficitaires */}
      <section className="mb-6">
        <h3 className="mb-2 font-semibold">
          Excursions déficitaires ({deficitaires.length})
        </h3>
        {deficitaires.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-green-700 shadow">
            Aucune excursion déficitaire.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="w-full text-sm">
              <thead className="border-b bg-red-50 text-left text-red-700">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2 text-right">CA net TND</th>
                  <th className="px-3 py-2 text-right">Coût TND</th>
                  <th className="px-3 py-2 text-right">Marge TND</th>
                  <th className="px-3 py-2 text-right">Seuil pers.</th>
                </tr>
              </thead>
              <tbody>
                {deficitaires.map((k) => (
                  <tr key={k.excursion.id} className="border-b bg-red-50/40 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-red-500">
                      {k.excursion.code_interne}
                    </td>
                    <td className="px-3 py-2 text-red-700">{k.excursion.nom}</td>
                    <td className="px-3 py-2 text-right">{k.result.caNetTnd.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right">{k.result.coutTotalTnd.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-700">
                      {k.result.margeTnd.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {k.result.seuilRentabilite == null ? '∞' : k.result.seuilRentabilite}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fournisseurs à payer */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Fournisseurs à payer</h3>
          <p className="text-sm text-slate-500">
            Total dû {totalDuFournisseursTnd.toFixed(0)} TND ·{' '}
            <span className={totalFacturesManquantes > 0 ? 'text-red-700' : ''}>
              {totalFacturesManquantes} facture(s) manquante(s)
            </span>
          </p>
        </div>
        {fournisseursAPayer.length === 0 && totalFacturesManquantes === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow">
            Aucun solde fournisseur à payer et aucune facture manquante.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fournisseur</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Solde dû (TND)</th>
                  <th className="px-3 py-2 text-right">Factures manquantes</th>
                </tr>
              </thead>
              <tbody>
                {fournisseursAPayer.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-blue-50">
                    <td className="px-3 py-2">{supplierName.get(s.id) ?? s.nom}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{s.type ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {s.solde_actuel.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(() => {
                        const n = facturesManquantesParFournisseur.get(s.id) ?? 0
                        return n > 0 ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                            {n}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function UrgenceCard({ n, label, detail }: { n: number; label: string; detail: string[] }) {
  const actif = n > 0
  return (
    <div className={`rounded border p-3 ${actif ? 'border-amber-300 bg-white' : 'border-slate-200 bg-white/50'}`}>
      <p className={`text-2xl font-bold ${actif ? 'text-amber-700' : 'text-slate-300'}`}>{n}</p>
      <p className="text-xs text-slate-600">{label}</p>
      {detail.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
          {detail.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      )}
    </div>
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

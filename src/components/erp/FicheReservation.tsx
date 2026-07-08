import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'

// ============================================================
//  FICHE DES RÉSERVATIONS À EFFECTUER — par excursion + date
//  Liste, pour Karima (logistique), tout ce qui doit être
//  réservé auprès des partenaires : transport, guide, repas
//  (jour + restaurant + pax + régimes), hébergement, extras.
// ============================================================

interface ExcursionOption { id: string; code_interne: string | null; nom: string }
interface CostLine {
  id: string; jour: number; categorie: string; type_depense: string | null
  nom_depense: string; quantite: number; prix_unitaire: number; devise: string
}
interface Booking {
  id: string; client_nom: string | null
  nombre_adultes: number; nombre_enfants: number; nombre_bebes: number
  regime: string | null; extras: string | null; statut: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

const CAT_LABEL: Record<string, string> = {
  TRANSPORT: '🚐 Transport', GUIDE: '🧭 Guide', CHAUFFEUR: '👤 Chauffeur',
  RESTAURANT: '🍽️ Repas', HEBERGEMENT: '🏨 Hébergement', EXTRA: '🎟️ Extras',
  GASOIL: '⛽ Gasoil', PEAGE: '🛣️ Péage', PARKING: '🅿️ Parking', AUTRE: '• Autre',
}
const ORDER = ['TRANSPORT', 'GUIDE', 'CHAUFFEUR', 'RESTAURANT', 'HEBERGEMENT', 'EXTRA', 'GASOIL', 'PEAGE', 'PARKING', 'AUTRE']

export function FicheReservation() {
  const settings = useSettings()
  const [excursions, setExcursions] = useState<ExcursionOption[]>([])
  const [excursionId, setExcursionId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('excursions').select('id, code_interne, nom').order('code_interne')
      .then(({ data }) => { setExcursions((data as ExcursionOption[]) ?? []); setLoading(false) })
  }, [])

  const load = useCallback(async () => {
    if (!excursionId || !date) { setLignes([]); setBookings([]); return }
    setError(null)
    const [c, b] = await Promise.all([
      supabase.from('excursion_cost_lines').select('id, jour, categorie, type_depense, nom_depense, quantite, prix_unitaire, devise')
        .eq('excursion_id', excursionId).order('jour'),
      supabase.from('bookings').select('id, client_nom, nombre_adultes, nombre_enfants, nombre_bebes, regime, extras, statut')
        .eq('excursion_id', excursionId).eq('date_excursion', date).neq('statut', 'ANNULEE'),
    ])
    if (c.error) setError(c.error.message)
    setLignes((c.data as CostLine[]) ?? [])
    setBookings((b.data as Booking[]) ?? [])
  }, [excursionId, date])

  useEffect(() => { load() }, [load])

  const excursion = excursions.find((e) => e.id === excursionId) ?? null

  const totaux = useMemo(() => bookings.reduce(
    (a, b) => ({ a: a.a + b.nombre_adultes, e: a.e + b.nombre_enfants, b: a.b + b.nombre_bebes }),
    { a: 0, e: 0, b: 0 },
  ), [bookings])

  const regimes = useMemo(
    () => bookings.filter((b) => b.regime && b.regime.trim())
      .map((b) => `${b.client_nom ?? 'Client'} : ${b.regime}`),
    [bookings],
  )
  const extrasList = useMemo(
    () => bookings.filter((b) => b.extras && b.extras.trim())
      .map((b) => `${b.client_nom ?? 'Client'} : ${b.extras}`),
    [bookings],
  )

  // Regroupe les lignes de coût par catégorie puis par jour.
  const parCategorie = useMemo(() => {
    const map = new Map<string, CostLine[]>()
    for (const l of lignes) {
      const arr = map.get(l.categorie) ?? []
      arr.push(l)
      map.set(l.categorie, arr)
    }
    return ORDER.filter((c) => map.has(c)).map((c) => ({ cat: c, lignes: map.get(c)! }))
  }, [lignes])

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Excursion</span>
          <select value={excursionId} onChange={(e) => setExcursionId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1">
            <option value="">— choisir —</option>
            {excursions.map((ex) => <option key={ex.id} value={ex.id}>{ex.code_interne} · {ex.nom}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1" />
        </label>
        {excursion && (
          <button onClick={() => window.print()}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🖨️ Imprimer</button>
        )}
      </div>

      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!excursion ? (
        <p className="text-slate-500">Choisis une excursion et une date pour générer la fiche des réservations à effectuer.</p>
      ) : (
        <div className="printable rounded-lg border bg-white p-6 shadow">
          <div className="mb-4 flex items-start justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              {settings.logo && <img src={settings.logo} alt="logo" className="max-h-16" />}
              <div>
                <h1 className="text-xl font-bold">RÉSERVATIONS À EFFECTUER</h1>
                <p className="text-sm text-slate-500">{settings.company_name} · logistique (Karima)</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p><strong>Date :</strong> {date}</p>
              <p className="font-mono text-xs text-slate-400">{excursion.code_interne}</p>
            </div>
          </div>

          <h2 className="mb-1 font-semibold">{excursion.nom}</h2>
          <p className="mb-4 text-sm text-slate-500">
            Effectif total : <strong>{totaux.a}</strong> adulte(s), <strong>{totaux.e}</strong> enfant(s),{' '}
            <strong>{totaux.b}</strong> bébé(s) — {bookings.length} réservation(s)
          </p>

          {lignes.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun partenaire configuré pour cette excursion (ajoute des lignes de coût, ou exécute seed_dts.sql).
            </p>
          ) : (
            <div className="space-y-4">
              {parCategorie.map(({ cat, lignes }) => (
                <div key={cat} className="rounded border">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">{CAT_LABEL[cat] ?? cat}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {lignes.map((l) => {
                        // Quantité à réserver selon le mode de tarification.
                        let qte = '—'
                        if (l.type_depense === 'PAR_PERSONNE') qte = `${totaux.a} ad. + ${totaux.e} enf.`
                        else if (l.type_depense === 'PAR_GROUPE' || l.type_depense === 'FIXE') qte = '1 (groupe)'
                        else if (l.type_depense === 'PAR_VEHICULE') qte = 'selon véhicules'
                        return (
                          <tr key={l.id} className="border-t first:border-0">
                            <td className="px-3 py-1.5">
                              {l.nom_depense}
                              {l.jour > 1 && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">Jour {l.jour}</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500">À réserver : {qte}</td>
                            <td className="w-24 px-3 py-1.5 text-right text-slate-400">
                              {l.prix_unitaire} {l.devise}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Régimes & extras à signaler aux partenaires */}
          {(regimes.length > 0 || extrasList.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {regimes.length > 0 && (
                <div className="rounded border p-3 text-sm">
                  <p className="mb-1 font-semibold">Régimes / remarques repas</p>
                  <ul className="list-disc pl-5 text-slate-600">
                    {regimes.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {extrasList.length > 0 && (
                <div className="rounded border p-3 text-sm">
                  <p className="mb-1 font-semibold">Extras demandés</p>
                  <ul className="list-disc pl-5 text-slate-600">
                    {extrasList.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

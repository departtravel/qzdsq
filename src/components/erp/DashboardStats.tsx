import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerKpis, compterPar, topProduits, tauxDevisGagnes,
  type BookingStat, type QuoteStat,
} from '../../lib/stats'

type Periode = 7 | 30 | 90 | 3650

export function DashboardStats() {
  const [bookings, setBookings] = useState<(BookingStat & { created_at: string })[]>([])
  const [quotes, setQuotes] = useState<(QuoteStat & { created_at: string })[]>([])
  const [visits, setVisits] = useState<{ created_at: string }[]>([])
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periode, setPeriode] = useState<Periode>(30)

  useEffect(() => {
    Promise.all([
      supabase.from('bookings').select('excursion_id, statut, montant_total, type_sortie, created_at'),
      supabase.from('quote_requests').select('type, statut, created_at'),
      supabase.from('site_visits').select('created_at'),
      supabase.from('excursions').select('id, nom'),
    ]).then(([bk, qt, vs, ex]) => {
      if (bk.error) { setError(bk.error.message); setLoading(false); return }
      setBookings((bk.data as any[]) ?? [])
      setQuotes((qt.data as any[]) ?? [])
      setVisits((vs.data as any[]) ?? [])
      const m: Record<string, string> = {}
      for (const e of (ex.data as any[]) ?? []) m[e.id] = e.nom
      setNoms(m)
      setLoading(false)
    })
  }, [])

  const depuis = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - periode)
    return d.toISOString()
  }, [periode])

  const bk = useMemo(() => bookings.filter((b) => (b.created_at ?? '') >= depuis), [bookings, depuis])
  const qt = useMemo(() => quotes.filter((q) => (q.created_at ?? '') >= depuis), [quotes, depuis])
  const nbVisites = useMemo(() => visits.filter((v) => (v.created_at ?? '') >= depuis).length, [visits, depuis])

  const kpi = useMemo(() => calculerKpis(bk, nbVisites), [bk, nbVisites])
  const parStatut = useMemo(() => compterPar(bk, (b) => b.statut), [bk])
  const top = useMemo(() => topProduits(bk, noms), [bk, noms])
  const parTypeDevis = useMemo(() => compterPar(qt, (q) => q.type), [qt])
  const tauxGagne = useMemo(() => tauxDevisGagnes(qt), [qt])

  if (loading) return <p className="text-slate-500">Chargement des statistiques…</p>
  if (error)
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error} — as-tu exécuté <code>supabase/stats.sql</code> et <code>supabase/devis.sql</code> ?
    </div>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Direction — statistiques</h2>
        <select value={periode} onChange={(e) => setPeriode(Number(e.target.value) as Periode)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          <option value={7}>7 derniers jours</option>
          <option value={30}>30 derniers jours</option>
          <option value={90}>90 derniers jours</option>
          <option value={3650}>Tout</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Chiffre d'affaires" value={`${kpi.ca.toLocaleString('fr-FR')} €`} accent />
        <Kpi label="Réservations" value={kpi.reservationsValides.toString()} sub={`${kpi.reservations} au total`} />
        <Kpi label="Taux de conversion" value={`${kpi.tauxConversion} %`} sub={`${kpi.visites} visites`} />
        <Kpi label="Panier moyen" value={`${kpi.panierMoyen.toLocaleString('fr-FR')} €`} />
        <Kpi label="Visites (vitrine)" value={kpi.visites.toString()} />
        <Kpi label="Part privatif" value={`${kpi.partPrive} %`} />
        <Kpi label="Demandes de devis" value={qt.length.toString()} />
        <Kpi label="Devis gagnés" value={`${tauxGagne} %`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top produits */}
        <Panel titre="🏆 Top produits (par CA)">
          {top.length === 0 ? <Vide /> : (
            <table className="w-full text-sm">
              <tbody>
                {top.map((t, i) => (
                  <tr key={t.excursion_id} className="border-b last:border-0">
                    <td className="py-2 text-slate-400">{i + 1}</td>
                    <td className="py-2">{t.nom}</td>
                    <td className="py-2 text-right text-slate-500">{t.reservations} résa</td>
                    <td className="py-2 text-right font-medium">{t.ca.toLocaleString('fr-FR')} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Réservations par statut */}
        <Panel titre="📅 Réservations par statut">
          {Object.keys(parStatut).length === 0 ? <Vide /> : (
            <div className="space-y-2">
              {Object.entries(parStatut).map(([s, n]) => (
                <Barre key={s} label={s} value={n} max={Math.max(...Object.values(parStatut))} />
              ))}
            </div>
          )}
        </Panel>

        {/* Devis par type */}
        <Panel titre="🎉 Demandes de devis par type">
          {Object.keys(parTypeDevis).length === 0 ? <Vide /> : (
            <div className="space-y-2">
              {Object.entries(parTypeDevis).map(([s, n]) => (
                <Barre key={s} label={s} value={n} max={Math.max(...Object.values(parTypeDevis))} color="bg-purple-500" />
              ))}
            </div>
          )}
        </Panel>

        <Panel titre="💡 Lecture">
          <ul className="space-y-1 text-sm text-slate-500">
            <li>• Le <strong>taux de conversion</strong> = réservations / visites de la vitrine.</li>
            <li>• Le <strong>panier moyen</strong> et le CA excluent les réservations annulées.</li>
            <li>• La <strong>part privatif</strong> mesure la montée en gamme (marge plus élevée).</li>
            <li>• Les <strong>devis gagnés</strong> = gagnés / (gagnés + perdus).</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
function Panel({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-800">{titre}</h3>
      {children}
    </div>
  )
}
function Barre({ label, value, max, color = 'bg-blue-500' }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs text-slate-500"><span>{label}</span><span>{value}</span></div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  )
}
const Vide = () => <p className="text-sm text-slate-400">Aucune donnée sur la période.</p>

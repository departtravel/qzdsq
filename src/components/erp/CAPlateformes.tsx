import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'
import {
  statsParPlateforme,
  totalPlateformes,
  type LignePlateforme,
} from '../../lib/facturation'

// ============================================================
//  CA PAR PLATEFORME — tableau de bord commercial
//  « Combien j'ai fait avec GetYourGuide vs Viator, combien
//   ils prennent en commission, et combien il me reste. »
//  S'appuie sur les réservations (prix de vente + commission
//  saisis dans Facturation), regroupées par plateforme OTA.
// ============================================================

interface Booking {
  ota_channel_id: string | null
  date_excursion: string | null
  statut: string
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  prix_vente: number
  commission_montant: number
}
interface Channel { id: string; nom: string }

export function CAPlateformes() {
  const settings = useSettings()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [channels, setChannels] = useState<Map<string, string>>(new Map())
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [bk, ch] = await Promise.all([
      supabase
        .from('bookings')
        .select('ota_channel_id, date_excursion, statut, nombre_adultes, nombre_enfants, nombre_bebes, prix_vente, commission_montant')
        .neq('statut', 'ANNULEE'),
      supabase.from('ota_channels').select('id, nom'),
    ])
    if (bk.error) setError(bk.error.message)
    setBookings((bk.data as Booking[]) ?? [])
    const m = new Map<string, string>()
    for (const c of (ch.data as Channel[]) ?? []) m.set(c.id, c.nom)
    setChannels(m)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const lignes: LignePlateforme[] = bookings
      .filter((b) => (!du || (b.date_excursion ?? '') >= du) && (!au || (b.date_excursion ?? '') <= au))
      .map((b) => ({
        plateforme: (b.ota_channel_id && channels.get(b.ota_channel_id)) || '—',
        pax: b.nombre_adultes + b.nombre_enfants + b.nombre_bebes,
        prix_vente: b.prix_vente ?? 0,
        commission_montant: b.commission_montant ?? 0,
      }))
    return statsParPlateforme(lignes)
  }, [bookings, channels, du, au])

  const total = useMemo(() => totalPlateformes(stats), [stats])
  const fmt = (n: number) => n.toFixed(2)

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <div>
          <h2 className="text-lg font-semibold">Chiffre d'affaires par plateforme</h2>
          <p className="text-xs text-slate-400">
            D'après les prix de vente et commissions saisis dans l'onglet Facturation.
          </p>
        </div>
        <div className="flex-1" />
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        <button onClick={() => window.print()} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🖨️ Imprimer</button>
      </div>

      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Cartes récap */}
      <div className="no-print mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="CA brut (toutes plateformes)" value={`${fmt(total.caBrut)} €`} tone="blue" />
        <StatCard label="Commissions retenues" value={`− ${fmt(total.commissions)} €`} tone="amber" />
        <StatCard label="CA net (ce qui vous reste)" value={`${fmt(total.caNet)} €`} tone="green" />
      </div>

      <div className="printable rounded-lg border bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-3 border-b pb-3">
          {settings.logo && <img src={settings.logo} alt="logo" className="max-h-14" />}
          <div>
            <h1 className="text-lg font-bold">Chiffre d'affaires par plateforme</h1>
            <p className="text-sm text-slate-500">
              {settings.company_name}
              {(du || au) && <> · Période : {du || '…'} → {au || '…'}</>}
            </p>
          </div>
        </div>

        {stats.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune réservation sur la période.</p>
        ) : (
          <table className="w-full border text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="border px-2 py-1">Plateforme</th>
                <th className="border px-2 py-1 text-right">Réserv.</th>
                <th className="border px-2 py-1 text-right">Pers.</th>
                <th className="border px-2 py-1 text-right">CA brut</th>
                <th className="border px-2 py-1 text-right">Commission</th>
                <th className="border px-2 py-1 text-right">% comm.</th>
                <th className="border px-2 py-1 text-right">CA net</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.plateforme}>
                  <td className="border px-2 py-1 font-medium">{s.plateforme}</td>
                  <td className="border px-2 py-1 text-right">{s.reservations}</td>
                  <td className="border px-2 py-1 text-right">{s.pax}</td>
                  <td className="border px-2 py-1 text-right">{fmt(s.caBrut)} €</td>
                  <td className="border px-2 py-1 text-right text-amber-700">{fmt(s.commissions)} €</td>
                  <td className="border px-2 py-1 text-right text-slate-500">{s.commissionPct}%</td>
                  <td className="border px-2 py-1 text-right font-semibold text-green-700">{fmt(s.caNet)} €</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="border px-2 py-2">TOTAL</td>
                <td className="border px-2 py-2 text-right">{total.reservations}</td>
                <td className="border px-2 py-2 text-right">{total.pax}</td>
                <td className="border px-2 py-2 text-right">{fmt(total.caBrut)} €</td>
                <td className="border px-2 py-2 text-right">{fmt(total.commissions)} €</td>
                <td className="border px-2 py-2 text-right">{total.commissionPct}%</td>
                <td className="border px-2 py-2 text-right">{fmt(total.caNet)} €</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'green' }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-green-200 bg-green-50 text-green-800',
  }[tone]
  return (
    <div className={`rounded-lg border p-4 ${tones}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

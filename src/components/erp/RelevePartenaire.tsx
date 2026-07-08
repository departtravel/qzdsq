import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'

// ============================================================
//  RELEVÉ PRESTATAIRE — fiche comptable par partenaire
//  Quand on choisit un prestataire (restaurant, hébergement,
//  extra), on obtient toutes ses prestations : à chaque fois
//  qu'il est utilisé par une excursion, une ligne s'ajoute :
//    date · excursion · nb personnes · prix/personne · total
//  et le total général s'accumule. Toutes excursions confondues.
// ============================================================

interface Partner { key: string; type: 'RESTAURANT' | 'HEBERGEMENT' | 'EXTRA'; id: string; nom: string }
interface CostLine {
  excursion_id: string; type_depense: string | null
  prix_unitaire: number; devise: string; jour: number
}
interface Booking {
  excursion_id: string | null; date_excursion: string | null
  nombre_adultes: number; nombre_enfants: number; statut: string
}
interface Exc { id: string; code_interne: string | null; nom: string }

interface Row {
  date: string
  excursion: string
  adultes: number
  enfants: number
  pers: number
  prixPers: number
  total: number
  mode: string
  devise: string
}

export function RelevePartenaire() {
  const settings = useSettings()
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerKey, setPartnerKey] = useState('')
  const [excById, setExcById] = useState<Map<string, Exc>>(new Map())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')

  // Charge la liste des prestataires + le référentiel excursions.
  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('id, nom').order('nom'),
      supabase.from('accommodations').select('id, nom').order('nom'),
      supabase.from('extras').select('id, nom').order('nom'),
      supabase.from('excursions').select('id, code_interne, nom'),
    ]).then(([r, a, e, ex]) => {
      const list: Partner[] = [
        ...((r.data as { id: string; nom: string }[]) ?? []).map((x) => ({ key: `RESTAURANT:${x.id}`, type: 'RESTAURANT' as const, id: x.id, nom: x.nom })),
        ...((a.data as { id: string; nom: string }[]) ?? []).map((x) => ({ key: `HEBERGEMENT:${x.id}`, type: 'HEBERGEMENT' as const, id: x.id, nom: x.nom })),
        ...((e.data as { id: string; nom: string }[]) ?? []).map((x) => ({ key: `EXTRA:${x.id}`, type: 'EXTRA' as const, id: x.id, nom: x.nom })),
      ]
      setPartners(list)
      const m = new Map<string, Exc>()
      for (const x of (ex.data as Exc[]) ?? []) m.set(x.id, x)
      setExcById(m)
      setLoading(false)
    })
  }, [])

  const partner = partners.find((p) => p.key === partnerKey) ?? null

  const buildReleve = useCallback(async () => {
    if (!partner) { setRows([]); return }
    setBusy(true); setError(null)
    // 1) Lignes de coût de ce prestataire (sur toutes les excursions).
    const { data: cl, error: e1 } = await supabase
      .from('excursion_cost_lines')
      .select('excursion_id, type_depense, prix_unitaire, devise, jour')
      .eq('partner_id', partner.id)
    if (e1) { setError(e1.message); setBusy(false); return }
    const lignes = (cl as CostLine[]) ?? []
    // Prix/personne cumulé par excursion (si le prestataire sert plusieurs jours).
    const parExc = new Map<string, { prix: number; mode: string; devise: string }>()
    for (const l of lignes) {
      const prev = parExc.get(l.excursion_id) ?? { prix: 0, mode: l.type_depense ?? 'PAR_PERSONNE', devise: l.devise }
      prev.prix += l.prix_unitaire
      prev.mode = l.type_depense ?? prev.mode
      prev.devise = l.devise
      parExc.set(l.excursion_id, prev)
    }
    const excIds = [...parExc.keys()]
    if (excIds.length === 0) { setRows([]); setBusy(false); return }

    // 2) Réservations (confirmées ou plus) pour ces excursions.
    const { data: bk, error: e2 } = await supabase
      .from('bookings')
      .select('excursion_id, date_excursion, nombre_adultes, nombre_enfants, statut')
      .in('excursion_id', excIds)
      .neq('statut', 'ANNULEE')
      .neq('statut', 'NOUVELLE')
    if (e2) { setError(e2.message); setBusy(false); return }
    const bookings = (bk as Booking[]) ?? []

    // 3) Regroupe par (excursion, date) et somme les participants.
    const grouped = new Map<string, { excursion_id: string; date: string; ad: number; en: number }>()
    for (const b of bookings) {
      if (!b.excursion_id || !b.date_excursion) continue
      if (du && b.date_excursion < du) continue
      if (au && b.date_excursion > au) continue
      const k = `${b.excursion_id}|${b.date_excursion}`
      const g = grouped.get(k) ?? { excursion_id: b.excursion_id, date: b.date_excursion, ad: 0, en: 0 }
      g.ad += b.nombre_adultes ?? 0
      g.en += b.nombre_enfants ?? 0
      grouped.set(k, g)
    }

    const out: Row[] = []
    for (const g of grouped.values()) {
      const info = parExc.get(g.excursion_id)
      if (!info) continue
      const pers = g.ad + g.en
      const perGroupe = info.mode === 'PAR_GROUPE' || info.mode === 'FIXE'
      const total = perGroupe ? info.prix : info.prix * pers
      out.push({
        date: g.date,
        excursion: excById.get(g.excursion_id)?.nom ?? g.excursion_id,
        adultes: g.ad,
        enfants: g.en,
        pers,
        prixPers: info.prix,
        total,
        mode: info.mode,
        devise: info.devise,
      })
    }
    out.sort((a, b) => a.date.localeCompare(b.date))
    setRows(out)
    setBusy(false)
  }, [partner, du, au, excById])

  useEffect(() => { buildReleve() }, [buildReleve])

  const totalGeneral = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])
  const devise = rows[0]?.devise ?? 'TND'

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Prestataire</span>
          <select value={partnerKey} onChange={(e) => setPartnerKey(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1">
            <option value="">— choisir —</option>
            <optgroup label="Restaurants">
              {partners.filter((p) => p.type === 'RESTAURANT').map((p) => <option key={p.key} value={p.key}>{p.nom}</option>)}
            </optgroup>
            <optgroup label="Hébergements">
              {partners.filter((p) => p.type === 'HEBERGEMENT').map((p) => <option key={p.key} value={p.key}>{p.nom}</option>)}
            </optgroup>
            <optgroup label="Extras / prestataires">
              {partners.filter((p) => p.type === 'EXTRA').map((p) => <option key={p.key} value={p.key}>{p.nom}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        {partner && (
          <button onClick={() => window.print()} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🖨️ Imprimer</button>
        )}
      </div>

      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!partner ? (
        <p className="text-slate-500">Choisis un prestataire pour voir son relevé comptable (toutes excursions confondues).</p>
      ) : (
        <div className="printable rounded-lg border bg-white p-6 shadow">
          <div className="mb-4 flex items-start justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              {settings.logo && <img src={settings.logo} alt="logo" className="max-h-16" />}
              <div>
                <h1 className="text-xl font-bold">RELEVÉ PRESTATAIRE</h1>
                <p className="text-sm text-slate-500">{settings.company_name}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-lg font-semibold">{partner.nom}</p>
              <p className="text-slate-500">{partner.type}</p>
              {(du || au) && <p className="text-xs text-slate-400">Période : {du || '…'} → {au || '…'}</p>}
            </div>
          </div>

          {busy ? (
            <p className="text-slate-500">Calcul…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune prestation confirmée pour ce partenaire sur la période. (Les réservations doivent
              être au moins CONFIRMÉES, et les lignes de coût reliées au prestataire — voir
              <code> compta_partenaires.sql</code>.)
            </p>
          ) : (
            <table className="w-full border text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="border px-2 py-1">Date</th>
                  <th className="border px-2 py-1">Excursion</th>
                  <th className="border px-2 py-1 text-right">Adultes</th>
                  <th className="border px-2 py-1 text-right">Enfants</th>
                  <th className="border px-2 py-1 text-right">Pers.</th>
                  <th className="border px-2 py-1 text-right">Prix/pers</th>
                  <th className="border px-2 py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1 whitespace-nowrap">{r.date}</td>
                    <td className="border px-2 py-1">
                      {r.excursion}
                      {(r.mode === 'PAR_GROUPE' || r.mode === 'FIXE') && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">forfait groupe</span>
                      )}
                    </td>
                    <td className="border px-2 py-1 text-right">{r.adultes}</td>
                    <td className="border px-2 py-1 text-right">{r.enfants}</td>
                    <td className="border px-2 py-1 text-right">{r.pers}</td>
                    <td className="border px-2 py-1 text-right">{r.prixPers} {r.devise}</td>
                    <td className="border px-2 py-1 text-right font-medium">{r.total.toFixed(2)} {r.devise}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="border px-2 py-2" colSpan={6}>TOTAL À PAYER ({rows.length} prestation(s))</td>
                  <td className="border px-2 py-2 text-right">{totalGeneral.toFixed(2)} {devise}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

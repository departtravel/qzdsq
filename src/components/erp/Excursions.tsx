import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
} from '../../lib/erp'

// Vue catalogue des excursions OTA + simulateur de rentabilité.
export function Excursions() {
  const [excursions, setExcursions] = useState<Excursion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Catalogue excursions ({excursions.length})</h2>
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
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [loading, setLoading] = useState(true)
  const [adultes, setAdultes] = useState(10)
  const [enfants, setEnfants] = useState(0)
  const [bebes, setBebes] = useState(0)
  const [capacite, setCapacite] = useState(5)

  useEffect(() => {
    supabase
      .from('excursion_cost_lines')
      .select('*')
      .eq('excursion_id', excursion.id)
      .order('jour')
      .then(({ data }) => {
        setLignes((data as CostLine[]) ?? [])
        setLoading(false)
      })
  }, [excursion.id])

  const r = useMemo(
    () =>
      calculerRentabilite({
        excursion,
        lignes,
        adultes,
        enfants,
        bebes,
        capaciteVehicule: capacite,
      }),
    [excursion, lignes, adultes, enfants, bebes, capacite],
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

      {/* Simulateur d'effectif */}
      <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow">
        <NumField label="Adultes" value={adultes} onChange={setAdultes} />
        <NumField label="Enfants" value={enfants} onChange={setEnfants} />
        <NumField label="Bébés" value={bebes} onChange={setBebes} />
        <NumField label="Capacité véhicule" value={capacite} onChange={setCapacite} min={1} />
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
    </div>
  )
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

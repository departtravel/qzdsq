import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useErpRole, peutAffecter } from '../../lib/roles'
import { SignaturePad } from './SignaturePad'

// ============================================================
//  ORDRE DE MISSION — document par excursion + date
//  Date · guide (+ infos) · chauffeur (+ infos) · participants
//  (nom, pax, hôtel, prise en charge, remarques, extras) ·
//  signature + cachet enregistrés en base (mission_orders).
// ============================================================

interface ExcursionOption { id: string; code_interne: string | null; nom: string; ville_depart: string | null }
interface Booking {
  id: string; client_nom: string | null; client_telephone: string | null
  nombre_adultes: number; nombre_enfants: number; nombre_bebes: number
  langue: string | null; hotel: string | null; heure_prise_en_charge: string | null
  regime: string | null; extras: string | null; notes: string | null; statut: string
  guide_id: string | null; driver_id: string | null; vehicle_id: string | null
}
interface Guide { id: string; nom: string; prenom: string | null; telephone: string | null; langues: string[] | null; numero_carte_professionnelle: string | null }
interface Chauffeur { id: string; nom: string; prenom: string | null; telephone: string | null; cin: string | null; permis: string | null }
interface Vehicle { id: string; immatriculation: string | null; marque: string | null; modele: string | null; type: string | null; capacite: number | null }
interface MissionOrder {
  id: string; date: string; excursion_id: string | null; guide_id: string | null
  driver_id: string | null; vehicle_id: string | null; remarque: string | null
  signature: string | null; cachet: string | null; signe_par: string | null; signe_le: string | null
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function OrdreMission() {
  const { role } = useErpRole()
  const canWrite = peutAffecter(role)

  const [excursions, setExcursions] = useState<ExcursionOption[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [excursionId, setExcursionId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Champs de l'ordre (guide/chauffeur/véhicule + signatures)
  const [guideId, setGuideId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [remarque, setRemarque] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [cachet, setCachet] = useState<string | null>(null)
  const [signePar, setSignePar] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('excursions').select('id, code_interne, nom, ville_depart').order('code_interne'),
      supabase.from('guides').select('id, nom, prenom, telephone, langues, numero_carte_professionnelle').order('nom'),
      supabase.from('chauffeurs').select('id, nom, prenom, telephone, cin, permis').order('nom'),
      supabase.from('erp_vehicles').select('id, immatriculation, marque, modele, type, capacite').order('immatriculation'),
    ]).then(([ex, g, c, v]) => {
      setExcursions((ex.data as ExcursionOption[]) ?? [])
      setGuides((g.data as Guide[]) ?? [])
      setChauffeurs((c.data as Chauffeur[]) ?? [])
      setVehicles((v.data as Vehicle[]) ?? [])
      setLoading(false)
    })
  }, [])

  const loadMission = useCallback(async () => {
    if (!excursionId || !date) {
      setBookings([]); return
    }
    setError(null); setMsg(null)
    const [b, o] = await Promise.all([
      supabase.from('bookings').select('*')
        .eq('excursion_id', excursionId).eq('date_excursion', date)
        .neq('statut', 'ANNULEE'),
      supabase.from('mission_orders').select('*')
        .eq('excursion_id', excursionId).eq('date', date).maybeSingle(),
    ])
    if (b.error) setError(b.error.message)
    const list = (b.data as Booking[]) ?? []
    setBookings(list)
    const ord = (o.data as MissionOrder | null) ?? null
    // Pré-remplit depuis l'ordre existant, sinon depuis la 1ʳᵉ affectation trouvée.
    const firstGuide = list.find((x) => x.guide_id)?.guide_id ?? ''
    const firstDriver = list.find((x) => x.driver_id)?.driver_id ?? ''
    const firstVeh = list.find((x) => x.vehicle_id)?.vehicle_id ?? ''
    setGuideId(ord?.guide_id ?? firstGuide)
    setDriverId(ord?.driver_id ?? firstDriver)
    setVehicleId(ord?.vehicle_id ?? firstVeh)
    setRemarque(ord?.remarque ?? '')
    setSignature(ord?.signature ?? null)
    setCachet(ord?.cachet ?? null)
    setSignePar(ord?.signe_par ?? '')
  }, [excursionId, date])

  useEffect(() => {
    loadMission()
  }, [loadMission])

  const excursion = excursions.find((e) => e.id === excursionId) ?? null
  const guide = guides.find((g) => g.id === guideId) ?? null
  const chauffeur = chauffeurs.find((c) => c.id === driverId) ?? null
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null

  const totaux = useMemo(() => {
    return bookings.reduce(
      (a, b) => ({
        a: a.a + (b.nombre_adultes ?? 0),
        e: a.e + (b.nombre_enfants ?? 0),
        b: a.b + (b.nombre_bebes ?? 0),
      }),
      { a: 0, e: 0, b: 0 },
    )
  }, [bookings])

  async function enregistrer() {
    if (!excursionId || !date) return
    setMsg(null); setError(null)
    const payload = {
      date,
      excursion_id: excursionId,
      guide_id: guideId || null,
      driver_id: driverId || null,
      vehicle_id: vehicleId || null,
      remarque: remarque || null,
      signature,
      cachet,
      signe_par: signePar || null,
      signe_le: signature || cachet ? new Date().toISOString() : null,
    }
    const { error } = await supabase
      .from('mission_orders')
      .upsert(payload, { onConflict: 'date,excursion_id' })
    if (error) setError(error.message)
    else {
      setMsg('Ordre de mission enregistré (signature/cachet sauvegardés).')
      loadMission()
    }
  }

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      {/* Sélecteurs (non imprimés) */}
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Excursion</span>
          <select value={excursionId} onChange={(e) => setExcursionId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1">
            <option value="">— choisir —</option>
            {excursions.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.code_interne} · {ex.nom}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1" />
        </label>
        {excursion && (
          <button onClick={() => window.print()}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            🖨️ Imprimer
          </button>
        )}
      </div>

      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="no-print mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}

      {!excursion ? (
        <p className="text-slate-500">Choisis une excursion et une date pour générer l'ordre de mission.</p>
      ) : (
        <>
          {/* Document imprimable */}
          <div className="printable rounded-lg border bg-white p-6 shadow">
            <div className="mb-4 flex items-start justify-between border-b pb-3">
              <div>
                <h1 className="text-xl font-bold">ORDRE DE MISSION</h1>
                <p className="text-sm text-slate-500">Depart Travel Services</p>
              </div>
              <div className="text-right text-sm">
                <p><strong>Date :</strong> {date}</p>
                <p className="font-mono text-xs text-slate-400">{excursion.code_interne}</p>
              </div>
            </div>

            <h2 className="mb-1 font-semibold">{excursion.nom}</h2>
            <p className="mb-4 text-sm text-slate-500">
              Départ : {excursion.ville_depart ?? '—'} · {totaux.a} adulte(s), {totaux.e} enfant(s), {totaux.b} bébé(s)
            </p>

            {/* Guide & chauffeur */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoCard titre="Guide">
                {guide ? (
                  <>
                    <p className="font-medium">{guide.nom} {guide.prenom}</p>
                    <p className="text-slate-500">📞 {guide.telephone ?? '—'}</p>
                    <p className="text-slate-500">Langues : {(guide.langues ?? []).join(', ') || '—'}</p>
                    {guide.numero_carte_professionnelle && <p className="text-slate-500">Carte pro : {guide.numero_carte_professionnelle}</p>}
                  </>
                ) : <p className="text-slate-400">Non affecté</p>}
              </InfoCard>
              <InfoCard titre="Chauffeur">
                {chauffeur ? (
                  <>
                    <p className="font-medium">{chauffeur.nom} {chauffeur.prenom}</p>
                    <p className="text-slate-500">📞 {chauffeur.telephone ?? '—'}</p>
                    <p className="text-slate-500">CIN : {chauffeur.cin ?? '—'} · Permis : {chauffeur.permis ?? '—'}</p>
                  </>
                ) : <p className="text-slate-400">Non affecté</p>}
              </InfoCard>
              <InfoCard titre="Véhicule">
                {vehicle ? (
                  <>
                    <p className="font-medium">{vehicle.marque} {vehicle.modele} ({vehicle.type})</p>
                    <p className="text-slate-500">{vehicle.immatriculation ?? '—'}</p>
                    <p className="text-slate-500">Capacité : {vehicle.capacite ?? '—'}</p>
                  </>
                ) : <p className="text-slate-400">Non affecté</p>}
              </InfoCard>
            </div>

            {/* Participants */}
            <h3 className="mb-2 font-semibold">Participants ({bookings.length} groupe(s))</h3>
            <table className="w-full border text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="border px-2 py-1">Client</th>
                  <th className="border px-2 py-1 text-right">Pers.</th>
                  <th className="border px-2 py-1">Hôtel</th>
                  <th className="border px-2 py-1">Prise en charge</th>
                  <th className="border px-2 py-1">Remarques</th>
                  <th className="border px-2 py-1">Extras</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const pax = (b.nombre_adultes ?? 0) + (b.nombre_enfants ?? 0) + (b.nombre_bebes ?? 0)
                  return (
                    <tr key={b.id}>
                      <td className="border px-2 py-1">
                        {b.client_nom ?? '—'}
                        {b.client_telephone && <span className="block text-xs text-slate-400">📞 {b.client_telephone}</span>}
                      </td>
                      <td className="border px-2 py-1 text-right">{pax}</td>
                      <td className="border px-2 py-1">{b.hotel ?? '—'}</td>
                      <td className="border px-2 py-1">{b.heure_prise_en_charge ?? '—'}</td>
                      <td className="border px-2 py-1">{b.regime || b.notes || '—'}</td>
                      <td className="border px-2 py-1">{b.extras ?? '—'}</td>
                    </tr>
                  )
                })}
                {bookings.length === 0 && (
                  <tr><td colSpan={6} className="border px-2 py-3 text-center text-slate-400">Aucune réservation pour cette date.</td></tr>
                )}
              </tbody>
            </table>

            {remarque && <p className="mt-3 text-sm"><strong>Remarque générale :</strong> {remarque}</p>}

            {/* Signature & cachet */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Cachet</p>
                <div className="flex h-32 items-center justify-center rounded border">
                  {cachet ? <img src={cachet} alt="cachet" className="max-h-full" /> : <span className="text-xs text-slate-300">—</span>}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Signature {signePar && <>· {signePar}</>}
                </p>
                <div className="flex h-32 items-center justify-center rounded border">
                  {signature ? <img src={signature} alt="signature" className="max-h-full" /> : <span className="text-xs text-slate-300">—</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Zone d'édition (non imprimée) */}
          {canWrite && (
            <div className="no-print mt-4 rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Compléter / signer l'ordre de mission</h3>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select label="Guide" value={guideId} onChange={setGuideId}
                  options={guides.map((g) => ({ v: g.id, l: `${g.nom} ${g.prenom ?? ''}` }))} />
                <Select label="Chauffeur" value={driverId} onChange={setDriverId}
                  options={chauffeurs.map((c) => ({ v: c.id, l: `${c.nom} ${c.prenom ?? ''}` }))} />
                <Select label="Véhicule" value={vehicleId} onChange={setVehicleId}
                  options={vehicles.map((v) => ({ v: v.id, l: `${v.immatriculation ?? ''} ${v.type ?? ''}` }))} />
              </div>
              <label className="mb-4 block text-sm">
                <span className="mb-1 block text-slate-500">Remarque générale</span>
                <input type="text" value={remarque} onChange={(e) => setRemarque(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1" />
              </label>
              <label className="mb-4 block text-sm">
                <span className="mb-1 block text-slate-500">Signé par (nom / rôle)</span>
                <input type="text" value={signePar} onChange={(e) => setSignePar(e.target.value)}
                  placeholder="Hersi — Opérations" className="w-64 rounded border border-slate-300 px-2 py-1" />
              </label>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SignaturePad label="Cachet" value={cachet} onChange={setCachet} />
                <SignaturePad label="Signature" value={signature} onChange={setSignature} />
              </div>
              <button onClick={enregistrer}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                Enregistrer l'ordre de mission
              </button>
            </div>
          )}
          {!canWrite && (
            <p className="no-print mt-3 text-xs text-slate-400">
              Seul le rôle Opérations (Hersi) peut signer et enregistrer l'ordre de mission.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function InfoCard({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-3 text-sm">
      <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{titre}</p>
      {children}
    </div>
  )
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1">
        <option value="">— aucun —</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )
}

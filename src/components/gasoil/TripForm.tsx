import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Carburant, Chauffeur, GasoilExcursion, TripInput, Vehicle } from '../../lib/types'

interface Props {
  vehicles: Vehicle[]
  chauffeurs: Chauffeur[]
  excursions: GasoilExcursion[]
  defaultKmByVehicle: Record<string, number | null>
  onSave: (input: TripInput) => Promise<void>
}

const nomComplet = (c: Chauffeur) => [c.nom, c.prenom].filter(Boolean).join(' ')

export function TripForm({ vehicles, chauffeurs, excursions, defaultKmByVehicle, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [chauffeurId, setChauffeurId] = useState('')
  const [excursionId, setExcursionId] = useState('')
  const [kmDepart, setKmDepart] = useState('')
  const [kmArrivee, setKmArrivee] = useState('')
  const [carburant, setCarburant] = useState<Carburant>('gasoil')
  const [litres, setLitres] = useState('')
  const [prix, setPrix] = useState('')
  const [montant, setMontant] = useState('')
  const [lieux, setLieux] = useState('')
  const [note, setNote] = useState('')
  const [ticket, setTicket] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dernierKm = vehicleId ? defaultKmByVehicle[vehicleId] : null

  // Pré-remplit le km de départ avec le dernier km connu du véhicule.
  useEffect(() => {
    if (dernierKm != null) setKmDepart(String(dernierKm))
  }, [dernierKm])

  function onLitres(v: string) {
    setLitres(v)
    if (prix && v) setMontant((Number(v) * Number(prix)).toFixed(2))
  }
  function onPrix(v: string) {
    setPrix(v)
    if (v && litres) setMontant((Number(litres) * Number(v)).toFixed(2))
    else if (v && montant) setLitres((Number(montant) / Number(v)).toFixed(2))
  }
  function onMontant(v: string) {
    setMontant(v)
    if (prix && v) setLitres((Number(v) / Number(prix)).toFixed(2))
  }

  const distance =
    kmDepart && kmArrivee ? Number(kmArrivee) - Number(kmDepart) : null
  const conso =
    distance && distance > 0 && litres ? (Number(litres) / distance) * 100 : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleId) return setError('Choisis un véhicule.')
    if (!kmDepart || !kmArrivee) return setError('Km départ et km arrivée obligatoires.')
    if (Number(kmArrivee) < Number(kmDepart)) return setError('Le km arrivée est inférieur au km départ.')
    setSaving(true)
    setError(null)
    try {
      // Upload éventuel de la photo du ticket de carburant.
      let ticketUrl: string | null = null
      if (ticket) {
        const ext = ticket.name.split('.').pop() || 'jpg'
        const path = `${vehicleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const up = await supabase.storage.from('tickets').upload(path, ticket, { upsert: false })
        if (up.error) throw new Error(`Ticket : ${up.error.message}`)
        ticketUrl = supabase.storage.from('tickets').getPublicUrl(path).data.publicUrl
      }
      const chauffeur = chauffeurs.find((c) => c.id === chauffeurId)
      const excursion = excursions.find((e) => e.id === excursionId)
      await onSave({
        vehicle_id: vehicleId,
        date,
        chauffeur_id: chauffeurId || null,
        chauffeur: chauffeur ? nomComplet(chauffeur) : null,
        excursion_id: excursionId || null,
        excursion: excursion ? excursion.nom : null,
        km_depart: Number(kmDepart),
        km_arrivee: Number(kmArrivee),
        carburant,
        litres: litres ? Number(litres) : 0,
        prix_litre: prix ? Number(prix) : null,
        montant: montant ? Number(montant) : null,
        lieux_prise_en_charge: lieux || null,
        ticket_url: ticketUrl,
        note: note || null,
      })
      setKmArrivee('')
      setLitres('')
      setMontant('')
      setLieux('')
      setNote('')
      setTicket(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm'
  const label = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Véhicule</label>
          <select className={input} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.matricule}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Date</label>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label}>Chauffeur</label>
          <select className={input} value={chauffeurId} onChange={(e) => setChauffeurId(e.target.value)}>
            <option value="">— choisir —</option>
            {chauffeurs.map((c) => (
              <option key={c.id} value={c.id}>{nomComplet(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Excursion</label>
          <select className={input} value={excursionId} onChange={(e) => setExcursionId(e.target.value)}>
            <option value="">— aucune —</option>
            {excursions.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>
            Km départ{dernierKm != null ? ` (dernier : ${dernierKm.toLocaleString('fr-FR')})` : ''}
          </label>
          <input type="number" className={input} value={kmDepart} onChange={(e) => setKmDepart(e.target.value)} />
        </div>
        <div>
          <label className={label}>Km arrivée</label>
          <input type="number" className={input} value={kmArrivee} onChange={(e) => setKmArrivee(e.target.value)} />
        </div>
        <div>
          <label className={label}>Carburant</label>
          <select className={input} value={carburant} onChange={(e) => setCarburant(e.target.value as Carburant)}>
            <option value="gasoil">Gasoil</option>
            <option value="essence">Essence</option>
          </select>
        </div>
        <div>
          <label className={label}>Litres mis</label>
          <input type="number" step="0.01" className={input} value={litres} onChange={(e) => onLitres(e.target.value)} />
        </div>
        <div>
          <label className={label}>Prix / litre (DT)</label>
          <input type="number" step="0.001" className={input} value={prix} onChange={(e) => onPrix(e.target.value)} />
        </div>
        <div>
          <label className={label}>Montant (DT)</label>
          <input type="number" step="0.01" className={input} value={montant} onChange={(e) => onMontant(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={label}>Lieux de prise en charge / détours (si conso plus élevée)</label>
          <input
            className={input}
            value={lieux}
            onChange={(e) => setLieux(e.target.value)}
            placeholder="Ex : prises en charge à plusieurs hôtels, détour aéroport…"
          />
        </div>
        <div className="col-span-2">
          <label className={label}>Photo du ticket de carburant (justificatif)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className={`${input} py-1`}
            onChange={(e) => setTicket(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={label}>Note</label>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-slate-500">
          Distance :{' '}
          <b className="text-slate-700">{distance != null && distance >= 0 ? `${distance.toLocaleString('fr-FR')} km` : '—'}</b>
        </span>
        <span className="text-slate-500">
          Conso estimée : <b className="text-slate-700">{conso != null ? `${conso.toFixed(1)} L/100` : '—'}</b>
        </span>
        <button
          type="submit"
          disabled={saving}
          className="ml-auto rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Ajout…' : 'Enregistrer la sortie'}
        </button>
      </div>
    </form>
  )
}

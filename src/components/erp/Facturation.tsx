import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'
import { peutEcrire, useErpRole } from '../../lib/roles'
import {
  calculerFacture,
  pctCommission,
  prixNet,
  prochainNumero,
  TAUX_TVA,
  type FactureLigne,
  type TvaBase,
} from '../../lib/facturation'

const DEVISES = ['EUR', 'TND', 'USD'] as const

// ============================================================
//  FACTURATION — une facture PAR EXCURSION (à une date donnée).
//  Une même facture regroupe toutes les réservations de cette
//  sortie, même si elles viennent de plateformes différentes
//  avec des tarifs et des commissions différents :
//    date · N° résa · client · pax · prix vente · commission · net
//  Impression : logo, raison sociale, Matricule Fiscal.
// ============================================================

interface Booking {
  id: string
  date_excursion: string | null
  excursion_id: string | null
  ota_channel_id: string | null
  client_nom: string | null
  numero_reservation: string | null
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  statut: string
  prix_vente: number
  commission_montant: number
}
interface Exc { id: string; code_interne: string | null; nom: string; devise: string }
interface Channel { id: string; nom: string }
interface Invoice {
  id: string
  numero: string
  date_emission: string
  excursion_nom: string | null
  date_excursion: string | null
  lignes: FactureLigne[]
  total_vente: number
  total_commission: number
  total_net: number
  tva_pct: number
  tva_base: TvaBase
  montant_tva: number
  timbre_fiscal: number
  total_ttc: number
  devise: string
}

const pax = (b: Booking) => b.nombre_adultes + b.nombre_enfants + b.nombre_bebes

export function Facturation() {
  const settings = useSettings()
  const { role } = useErpRole()
  const canWrite = peutEcrire.comptabilite(role)

  const [excursions, setExcursions] = useState<Exc[]>([])
  const [channels, setChannels] = useState<Map<string, string>>(new Map())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [excId, setExcId] = useState('')
  const [date, setDate] = useState('')
  // Fiscalité & devise (aperçu live ; figées dans la facture émise).
  const [deviseSel, setDeviseSel] = useState<string>('')
  const [tvaPct, setTvaPct] = useState(0)
  const [tvaBase, setTvaBase] = useState<TvaBase>('NET')
  const [timbre, setTimbre] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Facture affichée à l'écran / impression : soit une facture émise (historique),
  // soit un aperçu en cours de construction (null => aperçu live).
  const [emise, setEmise] = useState<Invoice | null>(null)

  // ----- Chargement des référentiels + factures émises -------
  const loadInvoices = useCallback(async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('date_emission', { ascending: false })
      .order('numero', { ascending: false })
    setInvoices((data as Invoice[]) ?? [])
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('excursions').select('id, code_interne, nom, devise').order('nom'),
      supabase.from('ota_channels').select('id, nom'),
    ]).then(([ex, ch]) => {
      setExcursions((ex.data as Exc[]) ?? [])
      const m = new Map<string, string>()
      for (const c of (ch.data as Channel[]) ?? []) m.set(c.id, c.nom)
      setChannels(m)
      setLoading(false)
    })
    loadInvoices()
  }, [loadInvoices])

  // ----- Réservations de l'excursion (+ date éventuelle) ------
  const loadBookings = useCallback(async () => {
    if (!excId) { setBookings([]); return }
    setBusy(true); setError(null)
    let q = supabase
      .from('bookings')
      .select('id, date_excursion, excursion_id, ota_channel_id, client_nom, numero_reservation, nombre_adultes, nombre_enfants, nombre_bebes, statut, prix_vente, commission_montant')
      .eq('excursion_id', excId)
      .neq('statut', 'ANNULEE')
      .order('date_excursion')
    if (date) q = q.eq('date_excursion', date)
    const { data, error: e } = await q
    if (e) setError(e.message)
    setBookings((data as Booking[]) ?? [])
    setBusy(false)
  }, [excId, date])

  useEffect(() => { setEmise(null); loadBookings() }, [loadBookings])

  const exc = excursions.find((e) => e.id === excId) ?? null
  // Devise : choix explicite, sinon celle de l'excursion, sinon EUR.
  const devise = deviseSel || exc?.devise || 'EUR'

  // ----- Édition inline d'une réservation --------------------
  async function patchBooking(id: string, patch: Partial<Booking>) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
    const { error: e } = await supabase.from('bookings').update(patch).eq('id', id)
    if (e) setError(e.message)
  }

  // ----- Lignes de l'aperçu live -----------------------------
  const lignesLive: FactureLigne[] = useMemo(
    () =>
      bookings.map((b) => ({
        date: b.date_excursion ?? '',
        numero_reservation: b.numero_reservation ?? '',
        client_nom: b.client_nom ?? '',
        plateforme: (b.ota_channel_id && channels.get(b.ota_channel_id)) || '—',
        pax: pax(b),
        prix_vente: b.prix_vente ?? 0,
        commission_montant: b.commission_montant ?? 0,
        prix_net: prixNet(b.prix_vente ?? 0, b.commission_montant ?? 0),
      })),
    [bookings, channels],
  )

  // Facture montrée : historique sélectionné OU aperçu live.
  const lignes = emise ? emise.lignes : lignesLive
  const devFacture = emise ? emise.devise : devise
  // Fiscalité affichée (figée si facture émise).
  const fisc = emise
    ? { tvaPct: emise.tva_pct, tvaBase: emise.tva_base, timbre: emise.timbre_fiscal }
    : { tvaPct, tvaBase, timbre }
  const calc = useMemo(() => calculerFacture(lignes, fisc), [lignes, fisc.tvaPct, fisc.tvaBase, fisc.timbre])
  const totaux = calc.totaux

  // ----- Génération & enregistrement de la facture -----------
  async function genererFacture() {
    if (!exc || lignesLive.length === 0) return
    setBusy(true); setError(null); setMsg(null)
    // Numéro séquentiel basé sur les factures déjà émises.
    const annee = new Date().getFullYear()
    const numero = prochainNumero(annee, invoices.map((i) => i.numero))
    const c = calculerFacture(lignesLive, { tvaPct, tvaBase, timbre })
    const row = {
      numero,
      date_emission: new Date().toISOString().slice(0, 10),
      excursion_id: exc.id,
      excursion_nom: exc.nom,
      date_excursion: date || null,
      lignes: lignesLive,
      total_vente: c.totaux.vente,
      total_commission: c.totaux.commission,
      total_net: c.totaux.net,
      tva_pct: tvaPct,
      tva_base: tvaBase,
      montant_tva: c.montantTva,
      timbre_fiscal: c.timbre,
      total_ttc: c.totalTtc,
      devise,
    }
    const { data, error: e } = await supabase.from('invoices').insert(row).select('*').single()
    setBusy(false)
    if (e) { setError(e.message); return }
    await loadInvoices()
    setEmise(data as Invoice)
    setMsg(`Facture ${numero} enregistrée.`)
  }

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      {/* ----- Barre d'outils (non imprimée) ----- */}
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Excursion</span>
          <select value={excId} onChange={(e) => setExcId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1">
            <option value="">— choisir —</option>
            {excursions.map((e) => (
              <option key={e.id} value={e.id}>{e.code_interne ? `${e.code_interne} · ` : ''}{e.nom}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Date de sortie (optionnel)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Devise</span>
          <select value={deviseSel} onChange={(e) => setDeviseSel(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1" disabled={!!emise}>
            <option value="">Auto ({exc?.devise || 'EUR'})</option>
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">TVA</span>
          <select value={tvaPct} onChange={(e) => setTvaPct(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1" disabled={!!emise}>
            {TAUX_TVA.map((t) => <option key={t} value={t}>{t}%</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Base TVA</span>
          <select value={tvaBase} onChange={(e) => setTvaBase(e.target.value as TvaBase)}
            className="rounded border border-slate-300 px-2 py-1" disabled={!!emise}>
            <option value="NET">Net</option>
            <option value="VENTE">Prix de vente</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Timbre fiscal</span>
          <input type="number" min={0} step="0.01" value={timbre}
            onChange={(e) => setTimbre(parseFloat(e.target.value) || 0)}
            className="w-24 rounded border border-slate-300 px-2 py-1" disabled={!!emise} />
        </label>
        {exc && lignesLive.length > 0 && (
          <>
            <button onClick={() => window.print()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🖨️ Imprimer</button>
            {canWrite && !emise && (
              <button onClick={genererFacture} disabled={busy}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                🧾 Générer & enregistrer la facture
              </button>
            )}
            {emise && (
              <button onClick={() => setEmise(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">↩︎ Retour à l'aperçu</button>
            )}
          </>
        )}
        {!canWrite && (
          <span className="text-xs text-amber-600">Lecture seule — seule la Comptabilité peut émettre des factures.</span>
        )}
      </div>

      {msg && <div className="no-print mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!exc ? (
        <p className="text-slate-500">Choisis une excursion pour établir sa facture (toutes les réservations, toutes plateformes confondues).</p>
      ) : (
        <>
          {/* ----- Document imprimable ----- */}
          <div className="printable rounded-lg border bg-white p-6 shadow">
            {/* En-tête raison sociale + MF + logo */}
            <div className="mb-5 flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                {settings.logo && <img src={settings.logo} alt="logo" className="max-h-20" />}
                <div>
                  <p className="text-lg font-bold">{settings.company_name}</p>
                  {settings.company_mf && <p className="text-sm text-slate-600">MF : {settings.company_mf}</p>}
                  {settings.company_info && (
                    <p className="whitespace-pre-line text-xs text-slate-500">{settings.company_info}</p>
                  )}
                </div>
              </div>
              <div className="text-right text-sm">
                <h1 className="text-xl font-bold tracking-wide">FACTURE</h1>
                {emise ? (
                  <>
                    <p className="font-semibold text-slate-700">{emise.numero}</p>
                    <p className="text-xs text-slate-400">Émise le {emise.date_emission}</p>
                  </>
                ) : (
                  <p className="text-xs text-amber-500">Aperçu (non enregistrée)</p>
                )}
              </div>
            </div>

            {/* Objet : excursion + date */}
            <div className="mb-4 text-sm">
              <p><span className="text-slate-500">Excursion :</span> <span className="font-medium">{emise ? emise.excursion_nom : exc.nom}</span></p>
              {(emise ? emise.date_excursion : date) && (
                <p><span className="text-slate-500">Date de sortie :</span> {emise ? emise.date_excursion : date}</p>
              )}
            </div>

            {busy ? (
              <p className="text-slate-500">Calcul…</p>
            ) : lignes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune réservation (non annulée) pour cette sélection.</p>
            ) : (
              <table className="w-full border text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="border px-2 py-1">Date</th>
                    <th className="border px-2 py-1">N° réservation</th>
                    <th className="border px-2 py-1">Client</th>
                    <th className="border px-2 py-1">Plateforme</th>
                    <th className="border px-2 py-1 text-right">Pers.</th>
                    <th className="border px-2 py-1 text-right">Prix vente</th>
                    <th className="border px-2 py-1 text-right">Commission</th>
                    <th className="border px-2 py-1 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {emise
                    ? emise.lignes.map((l, i) => (
                        <tr key={i}>
                          <td className="border px-2 py-1 whitespace-nowrap">{l.date}</td>
                          <td className="border px-2 py-1">{l.numero_reservation}</td>
                          <td className="border px-2 py-1">{l.client_nom}</td>
                          <td className="border px-2 py-1">{l.plateforme}</td>
                          <td className="border px-2 py-1 text-right">{l.pax}</td>
                          <td className="border px-2 py-1 text-right">{l.prix_vente.toFixed(2)}</td>
                          <td className="border px-2 py-1 text-right">{l.commission_montant.toFixed(2)}</td>
                          <td className="border px-2 py-1 text-right font-medium">{l.prix_net.toFixed(2)}</td>
                        </tr>
                      ))
                    : bookings.map((b) => {
                        const net = prixNet(b.prix_vente ?? 0, b.commission_montant ?? 0)
                        return (
                          <tr key={b.id}>
                            <td className="border px-2 py-1 whitespace-nowrap">{b.date_excursion}</td>
                            <td className="border px-1 py-1">
                              <EditableText value={b.numero_reservation ?? ''} disabled={!canWrite}
                                onCommit={(v) => patchBooking(b.id, { numero_reservation: v })} />
                            </td>
                            <td className="border px-2 py-1">{b.client_nom}</td>
                            <td className="border px-2 py-1">{(b.ota_channel_id && channels.get(b.ota_channel_id)) || '—'}</td>
                            <td className="border px-2 py-1 text-right">{pax(b)}</td>
                            <td className="border px-1 py-1 text-right">
                              <EditableNumber value={b.prix_vente ?? 0} disabled={!canWrite}
                                onCommit={(v) => patchBooking(b.id, { prix_vente: v })} />
                            </td>
                            <td className="border px-1 py-1 text-right">
                              <EditableNumber value={b.commission_montant ?? 0} disabled={!canWrite}
                                onCommit={(v) => patchBooking(b.id, { commission_montant: v })} />
                              <span className="ml-1 text-xs text-slate-400">
                                {pctCommission(b.prix_vente ?? 0, b.commission_montant ?? 0)}%
                              </span>
                            </td>
                            <td className="border px-2 py-1 text-right font-medium">{net.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border px-2 py-2" colSpan={4}>TOTAL ({lignes.length} réservation·s)</td>
                    <td className="border px-2 py-2 text-right">{totaux.pax}</td>
                    <td className="border px-2 py-2 text-right">{totaux.vente.toFixed(2)} {devFacture}</td>
                    <td className="border px-2 py-2 text-right">{totaux.commission.toFixed(2)} {devFacture}</td>
                    <td className="border px-2 py-2 text-right">{totaux.net.toFixed(2)} {devFacture}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Récapitulatif fiscal : Net → TVA → Timbre → Net à payer TTC */}
            {lignes.length > 0 && (
              <div className="mt-4 flex justify-end">
                <table className="text-sm">
                  <tbody>
                    <tr>
                      <td className="py-0.5 pr-6 text-slate-500">Total net (base {fisc.tvaBase === 'VENTE' ? 'vente' : 'net'})</td>
                      <td className="py-0.5 text-right font-medium">{calc.baseTva.toFixed(2)} {devFacture}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-6 text-slate-500">TVA ({fisc.tvaPct}%)</td>
                      <td className="py-0.5 text-right">{calc.montantTva.toFixed(2)} {devFacture}</td>
                    </tr>
                    {calc.timbre > 0 && (
                      <tr>
                        <td className="py-0.5 pr-6 text-slate-500">Droit de timbre</td>
                        <td className="py-0.5 text-right">{calc.timbre.toFixed(2)} {devFacture}</td>
                      </tr>
                    )}
                    <tr className="border-t">
                      <td className="py-1 pr-6 font-semibold">Net à payer (TTC)</td>
                      <td className="py-1 text-right text-base font-bold">{calc.totalTtc.toFixed(2)} {devFacture}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 border-t pt-3 text-center text-xs text-slate-400">
              <p>
                {settings.company_name}
                {settings.company_mf ? ` — MF : ${settings.company_mf}` : ''}
              </p>
              {settings.company_website && <p>{settings.company_website}</p>}
            </div>
          </div>

          {/* ----- Historique des factures émises (non imprimé) ----- */}
          {invoices.length > 0 && (
            <div className="no-print mt-6 rounded-lg bg-white p-4 shadow">
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Factures émises</h3>
              <div className="flex flex-wrap gap-2">
                {invoices.map((i) => (
                  <button key={i.id} onClick={() => setEmise(i)}
                    className={`rounded border px-2 py-1 text-xs hover:bg-slate-50 ${emise?.id === i.id ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}>
                    {i.numero} · {i.excursion_nom} · {i.total_net.toFixed(2)} {i.devise}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ----- Petits champs éditables inline -----------------------
function EditableText({ value, disabled, onCommit }: { value: string; disabled?: boolean; onCommit: (v: string) => void }) {
  if (disabled) return <span className="px-1">{value || '—'}</span>
  return (
    <input
      type="text"
      defaultValue={value}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value) }}
      className="w-28 rounded border border-slate-200 px-1 py-0.5 print:border-none"
    />
  )
}

function EditableNumber({ value, disabled, onCommit }: { value: number; disabled?: boolean; onCommit: (v: number) => void }) {
  if (disabled) return <span className="px-1">{value.toFixed(2)}</span>
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      defaultValue={value}
      onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== value) onCommit(v) }}
      className="w-20 rounded border border-slate-200 px-1 py-0.5 text-right print:border-none"
    />
  )
}

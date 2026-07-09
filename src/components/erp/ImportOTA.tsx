import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ============================================================
//  MODULE IMPORT OTA — Import CSV de réservations OTA
//  Colle un CSV ou charge un fichier .csv, mappe les colonnes,
//  prévisualise, valide, puis insère dans bookings + ota_imports.
// ============================================================

interface ExcursionRef {
  id: string
  code_interne: string
  nom: string
}

interface ChannelRef {
  id: string
  nom: string
}

// Ligne brute parsée + résultat de validation.
interface ParsedRow {
  index: number
  date: string
  excursion: string
  canal: string
  client: string
  adultes: number
  enfants: number
  bebes: number
  langue: string
  reference: string
  excursionId: string | null
  channelId: string | null
  valide: boolean
  erreurs: string[]
}

// ----- Parser CSV minimal mais robuste ----------------------
// Gère les guillemets, les virgules internes et les "" échappés.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',' || c === ';' || c === '\t') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\r') {
      i += 1
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += c
    i += 1
  }
  // dernier champ / dernière ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

// Normalise un en-tête pour le mapping (sans accents / casse).
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Associe une clé logique aux variantes d'en-tête acceptées.
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'date_excursion', 'jour'],
  excursion: ['excursion', 'code', 'code_interne', 'tour', 'produit'],
  canal: ['canal', 'channel', 'ota', 'source', 'plateforme'],
  client: ['client', 'nom', 'client_nom', 'name', 'passager'],
  adultes: ['adultes', 'adulte', 'adults', 'adult', 'pax_adulte'],
  enfants: ['enfants', 'enfant', 'children', 'child', 'pax_enfant'],
  bebes: ['bebes', 'bebe', 'babies', 'baby', 'infant', 'infants'],
  langue: ['langue', 'language', 'lang'],
  reference: ['reference', 'référence', 'ref', 'booking_reference', 'booking_id', 'reservation', 'numero'],
}

function buildHeaderMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((h, idx) => {
    const norm = normalize(h)
    for (const key of Object.keys(COLUMN_ALIASES)) {
      if (COLUMN_ALIASES[key].includes(norm) && map[key] === undefined) {
        map[key] = idx
      }
    }
  })
  return map
}

function toInt(v: string | undefined): number {
  if (!v) return 0
  const n = parseInt(v.trim(), 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

const CSV_EXEMPLE = `date,excursion,canal,client,adultes,enfants,bebes,langue
2026-07-15,DTS-001,GetYourGuide,Dupont Jean,2,1,0,fr
2026-07-16,Désert de Douz,Viator,Smith John,4,0,1,en`

export function ImportOTA() {
  const [excursions, setExcursions] = useState<ExcursionRef[]>([])
  const [channels, setChannels] = useState<ChannelRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: number; ko: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [exc, chan] = await Promise.all([
      supabase.from('excursions').select('id, code_interne, nom'),
      supabase.from('ota_channels').select('id, nom'),
    ])
    if (exc.error) setError(exc.error.message)
    else if (chan.error) setError(chan.error.message)
    setExcursions((exc.data as ExcursionRef[]) ?? [])
    setChannels((chan.data as ChannelRef[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Résolution excursion via code_interne (exact) ou nom (insensible casse).
  const resolveExcursion = useCallback(
    (value: string): string | null => {
      const v = normalize(value)
      if (!v) return null
      const byCode = excursions.find((e) => normalize(e.code_interne) === v)
      if (byCode) return byCode.id
      const byName = excursions.find((e) => normalize(e.nom) === v)
      return byName ? byName.id : null
    },
    [excursions],
  )

  const resolveChannel = useCallback(
    (value: string): string | null => {
      const v = normalize(value)
      if (!v) return null
      const c = channels.find((ch) => normalize(ch.nom) === v)
      return c ? c.id : null
    },
    [channels],
  )

  const rows = useMemo<ParsedRow[]>(() => {
    if (!raw.trim()) return []
    const grid = parseCsv(raw)
    if (grid.length === 0) return []
    const header = grid[0]
    const map = buildHeaderMap(header)
    const get = (cols: string[], key: string): string => {
      const idx = map[key]
      return idx === undefined ? '' : (cols[idx] ?? '').trim()
    }

    return grid.slice(1).map((cols, i) => {
      const date = get(cols, 'date')
      const excursion = get(cols, 'excursion')
      const canal = get(cols, 'canal')
      const client = get(cols, 'client')
      const adultes = toInt(get(cols, 'adultes'))
      const enfants = toInt(get(cols, 'enfants'))
      const bebes = toInt(get(cols, 'bebes'))
      const langue = get(cols, 'langue').toUpperCase()
      const reference = get(cols, 'reference')

      const excursionId = resolveExcursion(excursion)
      const channelId = resolveChannel(canal)

      const erreurs: string[] = []
      if (!date) erreurs.push('date manquante')
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        erreurs.push('date invalide (AAAA-MM-JJ)')
      if (!excursion) erreurs.push('excursion manquante')
      else if (!excursionId) erreurs.push('excursion introuvable')
      if (canal && !channelId) erreurs.push('canal introuvable')
      if (adultes + enfants + bebes === 0) erreurs.push('0 participant')

      return {
        index: i,
        date,
        excursion,
        canal,
        client,
        adultes,
        enfants,
        bebes,
        langue,
        reference,
        excursionId,
        channelId,
        valide: erreurs.length === 0,
        erreurs,
      }
    })
  }, [raw, resolveExcursion, resolveChannel])

  const valides = useMemo(() => rows.filter((r) => r.valide), [rows])
  const invalides = rows.length - valides.length
  const headerDetected = useMemo(() => {
    if (!raw.trim()) return []
    const grid = parseCsv(raw)
    if (grid.length === 0) return []
    return Object.keys(buildHeaderMap(grid[0]))
  }, [raw])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => setRaw(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const importer = async () => {
    if (valides.length === 0) return
    setImporting(true)
    setError(null)
    setResult(null)

    // Anti-doublon : on ignore les lignes dont la référence OTA existe déjà.
    const refs = valides.map((r) => r.reference).filter((x): x is string => !!x)
    let dejaImportees = new Set<string>()
    if (refs.length > 0) {
      const { data: existing } = await supabase
        .from('bookings')
        .select('reference')
        .in('reference', refs)
      dejaImportees = new Set(
        ((existing as { reference: string | null }[]) ?? [])
          .map((b) => b.reference)
          .filter((x): x is string => !!x),
      )
    }

    const aImporter = valides.filter(
      (r) => !r.reference || !dejaImportees.has(r.reference),
    )
    const ignorees = valides.length - aImporter.length

    const payload = aImporter.map((r) => ({
      date_excursion: r.date,
      excursion_id: r.excursionId,
      ota_channel_id: r.channelId,
      client_nom: r.client || null,
      nombre_adultes: r.adultes,
      nombre_enfants: r.enfants,
      nombre_bebes: r.bebes,
      langue: r.langue || null,
      reference: r.reference || null,
      statut: 'NOUVELLE',
    }))

    const { error: insErr } = payload.length
      ? await supabase.from('bookings').insert(payload)
      : { error: null }

    const statut = insErr ? 'ERREUR' : 'IMPORTE'
    await supabase.from('ota_imports').insert({
      source: 'CSV',
      fichier: fileName || 'collage-manuel.csv',
      statut,
    })

    if (insErr) {
      setError(insErr.message)
      setResult({ ok: 0, ko: valides.length })
    } else {
      setResult({ ok: payload.length, ko: invalides + ignorees })
      if (ignorees > 0) setError(`${ignorees} réservation(s) déjà importée(s) (référence existante) ont été ignorées.`)
      setRaw('')
      setFileName('')
    }
    setImporting(false)
  }

  if (loading) return <p className="text-slate-500">Chargement des référentiels…</p>
  if (error && excursions.length === 0)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Import OTA — réservations CSV</h2>

      {/* Cartes Stat */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lignes" value={rows.length} />
        <Stat label="Valides" value={valides.length} tone="green" />
        <Stat label="En erreur" value={invalides} tone={invalides ? 'red' : 'slate'} />
        <Stat label="Excursions réf." value={excursions.length} />
      </div>

      {/* Zone de saisie */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Charger un fichier .csv
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
          {headerDetected.length > 0 && (
            <span className="text-xs text-slate-500">
              Colonnes détectées : {headerDetected.join(', ')}
            </span>
          )}
        </div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            setResult(null)
          }}
          placeholder={`Colle ici ton CSV (avec ligne d'en-tête)…\n\n${CSV_EXEMPLE}`}
          className="h-40 w-full resize-y rounded border border-slate-300 p-3 font-mono text-xs focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={importer}
            disabled={importing || valides.length === 0}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? 'Import en cours…' : `Importer ${valides.length} ligne(s)`}
          </button>
          <button
            onClick={() => {
              setRaw(CSV_EXEMPLE)
              setResult(null)
            }}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Charger l'exemple
          </button>
        </div>
      </div>

      {/* Résultat d'import */}
      {result && (
        <div
          className={`mb-4 rounded border px-4 py-3 text-sm ${
            result.ok > 0
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {result.ok} réservation(s) importée(s), {result.ko} ignorée(s)/en erreur.
        </div>
      )}
      {error && excursions.length > 0 && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Prévisualisation */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Excursion</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2 text-right">Ad.</th>
                <th className="px-3 py-2 text-right">Enf.</th>
                <th className="px-3 py-2 text-right">Béb.</th>
                <th className="px-3 py-2">Langue</th>
                <th className="px-3 py-2">Problèmes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.index}
                  className={`border-b last:border-0 ${r.valide ? '' : 'bg-red-50'}`}
                >
                  <td className="px-3 py-2">
                    {r.valide ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">OK</span>
                    ) : (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">KO</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">
                    {r.excursion}
                    {r.excursionId && (
                      <span className="ml-1 text-xs text-green-600">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.canal}
                    {r.canal && r.channelId && (
                      <span className="ml-1 text-xs text-green-600">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.client}</td>
                  <td className="px-3 py-2 text-right">{r.adultes}</td>
                  <td className="px-3 py-2 text-right">{r.enfants}</td>
                  <td className="px-3 py-2 text-right">{r.bebes}</td>
                  <td className="px-3 py-2">{r.langue}</td>
                  <td className="px-3 py-2 text-xs text-red-600">{r.erreurs.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Aucune ligne à prévisualiser. Colle un CSV ou charge un fichier pour commencer.
          <pre className="mt-3 overflow-x-auto rounded bg-slate-50 p-3 text-left text-xs text-slate-600">
{CSV_EXEMPLE}
          </pre>
        </div>
      )}
    </div>
  )
}

// ----- Petite carte statistique -----------------------------
function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'green' | 'red'
}) {
  const color =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'red'
        ? 'text-red-600'
        : 'text-slate-800'
  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  )
}

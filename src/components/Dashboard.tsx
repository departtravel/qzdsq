import { useMemo, useState } from 'react'
import type { Person, Situation } from '../lib/types'
import { DOC_TYPE_LABEL, SITUATION_LABEL } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { downloadCsv, personsToCsv } from '../lib/export'
import { StatusBadge } from './StatusBadge'

interface Props {
  persons: Person[]
  isAdmin: boolean
  onSelect: (p: Person) => void
  onAdd: () => void
}

type Filter = Situation | 'all'

export function Dashboard({ persons, isAdmin, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const present = persons.filter((p) => !p.exit_at).length
    const bySituation = (s: Situation) => persons.filter((p) => p.situation === s).length
    return {
      present,
      identifie: bySituation('identifie'),
      non_identifie: bySituation('non_identifie'),
      en_investigation: bySituation('en_investigation'),
      rapatrie: bySituation('rapatrie'),
    }
  }, [persons])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return persons
      .filter((p) => filter === 'all' || p.situation === filter)
      .filter((p) => {
        if (!q) return true
        return [p.first_name, p.last_name, p.passport_number, p.nationality, p.remark]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      })
  }, [persons, query, filter])

  const chips: { value: Filter; label: string }[] = [
    { value: 'all', label: `Tous (${persons.length})` },
    { value: 'identifie', label: `${SITUATION_LABEL.identifie} (${counts.identifie})` },
    { value: 'non_identifie', label: `${SITUATION_LABEL.non_identifie} (${counts.non_identifie})` },
    {
      value: 'en_investigation',
      label: `${SITUATION_LABEL.en_investigation} (${counts.en_investigation})`,
    },
    { value: 'rapatrie', label: `${SITUATION_LABEL.rapatrie} (${counts.rapatrie})` },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Présents au centre" value={counts.present} color="text-slate-800" />
        <Kpi label="Identifiés" value={counts.identifie} color="text-green-600" />
        <Kpi label="Non identifiés" value={counts.non_identifie} color="text-red-600" />
        <Kpi label="Rapatriés" value={counts.rapatrie} color="text-blue-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="🔎 Rechercher (nom, n° passeport, nationalité, remarque)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => downloadCsv('personnes.csv', personsToCsv(filtered))}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
          {isAdmin && (
            <button
              onClick={onAdd}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Nouvelle personne
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === c.value
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Personne</th>
              <th className="px-4 py-3">N° passeport / doc</th>
              <th className="px-4 py-3">Remarque</th>
              <th className="px-4 py-3">Entrée</th>
              <th className="px-4 py-3">Sortie</th>
              <th className="px-4 py-3">Situation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Aucune personne ne correspond.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      {[p.last_name, p.first_name].filter(Boolean).join(' ') || 'Inconnu'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[
                        sexeShort(p.sexe),
                        p.nationality
                          ? `${p.nationality}${p.nationality_presumed ? ' (présumée)' : ''}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{p.passport_number ?? '—'}</div>
                    <div className="text-xs text-slate-400">{DOC_TYPE_LABEL[p.doc_type]}</div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <span className="line-clamp-2 text-slate-600" title={p.remark ?? ''}>
                      {p.remark || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(p.entry_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(p.exit_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge situation={p.situation} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function sexeShort(sexe: Person['sexe']): string | null {
  if (sexe === 'M') return 'H'
  if (sexe === 'F') return 'F'
  if (sexe === 'autre') return 'Autre'
  return null
}

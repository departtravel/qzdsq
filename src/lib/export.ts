import { DOC_TYPE_LABEL, SITUATION_LABEL, type Person } from './types'
import { formatDate, formatDateTime } from './format'

/** Échappe un champ pour le CSV (compatible Excel FR : séparateur ;). */
function esc(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

const HEADERS = [
  'Nom',
  'Prénom',
  'Sexe',
  'Date de naissance',
  'Nationalité',
  'Type de document',
  'N° passeport / document',
  'Pays émetteur',
  'Situation',
  'Entrée',
  'Sortie',
  'Pays de rapatriement',
  'Date de rapatriement',
  'Remarque',
]

export function personsToCsv(persons: Person[]): string {
  const rows = persons.map((p) =>
    [
      p.last_name,
      p.first_name,
      p.sexe ?? '',
      formatDate(p.birth_date),
      `${p.nationality ?? ''}${p.nationality_presumed ? ' (présumée)' : ''}`,
      DOC_TYPE_LABEL[p.doc_type],
      p.passport_number ?? '',
      p.doc_country ?? '',
      SITUATION_LABEL[p.situation],
      formatDateTime(p.entry_at),
      formatDateTime(p.exit_at),
      p.repatriation_country ?? '',
      formatDate(p.repatriation_date),
      p.remark ?? '',
    ]
      .map(esc)
      .join(';'),
  )
  return [HEADERS.map(esc).join(';'), ...rows].join('\r\n')
}

export function downloadCsv(filename: string, content: string): void {
  // BOM pour qu'Excel reconnaisse l'UTF-8.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

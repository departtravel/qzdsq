import { useState } from 'react'
import {
  DOC_TYPE_LABEL,
  SITUATION_LABEL,
  type DocType,
  type Person,
  type PersonInput,
  type Sexe,
  type Situation,
} from '../lib/types'
import { toIso, toLocalInput } from '../lib/format'

interface Props {
  initial?: Person
  /** Fichiers choisis à téléverser après création/màj de la personne. */
  onSave: (input: PersonInput, files: File[]) => Promise<void>
  onCancel: () => void
}

const input = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-600'

export function PersonForm({ initial, onSave, onCancel }: Props) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? '')
  const [lastName, setLastName] = useState(initial?.last_name ?? '')
  const [sexe, setSexe] = useState<Sexe | ''>(initial?.sexe ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '')
  const [nationality, setNationality] = useState(initial?.nationality ?? '')
  const [presumed, setPresumed] = useState(initial?.nationality_presumed ?? false)
  const [docType, setDocType] = useState<DocType>(initial?.doc_type ?? 'aucun')
  const [passport, setPassport] = useState(initial?.passport_number ?? '')
  const [docCountry, setDocCountry] = useState(initial?.doc_country ?? '')
  const [situation, setSituation] = useState<Situation>(initial?.situation ?? 'non_identifie')
  const [entryAt, setEntryAt] = useState(
    toLocalInput(initial?.entry_at ?? new Date().toISOString()),
  )
  const [exitAt, setExitAt] = useState(toLocalInput(initial?.exit_at ?? null))
  const [remark, setRemark] = useState(initial?.remark ?? '')
  const [repatCountry, setRepatCountry] = useState(initial?.repatriation_country ?? '')
  const [repatDate, setRepatDate] = useState(initial?.repatriation_date ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() && !lastName.trim()) {
      setError('Renseigne au moins le nom ou le prénom (ou « Inconnu » si non identifié).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          sexe: sexe || null,
          birth_date: birthDate || null,
          nationality: nationality.trim() || null,
          nationality_presumed: presumed,
          doc_type: docType,
          passport_number: passport.trim() || null,
          doc_country: docCountry.trim() || null,
          situation,
          entry_at: toIso(entryAt) ?? new Date().toISOString(),
          exit_at: toIso(exitAt),
          remark: remark.trim() || null,
          repatriation_country: repatCountry.trim() || null,
          repatriation_date: repatDate || null,
        },
        files,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Nom</label>
          <input className={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Prénom</label>
          <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Sexe</label>
          <select className={input} value={sexe} onChange={(e) => setSexe(e.target.value as Sexe | '')}>
            <option value="">—</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className={label}>Date de naissance</label>
          <input
            type="date"
            className={input}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Nationalité</label>
          <input
            className={input}
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={presumed}
              onChange={(e) => setPresumed(e.target.checked)}
            />
            Nationalité présumée
          </label>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Type de document</label>
          <select
            className={input}
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
          >
            {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>N° passeport / document</label>
          <input className={input} value={passport} onChange={(e) => setPassport(e.target.value)} />
        </div>
        <div>
          <label className={label}>Pays émetteur</label>
          <input className={input} value={docCountry} onChange={(e) => setDocCountry(e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Situation</label>
          <select
            className={input}
            value={situation}
            onChange={(e) => setSituation(e.target.value as Situation)}
          >
            {(Object.keys(SITUATION_LABEL) as Situation[]).map((s) => (
              <option key={s} value={s}>
                {SITUATION_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Entrée au centre</label>
          <input
            type="datetime-local"
            className={input}
            value={entryAt}
            onChange={(e) => setEntryAt(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Sortie du centre</label>
          <input
            type="datetime-local"
            className={input}
            value={exitAt}
            onChange={(e) => setExitAt(e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Pays de rapatriement</label>
          <input
            className={input}
            value={repatCountry}
            onChange={(e) => setRepatCountry(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Date de rapatriement (prévue)</label>
          <input
            type="date"
            className={input}
            value={repatDate}
            onChange={(e) => setRepatDate(e.target.value)}
          />
        </div>
      </fieldset>

      <div>
        <label className={label}>Remarque / observations</label>
        <textarea
          className={`${input} min-h-[80px]`}
          value={remark}
          placeholder="Note libre sur la personne, l'investigation, le contexte d'entrée…"
          onChange={(e) => setRemark(e.target.value)}
        />
      </div>

      <div>
        <label className={label}>
          Documents à téléverser (CIN, passeport, laissez-passer…) — plusieurs fichiers possibles
        </label>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          className="text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {files.length} fichier(s) sélectionné(s) : {files.map((f) => f.name).join(', ')}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

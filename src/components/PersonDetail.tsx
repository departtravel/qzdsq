import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Person, PersonDocument } from '../lib/types'
import { DOC_TYPE_LABEL } from '../lib/types'
import { formatDate, formatDateTime } from '../lib/format'
import { removeDocument, uploadDocument } from '../lib/storage'
import { StatusBadge } from './StatusBadge'
import { DocumentGallery } from './DocumentGallery'

interface Props {
  person: Person
  isAdmin: boolean
  onBack: () => void
  onEdit: () => void
  onChanged: () => void
}

export function PersonDetail({ person, isAdmin, onBack, onEdit, onChanged }: Props) {
  const [docs, setDocs] = useState<PersonDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('person_documents')
      .select('*')
      .eq('person_id', person.id)
      .order('uploaded_at', { ascending: false })
    if (error) setError(error.message)
    setDocs((data as PersonDocument[]) ?? [])
    setLoading(false)
  }, [person.id])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const path = await uploadDocument(person.id, file)
        const { error } = await supabase.from('person_documents').insert({
          person_id: person.id,
          label: file.name,
          doc_type: person.doc_type,
          storage_path: path,
          mime: file.type || null,
          size_bytes: file.size,
        })
        if (error) throw new Error(error.message)
      }
      await loadDocs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du téléversement.')
    } finally {
      setUploading(false)
    }
  }

  async function deleteDoc(doc: PersonDocument) {
    if (!confirm(`Supprimer le document « ${doc.label} » ?`)) return
    await removeDocument(doc.storage_path)
    await supabase.from('person_documents').delete().eq('id', doc.id)
    await loadDocs()
  }

  async function deletePerson() {
    if (!confirm('Supprimer définitivement cette personne et tous ses documents ?')) return
    // Supprime d'abord les fichiers du stockage, puis l'enregistrement (cascade SQL pour la table).
    await Promise.all(docs.map((d) => removeDocument(d.storage_path)))
    const { error } = await supabase.from('persons').delete().eq('id', person.id)
    if (error) {
      setError(error.message)
      return
    }
    onChanged()
    onBack()
  }

  const fullName =
    [person.last_name, person.first_name].filter(Boolean).join(' ') || 'Personne sans nom'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          ← Retour à la liste
        </button>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Modifier
            </button>
            <button
              onClick={deletePerson}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">{fullName}</h2>
          <StatusBadge situation={person.situation} />
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Sexe" value={sexeLabel(person.sexe)} />
          <Field label="Date de naissance" value={formatDate(person.birth_date)} />
          <Field
            label="Nationalité"
            value={`${person.nationality ?? '—'}${person.nationality_presumed ? ' (présumée)' : ''}`}
          />
          <Field label="Type de document" value={DOC_TYPE_LABEL[person.doc_type]} />
          <Field label="N° passeport / document" value={person.passport_number ?? '—'} />
          <Field label="Pays émetteur" value={person.doc_country ?? '—'} />
          <Field label="Entrée au centre" value={formatDateTime(person.entry_at)} />
          <Field label="Sortie du centre" value={formatDateTime(person.exit_at)} />
          <Field label="Pays de rapatriement" value={person.repatriation_country ?? '—'} />
          <Field label="Date de rapatriement" value={formatDate(person.repatriation_date)} />
        </dl>

        {person.remark && (
          <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Remarque</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{person.remark}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">Documents scannés</h3>
          {isAdmin && (
            <label className="cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              {uploading ? 'Téléversement…' : '+ Ajouter des documents'}
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          )}
        </div>
        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : (
          <DocumentGallery documents={docs} isAdmin={isAdmin} onDelete={deleteDoc} />
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}

function sexeLabel(sexe: Person['sexe']): string {
  if (sexe === 'M') return 'Masculin'
  if (sexe === 'F') return 'Féminin'
  if (sexe === 'autre') return 'Autre'
  return '—'
}

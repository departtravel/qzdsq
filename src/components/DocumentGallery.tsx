import { useEffect, useState } from 'react'
import type { PersonDocument } from '../lib/types'
import { DOC_TYPE_LABEL } from '../lib/types'
import { humanFileSize } from '../lib/format'
import { signedUrl } from '../lib/storage'

interface Props {
  documents: PersonDocument[]
  isAdmin: boolean
  onDelete: (doc: PersonDocument) => void
}

export function DocumentGallery({ documents, isAdmin, onDelete }: Props) {
  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">Aucun document téléversé.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={onDelete} />
      ))}
    </div>
  )
}

function DocumentCard({
  doc,
  isAdmin,
  onDelete,
}: {
  doc: PersonDocument
  isAdmin: boolean
  onDelete: (doc: PersonDocument) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const isImage = (doc.mime ?? '').startsWith('image/')

  useEffect(() => {
    let active = true
    signedUrl(doc.storage_path).then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [doc.storage_path])

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className="flex h-32 items-center justify-center bg-slate-50"
      >
        {isImage && url ? (
          <img src={url} alt={doc.label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl">{isImage ? '🖼️' : '📄'}</span>
        )}
      </a>
      <div className="p-2">
        <p className="truncate text-xs font-medium text-slate-700" title={doc.label}>
          {doc.label}
        </p>
        <p className="text-[11px] text-slate-400">
          {DOC_TYPE_LABEL[doc.doc_type]} · {humanFileSize(doc.size_bytes)}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <a
            href={url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 hover:underline"
          >
            Ouvrir
          </a>
          {isAdmin && (
            <button
              onClick={() => onDelete(doc)}
              className="text-[11px] text-red-500 hover:underline"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

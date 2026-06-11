import { supabase } from './supabase'

/** Nom du bucket privé contenant les pièces d'identité scannées. */
export const DOCS_BUCKET = 'person-documents'

/** Téléverse un fichier et renvoie son chemin de stockage. */
export async function uploadDocument(personId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${personId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

/** Génère une URL signée temporaire (bucket privé). */
export async function signedUrl(path: string, expiresInSec = 300): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, expiresInSec)
  if (error) return null
  return data.signedUrl
}

export async function removeDocument(path: string): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([path])
}

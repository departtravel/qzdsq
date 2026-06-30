import { useState, useRef } from 'react'
import type { ArticleParams, Language, ArticleLength, ContentType, UploadedImage } from '../types'

interface Props {
  onGenerate: (p: ArticleParams) => void
  generating: boolean
  onStop: () => void
}

export function GeneratorForm({ onGenerate, generating, onStop }: Props) {
  const [keyword, setKeyword] = useState('')
  const [secondaryRaw, setSecondaryRaw] = useState('')
  const [title, setTitle] = useState('')
  const [niche, setNiche] = useState('')
  const [audience, setAudience] = useState('')
  const [language, setLanguage] = useState<Language>('fr')
  const [length, setLength] = useState<ArticleLength>('moyen')
  const [contentType, setContentType] = useState<ContentType>('informatif')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [analyzeCompetition, setAnalyzeCompetition] = useState(true)
  const [images, setImages] = useState<UploadedImage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImages = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        setImages(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          file, dataUrl,
          altText: keyword,
          caption: '',
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const updateImage = (id: string, field: 'altText' | 'caption', val: string) =>
    setImages(prev => prev.map(img => img.id === id ? { ...img, [field]: val } : img))

  const removeImage = (id: string) =>
    setImages(prev => prev.filter(img => img.id !== id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    onGenerate({
      keyword: keyword.trim(),
      secondaryKeywords: secondaryRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean),
      title: title.trim(),
      niche: niche.trim(),
      audience: audience.trim(),
      language,
      length,
      contentType,
      websiteUrl: websiteUrl.trim(),
      images,
      analyzeCompetition,
    })
  }

  const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1'
  const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white'
  const select = input

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <h2 className="font-bold text-slate-800">Paramètres de l'article</h2>

      {/* Keyword */}
      <div>
        <label className={label}>Mot-clé principal *</label>
        <input
          className={input}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="ex : location voiture Casablanca"
          required
        />
        <p className="mt-1 text-xs text-slate-400">Le mot-clé central sur lequel se positionner</p>
      </div>

      {/* Secondary keywords */}
      <div>
        <label className={label}>Mots-clés secondaires / tags</label>
        <textarea
          className={input + ' resize-none'}
          rows={3}
          value={secondaryRaw}
          onChange={e => setSecondaryRaw(e.target.value)}
          placeholder="ex : voiture avec chauffeur, transfer aéroport, location longue durée&#10;(séparés par virgule, point-virgule ou retour ligne)"
        />
      </div>

      {/* Title */}
      <div>
        <label className={label}>Titre suggéré</label>
        <input
          className={input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Laisse vide = Claude choisit le meilleur angle"
        />
      </div>

      {/* Niche + Audience */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Niche / secteur</label>
          <input className={input} value={niche} onChange={e => setNiche(e.target.value)} placeholder="Tourisme, Voyage…" />
        </div>
        <div>
          <label className={label}>Public cible</label>
          <input className={input} value={audience} onChange={e => setAudience(e.target.value)} placeholder="Touristes, Pros…" />
        </div>
      </div>

      {/* Language */}
      <div>
        <label className={label}>Langue de l'article</label>
        <select className={select} value={language} onChange={e => setLanguage(e.target.value as Language)}>
          <option value="fr">🇫🇷 Français</option>
          <option value="en">🇬🇧 English</option>
          <option value="ar">🇲🇦 العربية</option>
          <option value="es">🇪🇸 Español</option>
          <option value="de">🇩🇪 Deutsch</option>
        </select>
      </div>

      {/* Length + Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Longueur</label>
          <select className={select} value={length} onChange={e => setLength(e.target.value as ArticleLength)}>
            <option value="court">Court (600–900 mots)</option>
            <option value="moyen">Moyen (1 200–1 800)</option>
            <option value="long">Long (2 500–3 500)</option>
            <option value="expert">Expert (4 000–5 500)</option>
          </select>
        </div>
        <div>
          <label className={label}>Type de contenu</label>
          <select className={select} value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>
            <option value="informatif">Informatif</option>
            <option value="guide">Guide étape par étape</option>
            <option value="comparatif">Comparatif</option>
            <option value="liste">Liste (Top N)</option>
            <option value="avis">Avis / Test</option>
            <option value="cas-pratique">Cas pratique</option>
          </select>
        </div>
      </div>

      {/* Website URL */}
      <div>
        <label className={label}>URL de votre site</label>
        <input
          className={input}
          type="url"
          value={websiteUrl}
          onChange={e => setWebsiteUrl(e.target.value)}
          placeholder="https://votre-site.com"
        />
        <p className="mt-1 text-xs text-slate-400">Pour générer les suggestions de liens internes</p>
      </div>

      {/* Competition analysis toggle */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded text-blue-600"
          checked={analyzeCompetition}
          onChange={e => setAnalyzeCompetition(e.target.checked)}
        />
        <div>
          <span className="text-sm font-medium text-slate-700">Analyse concurrentielle</span>
          <p className="text-xs text-slate-400 mt-0.5">Claude analyse les stratégies des top concurrents et choisit le meilleur angle pour surclasser</p>
        </div>
      </label>

      {/* Image upload */}
      <div>
        <label className={label}>Photos à insérer dans l'article</label>
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-5 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleImages(e.dataTransfer.files) }}
        >
          <span className="text-2xl">📷</span>
          <p className="text-xs text-slate-500">Clique ou glisse-dépose tes photos ici</p>
          <p className="text-xs text-slate-400">JPG, PNG, WebP — plusieurs fichiers acceptés</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImages(e.target.files)} />

        {images.length > 0 && (
          <div className="mt-3 space-y-3">
            {images.map((img, i) => (
              <div key={img.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <img src={img.dataUrl} alt="" className="h-16 w-16 rounded object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Image {i + 1}</span>
                    <button type="button" onClick={() => removeImage(img.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Texte alternatif (alt)"
                    value={img.altText}
                    onChange={e => updateImage(img.id, 'altText', e.target.value)}
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Légende (caption)"
                    value={img.caption}
                    onChange={e => updateImage(img.id, 'caption', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      {generating ? (
        <button
          type="button"
          onClick={onStop}
          className="w-full rounded-lg bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600 transition"
        >
          ⏹ Arrêter la génération
        </button>
      ) : (
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white hover:from-blue-700 hover:to-indigo-700 transition shadow-md"
        >
          ✨ Générer l'article SEO
        </button>
      )}
    </form>
  )
}

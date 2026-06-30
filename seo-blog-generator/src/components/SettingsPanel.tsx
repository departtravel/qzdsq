import { useState } from 'react'

interface Props {
  apiKey: string
  onSave: (key: string) => void
}

export function SettingsPanel({ apiKey, onSave }: Props) {
  const [draft, setDraft] = useState(apiKey)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-800">Clé API Anthropic (Claude)</h2>
        <p className="mb-4 text-sm text-slate-500">
          Obtiens ta clé sur{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            console.anthropic.com
          </a>
          . Elle est stockée uniquement dans ton navigateur (localStorage), jamais envoyée ailleurs que vers l'API Anthropic.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="sk-ant-api03-…"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? '🙈' : '👁'}
            </button>
          </div>
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
        {apiKey && (
          <p className="mt-2 text-xs text-green-600">✓ Clé API configurée — le générateur est prêt.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-800">À propos</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>Ce générateur utilise <strong>Claude (claude-sonnet-5)</strong> pour créer des articles SEO & GEO de haut niveau.</p>
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Optimisations SEO intégrées :</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Structure H1/H2/H3 optimisée pour les featured snippets</li>
              <li>Densité de mots-clés calibrée (1–2.5%)</li>
              <li>Title tag et meta description aux dimensions exactes Google</li>
              <li>Schema.org JSON-LD (Article, FAQPage, HowTo)</li>
              <li>Section FAQ pour les "People Also Ask"</li>
              <li>Signaux E-E-A-T (expertise, expérience, autorité, fiabilité)</li>
              <li>Suggestions de liens internes et externes</li>
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Optimisations GEO (IA) :</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Réponses directes pour l'AI Overview de Google</li>
              <li>Format question/réponse capturé par ChatGPT, Perplexity, Gemini</li>
              <li>Définitions claires et entités nommées</li>
              <li>Données chiffrées et sources vérifiables</li>
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Export WordPress :</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Fichier XML importable directement dans WordPress</li>
              <li>Méta SEO pré-remplies (Yoast SEO + RankMath)</li>
              <li>Article créé en brouillon pour révision avant publication</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'
import { SettingsPanel } from './components/SettingsPanel'
import { GeneratorForm } from './components/GeneratorForm'
import { ArticleOutput } from './components/ArticleOutput'
import { SeoChecklist } from './components/SeoChecklist'
import type { ArticleParams, GeneratedArticle } from './types'
import { buildPrompt } from './prompt'

type Tab = 'generator' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('generator')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [article, setArticle] = useState<GeneratedArticle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const saveKey = useCallback((key: string) => {
    setApiKey(key)
    localStorage.setItem('anthropic_api_key', key)
  }, [])

  const generate = useCallback(async (params: ArticleParams) => {
    if (!apiKey) {
      setError('Clé API manquante — va dans Paramètres pour la configurer.')
      setTab('settings')
      return
    }
    setError(null)
    setArticle(null)
    setGenerating(true)
    setProgress('Initialisation…')

    abortRef.current = new AbortController()

    try {
      const prompt = buildPrompt(params)
      setProgress('Génération de l\'article en cours…')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: abortRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `Erreur API ${res.status}`)
      }

      const data = await res.json() as { content: Array<{ type: string; text: string }> }
      const raw = data.content.find(b => b.type === 'text')?.text ?? ''

      setProgress('Analyse et structuration…')
      const parsed = parseArticle(raw, params)
      setArticle(parsed)
      setProgress('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [apiKey])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setGenerating(false)
    setProgress('')
  }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">✍️ Générateur SEO & GEO</h1>
            <p className="text-xs text-blue-200 mt-0.5">Articles optimisés Google · Powered by Claude</p>
          </div>
          <nav className="flex gap-1">
            {(['generator', 'settings'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === t ? 'bg-white text-blue-700' : 'text-blue-100 hover:bg-blue-600'
                }`}
              >
                {t === 'generator' ? '🖊 Générateur' : '⚙️ Paramètres'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto font-bold">✕</button>
          </div>
        )}

        {tab === 'settings' ? (
          <SettingsPanel apiKey={apiKey} onSave={saveKey} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
            <aside className="space-y-4">
              <GeneratorForm
                onGenerate={generate}
                generating={generating}
                onStop={stop}
              />
            </aside>

            <section className="space-y-4">
              {generating && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  <p className="text-sm font-medium text-blue-700">{progress}</p>
                  <button onClick={stop} className="mt-2 rounded border border-blue-300 px-3 py-1 text-xs text-blue-600 hover:bg-blue-100">
                    Annuler
                  </button>
                </div>
              )}

              {!generating && !article && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center text-slate-400">
                  <span className="text-4xl">📝</span>
                  <p className="font-medium">Remplis le formulaire et clique sur Générer</p>
                  <p className="text-xs">L'article apparaîtra ici, optimisé SEO + GEO</p>
                </div>
              )}

              {article && (
                <>
                  <SeoChecklist article={article} />
                  <ArticleOutput article={article} />
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function parseArticle(raw: string, params: ArticleParams): GeneratedArticle {
  const section = (tag: string) => {
    const re = new RegExp(`<!--\\s*${tag}\\s*-->([\\s\\S]*?)(?=<!--[A-Z_]+-->|$)`, 'i')
    return raw.match(re)?.[1]?.trim() ?? ''
  }

  const metaTitle         = section('META_TITLE') || extractFirstLine(raw, 'META_TITLE')
  const metaDesc          = section('META_DESCRIPTION') || extractFirstLine(raw, 'META_DESCRIPTION')
  const slug              = section('SLUG') || slugify(params.keyword)
  const schemaOrg         = section('SCHEMA_JSON')
  const body              = section('ARTICLE') || raw
  const competitionAnalysis = section('COMPETITION_ANALYSIS') || undefined

  return {
    params,
    raw,
    metaTitle,
    metaDesc,
    slug,
    schemaOrg,
    body,
    competitionAnalysis,
    wordCount: countWords(body),
    keywordDensity: calcDensity(body, params.keyword),
    hasH1: /^#\s/m.test(body),
    hasH2: /^##\s/m.test(body),
    hasH3: /^###\s/m.test(body),
    hasFaq: /FAQ|question|fréquemment/i.test(body),
    hasConclusion: /conclusion|résumé|en résumé|pour conclure/i.test(body),
    hasKeywordInTitle: metaTitle.toLowerCase().includes(params.keyword.toLowerCase()),
    hasKeywordInDesc: metaDesc.toLowerCase().includes(params.keyword.toLowerCase()),
    hasKeywordInIntro: body.slice(0, 600).toLowerCase().includes(params.keyword.toLowerCase()),
    hasBulletLists: /^[-*]\s/m.test(body) || /^\d+\.\s/m.test(body),
    hasInternalLinks: /\[.*?\]\((?!http)/i.test(body),
    hasExternalLinks: /\[.*?\]\(https?:\/\//i.test(body),
    metaTitleLength: metaTitle.length,
    metaDescLength: metaDesc.length,
  }
}

function extractFirstLine(text: string, _tag: string): string {
  return text.split('\n').find(l => l.trim().length > 0)?.replace(/^#+\s*/, '') ?? ''
}

function slugify(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length
}

function calcDensity(text: string, keyword: string): number {
  const words = text.toLowerCase().split(/\s+/)
  const kw = keyword.toLowerCase()
  const count = words.filter(w => w.includes(kw)).length
  return Math.round((count / words.length) * 1000) / 10
}

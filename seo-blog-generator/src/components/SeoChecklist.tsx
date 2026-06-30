import type { GeneratedArticle } from '../types'

interface Props { article: GeneratedArticle }

interface Check {
  label: string
  pass: boolean
  hint?: string
}

export function SeoChecklist({ article: a }: Props) {
  const checks: Check[] = [
    { label: 'H1 présent', pass: a.hasH1, hint: 'Un seul H1 par page, avec le mot-clé' },
    { label: 'H2 structurés', pass: a.hasH2, hint: '6-10 sections H2 recommandées' },
    { label: 'H3 sous-sections', pass: a.hasH3, hint: 'Format question/réponse pour les snippets' },
    { label: `Title tag ${a.metaTitleLength}/60 car.`, pass: a.metaTitleLength >= 45 && a.metaTitleLength <= 60 },
    { label: `Meta desc ${a.metaDescLength}/158 car.`, pass: a.metaDescLength >= 120 && a.metaDescLength <= 158 },
    { label: 'Mot-clé dans le title', pass: a.hasKeywordInTitle },
    { label: 'Mot-clé dans la meta desc', pass: a.hasKeywordInDesc },
    { label: 'Mot-clé dans l\'intro', pass: a.hasKeywordInIntro, hint: 'Dans les 100 premiers mots' },
    { label: `Densité mot-clé ${a.keywordDensity}%`, pass: a.keywordDensity >= 0.8 && a.keywordDensity <= 2.5, hint: 'Idéal : 1–2.5%' },
    { label: `Longueur ${a.wordCount} mots`, pass: a.wordCount >= 600 },
    { label: 'Section FAQ', pass: a.hasFaq, hint: 'Essentiel pour PAA et réponses IA (GEO)' },
    { label: 'Conclusion + CTA', pass: a.hasConclusion },
    { label: 'Listes à puces / numérotées', pass: a.hasBulletLists, hint: 'Capturé par les IA pour les réponses structurées' },
    { label: 'Liens internes suggérés', pass: a.hasInternalLinks },
    { label: 'Liens externes (sources)', pass: a.hasExternalLinks },
  ]

  const score = Math.round((checks.filter(c => c.pass).length / checks.length) * 100)
  const scoreColor = score >= 85 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const barColor = score >= 85 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">Score SEO / GEO</h3>
        <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 mb-4">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50 group relative">
            <span className={c.pass ? 'text-green-500' : 'text-red-400'}>{c.pass ? '✓' : '✗'}</span>
            <span className={`text-xs ${c.pass ? 'text-slate-700' : 'text-slate-400'}`}>{c.label}</span>
            {c.hint && (
              <span className="invisible group-hover:visible absolute left-full top-0 z-10 ml-2 w-48 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
                {c.hint}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

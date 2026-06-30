import { useState } from 'react'
import type { GeneratedArticle } from '../types'
import { renderMarkdown } from '../markdown'

type OutputTab = 'preview' | 'markdown' | 'meta' | 'schema' | 'competition' | 'wordpress'

interface Props { article: GeneratedArticle }

export function ArticleOutput({ article: a }: Props) {
  const [tab, setTab] = useState<OutputTab>('preview')
  const [copied, setCopied] = useState(false)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = (content: string, filename: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { id: OutputTab; label: string; hidden?: boolean }[] = [
    { id: 'preview', label: '👁 Aperçu' },
    { id: 'markdown', label: '📝 Markdown' },
    { id: 'meta', label: '🏷 Méta SEO' },
    { id: 'schema', label: '🔧 Schema.org' },
    { id: 'competition', label: '🔍 Concurrence', hidden: !a.competitionAnalysis },
    { id: 'wordpress', label: '📦 WordPress' },
  ]

  const wordpressXml = buildWordPressXml(a)

  const tabBtn = (t: typeof tabs[0]) => (
    !t.hidden && (
      <button
        key={t.id}
        onClick={() => setTab(t.id)}
        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {t.label}
      </button>
    )
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Tabs + actions */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 flex-wrap gap-y-2">
        <div className="flex gap-1 flex-wrap">{tabs.map(tabBtn)}</div>
        <div className="flex gap-2">
          <button
            onClick={() => copy(tab === 'schema' ? a.schemaOrg : tab === 'meta' ? metaBlock(a) : tab === 'wordpress' ? wordpressXml : a.body)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition"
          >
            {copied ? '✓ Copié !' : '📋 Copier'}
          </button>
          <button
            onClick={() => download(a.body, `${a.slug}.md`)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition"
          >
            ⬇ .md
          </button>
          <button
            onClick={() => download(wordpressXml, `${a.slug}.xml`, 'application/xml')}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
          >
            ⬇ WordPress XML
          </button>
        </div>
      </div>

      <div className="p-5 overflow-auto max-h-[70vh]">
        {tab === 'preview' && (
          <article
            className="prose max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(a.body) }}
          />
        )}

        {tab === 'markdown' && (
          <pre className="whitespace-pre-wrap text-xs font-mono text-slate-700">{a.body}</pre>
        )}

        {tab === 'meta' && (
          <div className="space-y-4">
            <MetaField label="Title tag" value={a.metaTitle} max={60} good={[50, 60]} />
            <MetaField label="Meta description" value={a.metaDesc} max={158} good={[120, 158]} />
            <MetaField label="Slug URL" value={a.slug} />
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold text-slate-500 uppercase">Aperçu SERP Google</p>
              <div className="space-y-1">
                <p className="text-base font-medium text-blue-700 hover:underline cursor-pointer leading-tight">{a.metaTitle}</p>
                <p className="text-xs text-green-700">{a.params.websiteUrl || 'https://votre-site.com'}/{a.slug}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{a.metaDesc}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'schema' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Colle ce JSON-LD dans le <code>&lt;head&gt;</code> de ta page WordPress pour les rich results Google.</p>
            <pre className="whitespace-pre-wrap text-xs font-mono bg-slate-900 text-green-300 rounded-lg p-4 overflow-auto">
              {a.schemaOrg || '<!-- Schéma non généré -->'}
            </pre>
          </div>
        )}

        {tab === 'competition' && a.competitionAnalysis && (
          <div className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.competitionAnalysis) }} />
        )}

        {tab === 'wordpress' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Comment importer :</strong> WordPress Admin → Outils → Importer → WordPress → Choisir le fichier XML téléchargé.
              Les méta SEO (Yoast / RankMath) sont incluses dans le fichier.
            </div>
            <pre className="whitespace-pre-wrap text-xs font-mono bg-slate-900 text-green-300 rounded-lg p-4 overflow-auto max-h-96">
              {wordpressXml}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaField({ label, value, max, good }: { label: string; value: string; max?: number; good?: [number, number] }) {
  const len = value.length
  const ok = good ? len >= good[0] && len <= good[1] : true
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
        {max && <span className={`text-xs font-mono ${ok ? 'text-green-600' : 'text-red-500'}`}>{len}/{max}</span>}
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{value || '—'}</div>
      {max && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
          <div
            className={`h-1.5 rounded-full transition-all ${ok ? 'bg-green-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, (len / max) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function metaBlock(a: GeneratedArticle): string {
  return `Title: ${a.metaTitle}\nDescription: ${a.metaDesc}\nSlug: ${a.slug}`
}

function buildWordPressXml(a: GeneratedArticle): string {
  const now = new Date().toISOString()
  const htmlBody = a.body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">

<channel>
  <title>SEO Blog Import</title>
  <wp:wxr_version>1.2</wp:wxr_version>

  <item>
    <title>${a.metaTitle}</title>
    <link>${a.params.websiteUrl}/${a.slug}/</link>
    <pubDate>${now}</pubDate>
    <dc:creator>admin</dc:creator>
    <content:encoded><![CDATA[${a.body}]]></content:encoded>
    <excerpt:encoded><![CDATA[${a.metaDesc}]]></excerpt:encoded>
    <wp:post_name>${a.slug}</wp:post_name>
    <wp:status>draft</wp:status>
    <wp:post_type>post</wp:post_type>
    <!-- Yoast SEO / RankMath meta -->
    <wp:postmeta>
      <wp:meta_key>_yoast_wpseo_title</wp:meta_key>
      <wp:meta_value><![CDATA[${a.metaTitle}]]></wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_yoast_wpseo_metadesc</wp:meta_key>
      <wp:meta_value><![CDATA[${a.metaDesc}]]></wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>rank_math_title</wp:meta_key>
      <wp:meta_value><![CDATA[${a.metaTitle}]]></wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>rank_math_description</wp:meta_key>
      <wp:meta_value><![CDATA[${a.metaDesc}]]></wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>rank_math_focus_keyword</wp:meta_key>
      <wp:meta_value><![CDATA[${a.params.keyword}]]></wp:meta_value>
    </wp:postmeta>
    ${a.schemaOrg ? `<wp:postmeta>
      <wp:meta_key>rank_math_schema_Article</wp:meta_key>
      <wp:meta_value><![CDATA[${a.schemaOrg}]]></wp:meta_value>
    </wp:postmeta>` : ''}
  </item>
</channel>
</rss>`
}

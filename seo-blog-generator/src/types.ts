export type Language = 'fr' | 'en' | 'es' | 'de' | 'ar'
export type ArticleLength = 'court' | 'moyen' | 'long' | 'expert'
export type ContentType = 'informatif' | 'guide' | 'comparatif' | 'liste' | 'avis' | 'cas-pratique'

export interface UploadedImage {
  id: string
  file: File
  dataUrl: string
  altText: string
  caption: string
}

export interface ArticleParams {
  keyword: string
  secondaryKeywords: string[]
  title: string
  niche: string
  audience: string
  language: Language
  length: ArticleLength
  contentType: ContentType
  websiteUrl: string
  images: UploadedImage[]
  analyzeCompetition: boolean
}

export interface GeneratedArticle {
  params: ArticleParams
  raw: string
  metaTitle: string
  metaDesc: string
  slug: string
  schemaOrg: string
  body: string
  wordCount: number
  keywordDensity: number
  hasH1: boolean
  hasH2: boolean
  hasH3: boolean
  hasFaq: boolean
  hasConclusion: boolean
  hasKeywordInTitle: boolean
  hasKeywordInDesc: boolean
  hasKeywordInIntro: boolean
  hasBulletLists: boolean
  hasInternalLinks: boolean
  hasExternalLinks: boolean
  metaTitleLength: number
  metaDescLength: number
  competitionAnalysis?: string
}

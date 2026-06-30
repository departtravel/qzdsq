import type { ArticleParams } from './types'

const LANG_NAMES: Record<string, string> = {
  fr: 'français', en: 'English', es: 'español', de: 'Deutsch', ar: 'العربية',
}

const LENGTH_WORDS: Record<string, string> = {
  court: '600–900 mots', moyen: '1 200–1 800 mots', long: '2 500–3 500 mots', expert: '4 000–5 500 mots',
}

const TYPE_DESC: Record<string, string> = {
  informatif: 'article informatif et éducatif',
  guide: 'guide étape par étape (how-to)',
  comparatif: 'article comparatif avec tableau',
  liste: 'article listicle (top N)',
  avis: 'article avis/test produit',
  'cas-pratique': 'étude de cas pratique',
}

export function buildPrompt(p: ArticleParams): string {
  const lang = LANG_NAMES[p.language] ?? p.language
  const secondary = p.secondaryKeywords.length
    ? p.secondaryKeywords.join(', ')
    : 'aucun'

  const imageSection = p.images.length
    ? `\n\nIMAGES DISPONIBLES (insère-les aux endroits les plus pertinents avec la syntaxe Markdown) :\n${
        p.images.map((img, i) =>
          `- Image ${i + 1}: alt="${img.altText || p.keyword}", légende="${img.caption || ''}"`
        ).join('\n')
      }\nSyntaxe à utiliser pour chaque image : ![alt text](IMAGE_${1}_URL "légende")`
    : ''

  const competitionSection = p.analyzeCompetition
    ? `\n\nANALYSE CONCURRENTIELLE (à inclure avant l'article dans la section <!--COMPETITION_ANALYSIS-->) :
Analyse ce que font les sites qui se classent actuellement #1 sur Google pour "${p.keyword}".
Identifie : (1) le type de contenu dominant, (2) la longueur moyenne, (3) les angles différenciants non couverts,
(4) les intentions de recherche, (5) la stratégie recommandée pour surclasser ces résultats.`
    : ''

  return `Tu es un expert SEO et GEO (Generative Engine Optimization) avec 15 ans d'expérience.
Ta mission : générer un article de blog ${TYPE_DESC[p.contentType]} en ${lang}, parfaitement optimisé pour Google et les moteurs IA (ChatGPT, Gemini, Perplexity).

═══════════════════════════════════════
PARAMÈTRES DE L'ARTICLE
═══════════════════════════════════════
• Mot-clé principal : "${p.keyword}"
• Mots-clés secondaires (LSI) : ${secondary}
• Titre suggéré : ${p.title || 'à déterminer selon le meilleur angle SEO'}
• Secteur / niche : ${p.niche || 'général'}
• Public cible : ${p.audience || 'grand public'}
• Longueur cible : ${LENGTH_WORDS[p.length]}
• URL du site : ${p.websiteUrl || 'non précisée'}
• Langue : ${lang}
${imageSection}
${competitionSection}

═══════════════════════════════════════
RÈGLES SEO OBLIGATOIRES (Google 2024-2025)
═══════════════════════════════════════
1. STRUCTURE :
   - 1 seul H1 contenant le mot-clé principal + intention de recherche
   - H2 pour chaque section principale (6-10 sections)
   - H3 pour les sous-sections (question + réponse directe = featured snippets)
   - Introduction : mot-clé dans les 100 premiers mots, résume la valeur de l'article
   - Conclusion : synthèse + CTA (call-to-action) clair

2. CONTENU :
   - Densité mot-clé : 1–2.5% (natural, jamais de keyword stuffing)
   - Mots-clés secondaires / LSI répartis naturellement
   - Au moins 2 listes à puces ou numérotées par section
   - Au moins 1 tableau de données si pertinent
   - Une citation d'expert ou statistique sourcée dans chaque section majeure
   - Signaux E-E-A-T : expertise, expérience, autorité, fiabilité

3. FAQ / PEOPLE ALSO ASK :
   - Section FAQ avec 5-8 questions au format "Question ?" / réponse directe en 40-60 mots
   - Questions basées sur les vraies requêtes "People Also Ask" liées au sujet
   - Format parfait pour les featured snippets et les réponses des IA

4. META-DONNÉES :
   - Title tag : 50-60 caractères, mot-clé au début, accrocheur
   - Meta description : 145-158 caractères, mot-clé inclus, CTA implicite
   - Slug URL : court, séparé par tirets, sans stop words

5. LIENS :
   - 2-3 suggestions de liens internes (vers d'autres pages du site)
   - 2-3 liens externes vers des sources d'autorité (Wikipedia, études, institutions)

═══════════════════════════════════════
RÈGLES GEO (Generative Engine Optimization)
═══════════════════════════════════════
Pour être cité par ChatGPT, Perplexity, Gemini et l'AI Overview de Google :

1. RÉPONSES DIRECTES : Commence chaque section avec une réponse courte et factuelle (1-2 phrases)
2. DÉFINITIONS CLAIRES : Définis les concepts clés avec "X est..." ou "X désigne..."
3. LISTES STRUCTURÉES : Préfère les listes numérotées pour les étapes, à puces pour les options
4. ENTITÉS NOMMÉES : Cite des marques, personnes, lieux, dates précises pour ancrer le contexte
5. LANGAGE CONVERSATIONNEL : Formule en questions-réponses naturelles (comment, pourquoi, quoi)
6. DONNÉES VÉRIFIABLES : Inclus des chiffres précis, pourcentages, dates (même estimés avec source)
7. COMPLETENESS SIGNALS : Couvre le sujet en profondeur, anticipe les questions de suivi

═══════════════════════════════════════
FORMAT DE SORTIE OBLIGATOIRE
═══════════════════════════════════════
Utilise exactement ces balises (sans les modifier) pour structurer ta réponse :

${p.analyzeCompetition ? `<!--COMPETITION_ANALYSIS-->
[Analyse concurrentielle ici]

` : ''}<!--META_TITLE-->
[Titre SEO ici - 50-60 caractères]

<!--META_DESCRIPTION-->
[Meta description ici - 145-158 caractères]

<!--SLUG-->
[slug-url-ici]

<!--ARTICLE-->
[Corps complet de l'article en Markdown ici]

<!--SCHEMA_JSON-->
[JSON-LD Schema.org approprié (Article, FAQPage, HowTo selon le type)]

Génère maintenant l'article complet. Sois exhaustif, naturel, et prioritise la valeur pour le lecteur.`
}

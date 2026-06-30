# Générateur d'Articles SEO & GEO

Application locale pour générer des articles de blog optimisés Google (SEO) et pour les moteurs IA (GEO).

## Lancement rapide

```bash
cd seo-blog-generator
npm install
npm run dev
# → http://localhost:5174
```

## Configuration

1. Va dans **⚙️ Paramètres**
2. Saisis ta clé API Anthropic (`sk-ant-api03-…`) depuis [console.anthropic.com](https://console.anthropic.com)
3. Clique **Sauvegarder** (stockée dans ton navigateur uniquement)

## Fonctionnalités

- **Mot-clé principal + tags/mots-clés secondaires** → structure LSI complète
- **Analyse concurrentielle** → Claude identifie l'angle optimal pour surclasser les concurrents
- **Choix de la langue** : Français, Anglais, Arabe, Espagnol, Allemand
- **Types d'articles** : informatif, guide, comparatif, liste, avis, cas pratique
- **Upload de photos** avec texte alternatif et légende, insérées dans l'article
- **Score SEO/GEO en temps réel** avec checklist détaillée
- **Export WordPress XML** : importable directement, avec méta Yoast + RankMath pré-remplies
- **Export Markdown** pour tout autre CMS

## Export WordPress

L'onglet **📦 WordPress** génère un fichier XML importable via :
`WordPress Admin → Outils → Importer → WordPress`

L'article est créé en **brouillon** avec :
- Title tag et meta description pré-remplis (Yoast SEO & RankMath)
- Mot-clé focal configuré
- Schema.org JSON-LD inclus

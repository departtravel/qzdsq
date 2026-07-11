// Supabase Edge Function — sitemap.xml dynamique.
//
// Génère le plan du site (pages fixes + une URL par excursion active et par
// langue) pour le référencement. Configure ton hébergeur pour servir
// /sitemap.xml depuis cette fonction, ou mets son URL dans robots.txt.
//
// Secret : SITE_URL = https://www.ton-domaine.com
// Déploiement : supabase functions deploy sitemap --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = (Deno.env.get('SITE_URL') ?? 'https://exemple.com').replace(/\/$/, '')
const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'pl', 'ru']

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const [{ data }, { data: cities }] = await Promise.all([
    supabase.from('excursions').select('id, statut').eq('statut', 'ACTIVE'),
    supabase.from('cities').select('nom').eq('actif', true),
  ])
  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const urls: string[] = []
  const add = (loc: string, priority = '0.7') =>
    urls.push(`<url><loc>${loc}</loc><priority>${priority}</priority></url>`)

  add(`${SITE}/`, '1.0')
  add(`${SITE}/circuit-sur-mesure`, '0.8')
  add(`${SITE}/evenements`, '0.8')
  for (const c of (cities as { nom: string }[]) ?? []) {
    add(`${SITE}/excursions-depuis/${slugify(c.nom)}`, '0.8')
  }
  for (const e of (data as { id: string }[]) ?? []) {
    add(`${SITE}/excursion/${e.id}`, '0.9')
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})

// Note : les 8 langues (${LOCALES.join(', ')}) partagent aujourd'hui la même URL
// (la langue est côté client). Le balisage hreflang deviendra pleinement utile
// après migration en rendu serveur (Next.js) avec des URLs /fr, /en, …

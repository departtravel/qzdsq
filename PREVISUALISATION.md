# Prévisualiser le site, puis le mettre sur ton domaine

Objectif : voir le site en ligne sur une **URL de test gratuite**, faire des
modifications, **puis** brancher ton domaine seulement quand tout te convient.

---

## Étape 1 — Prévisualisation gratuite (sans toucher au domaine)

1. Va sur [vercel.com](https://vercel.com) → **Sign up** avec ton compte GitHub.
2. **Add New… → Project** → importe le dépôt `departtravel/qzdsq`.
3. Vercel détecte **Vite** automatiquement. Ne change rien
   (build `npm run build`, output `dist`).
4. (Optionnel maintenant) **Environment Variables** : si tu as déjà Supabase,
   ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
   - Si tu ne les mets **pas** : le site s'affiche en **mode démo** (catalogue
     d'exemple) — parfait pour valider le design.
5. **Deploy**. Au bout d'~1 minute, tu obtiens une URL du type
   `https://qzdsq-xxxx.vercel.app` → **c'est ta prévisualisation.**

Tu peux la partager, la regarder sur mobile, cliquer partout.

## Étape 2 — Demander des modifications

Tu me dis ce que tu veux changer. Je pousse les modifications sur la branche →
**Vercel redéploie tout seul** et la même URL se met à jour en ~1 min.
On répète autant de fois que nécessaire, **sans jamais toucher ton domaine**.

## Étape 3 — Brancher ton domaine (seulement quand tu es content)

1. Dans Vercel : **Settings → Domains → Add** → saisis ton domaine.
2. Vercel affiche **1 ou 2 enregistrements DNS** (type `A` ou `CNAME`).
3. Tu les crées chez ton registrar (là où tu as acheté le domaine).
4. En quelques minutes/heures, ton domaine pointe sur le site. **HTTPS auto.**

> Rien n'est irréversible : tant que tu n'ajoutes pas le domaine (étape 3),
> il continue de pointer là où il pointe aujourd'hui.

---

## Rappels
- **Fichiers déjà prêts** : `vercel.json` (Vercel) et `public/_redirects`
  (Netlify) gèrent le routage des pages profondes (`/excursion/…`,
  `/excursions-depuis/…`, `/admin`).
- **Back-office** : accessible sur `TON-URL/admin` (login requis, nécessite
  Supabase configuré).
- **Emails / paiement** : nécessitent de déployer les fonctions Supabase
  (voir `supabase/functions/README.md`). Le reste marche sans.
- **Alternative à Vercel** : Netlify fonctionne pareil (build `npm run build`,
  publish `dist`).

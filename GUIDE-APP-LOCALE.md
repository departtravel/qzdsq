# 💻 Application locale (à télécharger et installer)

DTS Operation ERP peut être utilisé de **trois façons**. Choisis celle qui te
convient — le code est le même, seule la façon de l'ouvrir change.

---

## Option A — Application desktop installable (recommandé)

Une vraie application Windows / macOS / Linux, avec une icône sur le bureau,
qui s'ouvre dans sa propre fenêtre (pas besoin de navigateur).

> ⚠️ **Internet requis.** Les données (réservations, factures…) sont stockées
> dans **Supabase** (base sécurisée en ligne). L'application desktop est
> installée *en local* sur ton PC, mais elle se connecte à cette base. C'est ce
> qui permet à Hiba, Farah, Hersi… de travailler sur les **mêmes données**.
> (Une version 100 % hors-ligne est possible mais demande un développement
> séparé — voir plus bas.)

### Générer l'installeur

Sur un PC de développement (une seule fois) :

```bash
npm install
cp .env.example .env      # renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dist:win          # Windows  -> release/DTS Operation ERP Setup.exe
npm run dist:mac          # macOS    -> release/DTS Operation ERP.dmg
npm run dist:linux        # Linux    -> release/DTS Operation ERP.AppImage
```

> 💡 Chaque système ne peut construire que **son propre** installeur
> (Windows fabrique le `.exe`, un Mac fabrique le `.dmg`, etc.).

L'installeur généré se trouve dans le dossier `release/`. Tu le **distribues**
(clé USB, e-mail, téléchargement) et chaque poste l'installe en double-cliquant.
Les identifiants Supabase sont déjà inclus dans le build : l'utilisateur final
n'a **rien à configurer**, il ouvre l'app et se connecte avec son compte.

### Tester rapidement sans fabriquer d'installeur

```bash
npm run electron          # ouvre l'app dans sa fenêtre native
```

---

## Option B — Ouvrir en local dans le navigateur

Sans installer d'application :

```bash
npm install
cp .env.example .env      # + tes identifiants Supabase
npm run build
npm run preview           # ouvre http://localhost:4173
```

---

## Option C — Version 100 % hors-ligne (sur devis / évolution)

Si tu veux une app qui fonctionne **sans Internet du tout** (données stockées
uniquement sur le PC), il faut remplacer Supabase par une base locale (SQLite).
C'est faisable mais c'est un chantier à part :
- ✅ fonctionne sans connexion,
- ❌ chaque poste a **ses propres** données (pas de partage automatique entre
  Hiba / Farah / Hersi… sans synchronisation).

Dis-le si tu veux qu'on parte sur cette version.

---

## Icône de l'application

Place un fichier `electron/icon.png` (512×512 recommandé) pour personnaliser
l'icône de l'application. Sans icône, celle par défaut d'Electron est utilisée.

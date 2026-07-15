# 💻 Application locale (à télécharger et installer)

DTS Operation ERP peut être utilisé de **trois façons**. Choisis celle qui te
convient — le code est le même, seule la façon de l'ouvrir change.

---

## Option A — Application desktop 100 % hors-ligne (recommandé)

Une vraie application Windows / macOS / Linux, avec une icône sur le bureau,
qui s'ouvre dans sa propre fenêtre (pas de navigateur) et fonctionne **sans
aucune connexion Internet**. Les données sont stockées dans une base Postgres
**embarquée dans l'application** (technologie PGlite), sur le poste lui-même.

> ℹ️ **Mono-poste.** En mode hors-ligne, chaque installation a **ses propres
> données** : elles ne sont pas partagées automatiquement entre les postes de
> l'équipe. Idéal si tu gères la facturation/compta seul sur ton ordinateur.
> Pour un travail d'équipe partagé, vois l'Option B (en ligne).

### Générer l'installeur

Sur un PC de développement (une seule fois) :

```bash
npm install
echo "VITE_LOCAL_MODE=true" > .env   # active le mode 100% hors-ligne
npm run dist:win          # Windows  -> release/DTS Operation ERP Setup.exe
npm run dist:mac          # macOS    -> release/DTS Operation ERP.dmg
npm run dist:linux        # Linux    -> release/DTS Operation ERP.AppImage
```

> 💡 L'app démarre directement (pas de mot de passe en mode hors-ligne, tu es
> le seul utilisateur, avec tous les droits). Les données restent sur le poste
> même après fermeture, et sont conservées lors des mises à jour de l'app.

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

## Option B — En ligne / partagé entre l'équipe (Supabase)

Données partagées entre tous les postes (Hiba, Farah, Hersi, Karima…), avec le
workflow de rôles. Nécessite Internet.

```bash
npm install
cp .env.example .env      # renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
                          # (laisse VITE_LOCAL_MODE commenté)
npm run dist:win          # installeur desktop connecté à Supabase
# ou, sans installer :
npm run build && npm run preview   # http://localhost:4173
```

---

## Résumé : quel mode choisir ?

| | Option A — hors-ligne | Option B — en ligne |
| --- | --- | --- |
| Internet | ❌ pas nécessaire | ✅ requis |
| Données | sur le poste (privées) | partagées (équipe) |
| Workflow de rôles | non (tu es seul admin) | oui (Hiba→Farah→Hersi…) |
| `.env` | `VITE_LOCAL_MODE=true` | identifiants Supabase |

Le **même code** gère les deux modes : c'est uniquement le fichier `.env` au
moment de fabriquer l'installeur qui décide.

---

## Icône de l'application

Place un fichier `electron/icon.png` (512×512 recommandé) pour personnaliser
l'icône de l'application. Sans icône, celle par défaut d'Electron est utilisée.

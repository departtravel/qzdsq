# Deployer le rapport quotidien DTS sur le serveur PlanetHoster

## Contexte
Aymen (CEO de DTS) veut un rapport automatique chaque soir a 18h qui detecte les oublis de chaque membre de l'equipe et envoie un email individuel a chacun + un rapport complet CEO a Aymen et Amine.

Le script est dans ce repo : `scripts/daily-report-safe.mjs`. Il est 100% lecture seule (SELECT uniquement) et tourne dans un dossier SEPARE de l'app DTS.

## REGLES DE SECURITE — A RESPECTER ABSOLUMENT

1. **NE TOUCHE A RIEN dans ~/dts/** — pas de modification de fichiers, pas de npm install dans ~/dts, pas de schema, pas de prisma, pas de .env, pas de .htaccess, pas de restart
2. **Dossier SEPARE** : tout va dans `~/dts-reports/` sur le serveur
3. **LECTURE SEULE** sur la base PostgreSQL — le script refuse automatiquement tout sauf SELECT
4. **Ne redemarre PAS l'app** — pas de `touch tmp/restart.txt`, pas de pm2

## Infos serveur

- Serveur : `dts-n0c` (SSH depuis ce PC)
- Base : `postgresql://depaeezj_admin:%3C3H%296r%28yj%5B@localhost:5432/depaeezj_int_plat`
- Node : `/home/depaeezj/nodevenv/dts/22/bin/node`
- Le schema Prisma est dans `~/Desktop/departnyx/prisma/schema.prisma` sur CE PC

## Etapes a suivre dans l'ordre

### 1. Lire le schema Prisma local pour connaitre les noms exacts des tables et colonnes

```bash
cat ~/Desktop/departnyx/prisma/schema.prisma
```

### 2. Creer le dossier isole sur le serveur et installer les dependances

```bash
ssh dts-n0c 'mkdir -p ~/dts-reports && cd ~/dts-reports && /home/depaeezj/nodevenv/dts/22/bin/npm init -y && /home/depaeezj/nodevenv/dts/22/bin/npm install pg nodemailer'
```

### 3. Adapter le script aux noms reels du schema

Apres avoir lu le schema Prisma (etape 1), adapte les noms de tables et colonnes dans `daily-report-safe.mjs`. Le script utilise des noms estimes — remplace-les par les vrais noms.

Points cles a adapter :
- Nom de la table des reservations (Booking ? booking ?)
- Colonnes : clientName, price, priceCurrency, remainingAmount, startDate, createdAt, numberOfPeople, pickupTime
- Nom de la table des depenses (FinanceEntry ? finance_entry ?)
- Colonnes : type, description, amount, currency, createdAt
- Nom de la table des mouvements/trips (Trip ? trip ?)
- Colonnes : date, kmStart, kmEnd, driverId, zone
- Nom de la table gasoil (FuelLog ? fuel_log ?)
- Colonnes : date, litres, pricePerLitre, vehicleId

Ajoute aussi tout check pertinent que le schema permet.

### 4. Uploader le script sur le serveur

```bash
scp daily-report-safe.mjs dts-n0c:~/dts-reports/daily-report-safe.mjs
```

### 5. Tester — d'abord le schema

```bash
ssh dts-n0c 'cd ~/dts-reports && DATABASE_URL="postgresql://depaeezj_admin:%3C3H%296r%28yj%5B@localhost:5432/depaeezj_int_plat" /home/depaeezj/nodevenv/dts/22/bin/node daily-report-safe.mjs --schema'
```

### 6. Tester — mode console (SANS email)

```bash
ssh dts-n0c 'cd ~/dts-reports && DATABASE_URL="postgresql://depaeezj_admin:%3C3H%296r%28yj%5B@localhost:5432/depaeezj_int_plat" /home/depaeezj/nodevenv/dts/22/bin/node daily-report-safe.mjs'
```

### 7. Tester avec email

Aymen doit creer un App Password Gmail :
→ Google Account > Security > 2-Step Verification > App passwords
→ Nommer "DTS Rapport"

```bash
ssh dts-n0c 'cd ~/dts-reports && DATABASE_URL="postgresql://depaeezj_admin:%3C3H%296r%28yj%5B@localhost:5432/depaeezj_int_plat" GMAIL_APP_PASSWORD="le_app_password_ici" /home/depaeezj/nodevenv/dts/22/bin/node daily-report-safe.mjs'
```

### 8. Activer le cron job (18h chaque jour)

```bash
ssh dts-n0c 'crontab -l'
ssh dts-n0c '(crontab -l 2>/dev/null; echo "0 18 * * * cd /home/depaeezj/dts-reports && DATABASE_URL=\"postgresql://depaeezj_admin:%3C3H%296r%28yj%5B@localhost:5432/depaeezj_int_plat\" GMAIL_APP_PASSWORD=\"le_app_password_ici\" /home/depaeezj/nodevenv/dts/22/bin/node daily-report-safe.mjs >> /home/depaeezj/dts-reports/report.log 2>&1") | crontab -'
```

## Emails de l'equipe

```
karima  = Ktkitek@gmail.com
farah   = bakirfarah31@gmail.com
elyes   = Bnlres13@gmail.com
imed    = imedboughali1@gmail.com
mohamed = ounissim354@gmail.com
hiba    = boubguirahiba2@gmail.com
hersi   = hersikhalil26@gmail.com
montana = montanaguidepro@gmail.com
amine   = amine.departtravel@gmail.com
adel    = adelebouajila@gmail.com
aymen   = agence.departtravel@gmail.com
```

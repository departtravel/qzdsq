# Notifications e-mail des échéances

La fonction [`notify-echeances`](notify-echeances/index.ts) envoie un e-mail
récapitulant les échéances proches ou dépassées de la flotte (assurance, visite
technique, vignette, vidange, distribution).

## 1. Fournisseur d'e-mail (Resend)

1. Crée un compte sur [resend.com](https://resend.com) et une clé API.
2. (Recommandé) vérifie ton domaine d'envoi. Sinon, utilise l'expéditeur de test
   `onboarding@resend.dev`.

## 2. Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set NOTIFY_EMAIL_FROM="Flotte <flotte@ton-domaine.com>"
supabase secrets set NOTIFY_EMAIL_TO="patron@exemple.com,gestionnaire@exemple.com"
supabase secrets set NOTIFY_DAYS_AHEAD=30
```

> `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.

## 3. Déploiement

```bash
supabase functions deploy notify-echeances
```

Test manuel :

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/notify-echeances" \
  -H "Authorization: Bearer <ANON_OR_SERVICE_KEY>"
```

## 4. Planification quotidienne (pg_cron + pg_net)

Dans *SQL Editor*, active les extensions puis programme un appel quotidien à 7h :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'notif-echeances-flotte',
  '0 7 * * *',                 -- tous les jours à 07:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-echeances',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

Pour arrêter : `select cron.unschedule('notif-echeances-flotte');`

---

# Emails transactionnels de la vitrine (`send-email`)

La fonction [`send-email`](send-email/index.ts) envoie les e-mails du site :
confirmation de réservation, accusé de devis, accusé de message, et réponse
de l'agence au client (depuis le back-office Messagerie).

## Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set MAIL_FROM="Depart Travel <hello@ton-domaine.com>"
supabase secrets set MAIL_AGENCY="agence.departtravel@gmail.com"
```

## Déploiement

La fonction est appelée depuis la vitrine (visiteur anonyme), il faut donc
désactiver la vérification du JWT :

```bash
supabase functions deploy send-email --no-verify-jwt
```

Sans `RESEND_API_KEY`, la fonction ne casse rien : elle journalise et n'envoie
pas d'e-mail (le parcours client reste fonctionnel).

---

# Paiement en ligne Stripe (`create-checkout` + `stripe-webhook`)

`create-checkout` crée une session Stripe Checkout (acompte ou total) et renvoie
l'URL de paiement ; `stripe-webhook` confirme la réservation à la réception du
paiement.

## Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set DEPOSIT_PCT=30
```

## Déploiement

```bash
supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
```

Puis dans Stripe > Developers > Webhooks : créer un endpoint pointant vers l'URL
de `stripe-webhook`, écouter `checkout.session.completed`, et copier le
`whsec_...` dans `STRIPE_WEBHOOK_SECRET`. Sans clés Stripe, le bouton de paiement
affiche une erreur propre et la réservation reste enregistrée (règlement plus tard).

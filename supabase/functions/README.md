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

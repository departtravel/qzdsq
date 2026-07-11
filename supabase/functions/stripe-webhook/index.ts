// Supabase Edge Function — Webhook Stripe (confirmation de paiement).
//
// À l'événement checkout.session.completed, met à jour la réservation :
//   paiement_statut = ACOMPTE | PAYE, montant_paye, stripe_session_id.
//
// Secrets :
//   STRIPE_SECRET_KEY      sk_...
//   STRIPE_WEBHOOK_SECRET  whsec_... (endpoint webhook Stripe)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injectés)
//
// Déploiement :
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Puis dans Stripe > Developers > Webhooks, pointer vers l'URL de la fonction
// et écouter l'événement checkout.session.completed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

// Vérifie la signature Stripe (schéma t=timestamp,v1=signature HMAC-SHA256).
async function verify(payload: string, sigHeader: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET || !sigHeader) return false
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')))
  const signed = `${parts.t}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return expected === parts.v1
}

Deno.serve(async (req: Request) => {
  const payload = await req.text()
  const ok = await verify(payload, req.headers.get('stripe-signature'))
  if (!ok) return new Response('Signature invalide', { status: 400 })

  const event = JSON.parse(payload)
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object
    const bookingId = s.metadata?.booking_id ?? s.client_reference_id
    const mode = s.metadata?.mode
    if (bookingId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      await supabase.from('bookings').update({
        paiement_statut: mode === 'acompte' ? 'ACOMPTE' : 'PAYE',
        montant_paye: (s.amount_total ?? 0) / 100,
        stripe_session_id: s.id,
        statut: 'CONFIRMEE',
      }).eq('id', bookingId)
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})

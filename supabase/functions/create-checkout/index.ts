// Supabase Edge Function — Création d'une session de paiement Stripe.
//
// Reçoit { booking_id, montant_total, devise, mode: 'acompte'|'total',
//          acompte_pct, produit, origin }.
// Crée une session Stripe Checkout et renvoie son URL de redirection.
//
// Secrets :
//   STRIPE_SECRET_KEY   clé secrète Stripe (sk_...)
//   DEPOSIT_PCT         acompte par défaut en % (défaut 30)
//
// Déploiement (appelée depuis la vitrine) :
//   supabase functions deploy create-checkout --no-verify-jwt

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const DEFAULT_DEPOSIT = Number(Deno.env.get('DEPOSIT_PCT') ?? '30')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!STRIPE_KEY) return json({ error: 'Paiement non configuré (STRIPE_SECRET_KEY manquant).' }, 400)
  try {
    const { booking_id, montant_total, devise, mode, acompte_pct, produit, origin } = await req.json()
    const total = Number(montant_total)
    if (!total || total <= 0) return json({ error: 'Montant invalide.' }, 400)

    const pct = mode === 'acompte' ? Number(acompte_pct ?? DEFAULT_DEPOSIT) : 100
    const montant = Math.round(total * (pct / 100) * 100) // en centimes
    const label = mode === 'acompte' ? `Acompte (${pct}%) — ${produit}` : `${produit}`
    const base = origin || 'https://exemple.com'

    // Stripe Checkout via l'API REST (form-urlencoded).
    const form = new URLSearchParams()
    form.set('mode', 'payment')
    form.set('success_url', `${base}/paiement-ok?booking=${booking_id}`)
    form.set('cancel_url', `${base}/paiement-annule`)
    form.set('client_reference_id', String(booking_id))
    form.set('metadata[booking_id]', String(booking_id))
    form.set('metadata[mode]', String(mode))
    form.set('line_items[0][quantity]', '1')
    form.set('line_items[0][price_data][currency]', String(devise || 'eur').toLowerCase())
    form.set('line_items[0][price_data][unit_amount]', String(montant))
    form.set('line_items[0][price_data][product_data][name]', label)

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const session = await res.json()
    if (!res.ok) return json({ error: session?.error?.message ?? 'Erreur Stripe' }, 400)

    return json({ url: session.url, id: session.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

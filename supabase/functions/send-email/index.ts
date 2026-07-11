// Supabase Edge Function — Emails transactionnels de la vitrine.
//
// Envoie des e-mails via Resend pour :
//   - 'booking' : confirmation de réservation au client + notif agence
//   - 'quote'   : accusé de réception d'une demande de devis + notif agence
//   - 'contact' : accusé de réception d'un message + notif agence
//   - 'reply'   : réponse de l'agence envoyée au client (depuis le back-office)
//
// Secrets (Supabase > Edge Functions) :
//   RESEND_API_KEY       clé API Resend (https://resend.com)
//   MAIL_FROM            ex. "Depart Travel <hello@ton-domaine.com>"
//   MAIL_AGENCY          e-mail(s) agence, séparés par des virgules
//
// Déploiement (invocable publiquement depuis la vitrine) :
//   supabase functions deploy send-email --no-verify-jwt

const RESEND = 'https://api.resend.com/emails'
const FROM = Deno.env.get('MAIL_FROM') ?? 'Depart Travel <onboarding@resend.dev>'
const AGENCY = (Deno.env.get('MAIL_AGENCY') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const KEY = Deno.env.get('RESEND_API_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))

function wrap(title: string, body: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#16232f">
    <div style="background:#f56516;color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;font-size:20px;font-weight:800">Depart Travel Services</div>
    <div style="border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px;padding:24px">
      <h2 style="margin:0 0 12px">${esc(title)}</h2>${body}
      <p style="margin-top:24px;color:#8a97a3;font-size:12px">Depart Travel Services · Tunisie</p>
    </div></div>`
}

async function send(to: string[], subject: string, html: string) {
  if (!KEY) { console.warn('RESEND_API_KEY manquant — email non envoyé'); return }
  if (!to.length) return
  const res = await fetch(RESEND, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) console.error('Resend error', await res.text())
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { type, data } = await req.json()
    const client = data?.client_email ? [String(data.client_email)] : []
    const nom = esc(data?.client_nom ?? 'client')
    const jobs: Promise<void>[] = []

    if (type === 'booking') {
      const lignes = `<p><b>${esc(data.produit)}</b><br>
        ${esc(data.date ?? 'date à confirmer')} · ${esc(data.mode)} · ${esc(data.voyageurs)} voyageur(s)<br>
        Total : <b>${esc(data.total)} ${esc(data.devise)}</b></p>`
      jobs.push(send(client, 'Votre réservation est bien reçue ✅',
        wrap(`Merci ${nom} !`, `<p>Nous avons bien reçu votre réservation.</p>${lignes}<p>Notre équipe vous confirme les détails très vite.</p>`)))
      jobs.push(send(AGENCY, `🆕 Réservation — ${data.produit}`,
        wrap('Nouvelle réservation', `${lignes}<p>Client : ${nom} · ${esc(data.client_email)} · ${esc(data.client_telephone)}</p>`)))
    } else if (type === 'quote') {
      jobs.push(send(client, 'Votre demande de devis — gratuite 🎁',
        wrap(`Merci ${nom} !`, `<p>Votre demande de <b>${esc(data.quote_type)}</b> est bien reçue. Un conseiller vous prépare un devis gratuit sous 24-48h.</p>`)))
      jobs.push(send(AGENCY, `🎉 Devis — ${data.quote_type}`,
        wrap('Nouvelle demande de devis', `<p>${nom} · ${esc(data.client_email)} · ${esc(data.client_telephone)}</p><p>${esc(data.message ?? '')}</p>`)))
    } else if (type === 'contact') {
      jobs.push(send(client, 'Message bien reçu 💬',
        wrap(`Merci ${nom} !`, `<p>Nous avons bien reçu votre message et vous répondons rapidement.</p>`)))
      jobs.push(send(AGENCY, '💬 Nouveau message client',
        wrap('Nouveau message', `<p>${nom} · ${esc(data.client_email)}</p><blockquote>${esc(data.message)}</blockquote>`)))
    } else if (type === 'reply') {
      jobs.push(send(client, 'Réponse de Depart Travel Services',
        wrap(`Bonjour ${nom}`, `<blockquote>${esc(data.message)}</blockquote>`)))
    } else {
      return new Response(JSON.stringify({ error: 'type inconnu' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    await Promise.all(jobs)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})

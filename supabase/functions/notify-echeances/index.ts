// Supabase Edge Function — Notifications e-mail des échéances.
//
// Variables d'environnement (Supabase > Edge Functions > Secrets) :
//   SUPABASE_URL                (fourni automatiquement)
//   SUPABASE_SERVICE_ROLE_KEY   (fourni automatiquement)
//   RESEND_API_KEY              clé API Resend (https://resend.com)
//   NOTIFY_EMAIL_FROM           ex. "Flotte <flotte@ton-domaine.com>"
//   NOTIFY_EMAIL_TO             destinataire(s), séparés par des virgules
//   NOTIFY_DAYS_AHEAD           (optionnel, défaut 30) seuil d'alerte en jours
//
// Déploiement :   supabase functions deploy notify-echeances
// Planification : voir supabase/functions/README.md (pg_cron)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Vehicle {
  id: string
  matricule: string
  date_vidange: string | null
  vidange_interval_mois: number | null
  km_vidange: number | null
  vidange_interval_km: number | null
  date_distribution: string | null
  km_distribution: number | null
  distribution_interval_km: number | null
  date_assurance: string | null
  date_visite_technique: string | null
  date_vignette: string | null
  actif: boolean
}

const DAY = 1000 * 60 * 60 * 24

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / DAY)
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const warnDays = Number(Deno.env.get('NOTIFY_DAYS_AHEAD') ?? '30')

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('actif', true)
    if (error) throw error

    // Kilométrage courant par véhicule (max des pleins)
    const { data: logs } = await supabase.from('fuel_logs').select('vehicle_id, km')
    const kmByVehicle: Record<string, number> = {}
    for (const l of logs ?? []) {
      kmByVehicle[l.vehicle_id] = Math.max(kmByVehicle[l.vehicle_id] ?? 0, l.km)
    }

    const alerts: { matricule: string; label: string; detail: string; overdue: boolean }[] = []

    for (const v of (vehicles as Vehicle[]) ?? []) {
      const km = kmByVehicle[v.id] ?? null
      const push = (label: string, days: number | null) => {
        if (days === null) return
        if (days <= warnDays) {
          alerts.push({
            matricule: v.matricule,
            label,
            detail: days < 0 ? `dépassé de ${-days} j` : `dans ${days} j`,
            overdue: days < 0,
          })
        }
      }

      push('Assurance', daysUntil(v.date_assurance))
      push('Visite technique', daysUntil(v.date_visite_technique))
      push('Vignette', daysUntil(v.date_vignette))
      if (v.date_vidange && v.vidange_interval_mois) {
        push('Vidange (date)', daysUntil(addMonths(v.date_vidange, v.vidange_interval_mois)))
      }
      // Échéances kilométriques
      if (km != null && v.km_vidange != null && v.vidange_interval_km) {
        const remaining = v.km_vidange + v.vidange_interval_km - km
        if (remaining <= 1000) {
          alerts.push({
            matricule: v.matricule,
            label: 'Vidange (km)',
            detail: remaining < 0 ? `dépassé de ${-remaining} km` : `dans ${remaining} km`,
            overdue: remaining < 0,
          })
        }
      }
      if (km != null && v.km_distribution != null && v.distribution_interval_km) {
        const remaining = v.km_distribution + v.distribution_interval_km - km
        if (remaining <= 5000) {
          alerts.push({
            matricule: v.matricule,
            label: 'Distribution (km)',
            detail: remaining < 0 ? `dépassé de ${-remaining} km` : `dans ${remaining} km`,
            overdue: remaining < 0,
          })
        }
      }
    }

    if (alerts.length === 0) {
      return Response.json({ sent: false, message: 'Aucune échéance à notifier.' })
    }

    alerts.sort((a, b) => Number(b.overdue) - Number(a.overdue))
    const rows = alerts
      .map(
        (a) =>
          `<tr>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${a.matricule}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${a.label}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0;color:${
              a.overdue ? '#dc2626' : '#d97706'
            }">${a.detail}</td>
          </tr>`,
      )
      .join('')
    const html = `
      <h2>🚚 Échéances de la flotte</h2>
      <p>${alerts.length} échéance(s) dans les ${warnDays} prochains jours :</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
        <thead><tr>
          <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9">Matricule</th>
          <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9">Échéance</th>
          <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9">Statut</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`

    const to = (Deno.env.get('NOTIFY_EMAIL_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('NOTIFY_EMAIL_FROM') ?? 'Flotte <onboarding@resend.dev>',
        to,
        subject: `🚚 ${alerts.length} échéance(s) à surveiller`,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return new Response(`Erreur Resend: ${body}`, { status: 502 })
    }

    return Response.json({ sent: true, count: alerts.length })
  } catch (err) {
    return new Response(`Erreur: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    })
  }
})

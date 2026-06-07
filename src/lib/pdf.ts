import type { FuelLog, MaintenanceLog, Vehicle } from './types'
import {
  assuranceStatus,
  computeConsumption,
  consumptionSummary,
  currentKm,
  distributionStatus,
  vidangeStatus,
  vignetteStatus,
  visiteTechniqueStatus,
  type DeadlineStatus,
} from './fleet'

function esc(value: unknown): string {
  const s = value == null ? '' : String(value)
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

const COLOR: Record<string, string> = {
  ok: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
  unknown: '#64748b',
}

function badge(s: DeadlineStatus): string {
  return `<span class="badge" style="border-color:${COLOR[s.severity]};color:${COLOR[s.severity]}">
    ${esc(s.label)} : ${esc(s.detail)}</span>`
}

const STYLE = `
  * { font-family: Arial, Helvetica, sans-serif; }
  body { margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .muted { color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 7px; text-align: left; }
  th { background: #f1f5f9; }
  .badge { display: inline-block; border: 1px solid; border-radius: 6px;
           padding: 2px 8px; margin: 2px 4px 2px 0; font-size: 11px; }
  .danger { color: #dc2626; font-weight: bold; }
  @media print { body { margin: 12mm; } }
`

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Autorise les fenêtres pop-up pour générer le PDF.')
    return
  }
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>${esc(title)}</title><style>${STYLE}</style></head>
    <body>${body}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`)
  w.document.close()
}

export function printVehicleSheet(
  vehicle: Vehicle,
  logs: FuelLog[],
  maint: MaintenanceLog[],
) {
  const km = currentKm(logs)
  const statuses = [
    vidangeStatus(vehicle, km),
    distributionStatus(vehicle, km),
    assuranceStatus(vehicle),
    visiteTechniqueStatus(vehicle),
    vignetteStatus(vehicle),
    consumptionSummary(vehicle, logs),
  ]
  const rows = computeConsumption(vehicle, logs)

  const fuelRows = rows
    .map(
      (r) => `<tr>
        <td>${esc(new Date(r.log.date).toLocaleDateString('fr-FR'))}</td>
        <td>${esc(r.log.km.toLocaleString('fr-FR'))}</td>
        <td>${r.distance != null ? esc(r.distance) + ' km' : '—'}</td>
        <td>${esc(r.log.litres)} L${r.log.plein_complet ? '' : ' (partiel)'}</td>
        <td>${r.consoReelle != null ? r.consoReelle.toFixed(1) + ' L/100' : '—'}</td>
        <td class="${r.severity === 'danger' ? 'danger' : ''}">${
          r.ecartPct != null ? (r.ecartPct >= 0 ? '+' : '') + r.ecartPct.toFixed(0) + '%' : '—'
        }</td>
      </tr>`,
    )
    .join('')

  const maintRows = maint
    .map(
      (m) => `<tr>
        <td>${esc(new Date(m.date).toLocaleDateString('fr-FR'))}</td>
        <td>${esc(m.type)}</td>
        <td>${m.km != null ? esc(m.km.toLocaleString('fr-FR')) : '—'}</td>
        <td>${m.cout != null ? esc(m.cout) + ' DH' : '—'}</td>
        <td>${esc(m.note ?? '—')}</td>
      </tr>`,
    )
    .join('')

  const body = `
    <h1>Fiche véhicule — ${esc(vehicle.matricule)}</h1>
    <p class="muted">${esc([vehicle.marque, vehicle.modele].filter(Boolean).join(' '))}
      ${vehicle.chauffeur ? '· Chauffeur : ' + esc(vehicle.chauffeur) : ''}
      ${km != null ? '· ' + esc(km.toLocaleString('fr-FR')) + ' km' : ''}
      · Édité le ${esc(new Date().toLocaleDateString('fr-FR'))}</p>

    <h2>Échéances & consommation</h2>
    <div>${statuses.map(badge).join('')}</div>

    <h2>Historique des pleins</h2>
    ${
      fuelRows
        ? `<table><thead><tr><th>Date</th><th>km</th><th>Distance</th><th>Litres</th>
           <th>Conso réelle</th><th>Écart</th></tr></thead><tbody>${fuelRows}</tbody></table>`
        : '<p class="muted">Aucun plein enregistré.</p>'
    }

    <h2>Historique d'entretien</h2>
    ${
      maintRows
        ? `<table><thead><tr><th>Date</th><th>Type</th><th>km</th><th>Coût</th>
           <th>Note</th></tr></thead><tbody>${maintRows}</tbody></table>`
        : '<p class="muted">Aucun entretien enregistré.</p>'
    }`

  openPrint(`Fiche ${vehicle.matricule}`, body)
}

export function printFleetReport(
  vehicles: Vehicle[],
  logsByVehicle: Record<string, FuelLog[]>,
) {
  const rows = vehicles
    .map((v) => {
      const logs = logsByVehicle[v.id] ?? []
      const km = currentKm(logs)
      const cells = [
        vidangeStatus(v, km),
        distributionStatus(v, km),
        assuranceStatus(v),
        visiteTechniqueStatus(v),
        vignetteStatus(v),
        consumptionSummary(v, logs),
      ]
        .map(
          (s) =>
            `<td style="color:${COLOR[s.severity]}">${esc(s.detail)}</td>`,
        )
        .join('')
      return `<tr>
        <td><b>${esc(v.matricule)}</b></td>
        <td>${esc(v.chauffeur ?? '—')}</td>
        <td>${km != null ? esc(km.toLocaleString('fr-FR')) : '—'}</td>
        ${cells}
      </tr>`
    })
    .join('')

  const body = `
    <h1>Rapport de flotte</h1>
    <p class="muted">${vehicles.length} véhicule(s) · Édité le ${esc(
      new Date().toLocaleDateString('fr-FR'),
    )}</p>
    <table>
      <thead><tr>
        <th>Matricule</th><th>Chauffeur</th><th>km</th>
        <th>Vidange</th><th>Distribution</th><th>Assurance</th>
        <th>Visite tech.</th><th>Vignette</th><th>Conso</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`

  openPrint('Rapport de flotte', body)
}

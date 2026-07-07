import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../db/database';
import { Reservation, Partner, OTA, Excursion } from '../types';
import { createError } from '../middleware/errorHandler';

const NAVY = '#0D2137';
const ACCENT = '#1A6FA8';
const LIGHT = '#F4F7FB';
const TEXT = '#1A1A2E';
const MUTED = '#6B7280';

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string, agencyName: string): void {
  // Navy header bar
  doc.rect(0, 0, doc.page.width, 80).fill(NAVY);
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
    .text(agencyName, 40, 20, { width: doc.page.width - 200 });
  doc.fontSize(10).font('Helvetica')
    .text('Agence de Voyages', 40, 46, { width: doc.page.width - 200 });

  // Title block
  doc.rect(0, 80, doc.page.width, 50).fill(ACCENT);
  doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
    .text(title, 40, 92);
  doc.fontSize(10).font('Helvetica')
    .text(subtitle, doc.page.width - 220, 96, { width: 180, align: 'right' });

  doc.fillColor(TEXT);
  doc.y = 155;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number): void {
  const y = doc.page.height - 40;
  doc.rect(0, y - 5, doc.page.width, 40).fill(NAVY);
  doc.fillColor('#FFFFFF').fontSize(8)
    .text(`Généré le ${new Date().toLocaleDateString('fr-TN')} — Page ${pageNum}`, 40, y + 5, {
      width: doc.page.width - 80, align: 'center',
    });
}

function tableRow(
  doc: PDFKit.PDFDocument, y: number,
  cols: string[], widths: number[], startX: number,
  isHeader = false, isAlt = false
): void {
  if (isHeader) {
    doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), 22).fill(ACCENT);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  } else {
    if (isAlt) doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), 20).fill(LIGHT);
    doc.fillColor(TEXT).font('Helvetica').fontSize(8);
  }
  let x = startX;
  for (let i = 0; i < cols.length; i++) {
    doc.text(cols[i] || '', x + 4, y + (isHeader ? 6 : 5), { width: widths[i] - 8, ellipsis: true });
    x += widths[i];
  }
}

function getSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function missionOrder(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare(`
      SELECT r.*, e.name AS excursion_name, e.code AS excursion_code, e.description AS excursion_description,
        e.duration_days, o.name AS ota_name,
        d.name AS driver_name, d.phone AS driver_phone, d.vehicle_type,
        g.name AS guide_name, g.phone AS guide_phone,
        p.name AS transporter_name
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      LEFT JOIN otas o ON o.id = r.ota_id
      LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN guides g ON g.id = r.guide_id
      LEFT JOIN partners p ON p.id = r.transporter_id
      WHERE r.id = ?
    `).get(req.params.reservationId) as (Reservation & {
      excursion_name?: string; excursion_code?: string; excursion_description?: string; duration_days?: number;
      ota_name?: string; driver_name?: string; driver_phone?: string; vehicle_type?: string;
      guide_name?: string; guide_phone?: string; transporter_name?: string;
    }) | undefined;

    if (!reservation) { next(createError('Reservation not found', 404)); return; }

    const supplierBookings = db.prepare(`
      SELECT sb.*, p.name AS partner_name, p.type AS partner_type
      FROM supplier_bookings sb
      LEFT JOIN partners p ON p.id = sb.partner_id
      WHERE sb.reservation_id = ?
    `).all(req.params.reservationId);

    const settings = getSettings();
    const agencyName = settings['agency_name'] || 'DepartTravel';

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=mission-order-${reservation.id}.pdf`);
    doc.pipe(res);

    // Header
    drawHeader(
      doc,
      `ORDRE DE MISSION #${reservation.id}`,
      `Ref OTA: ${reservation.ota_ref || 'N/A'}`,
      agencyName
    );

    // Client info box
    doc.rect(40, doc.y, 250, 110).fill(LIGHT).stroke('#E0E7EF');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('INFORMATIONS CLIENT', 50, doc.y + 8);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    const clientY = doc.y + 5;
    doc.text(`Nom: ${reservation.client_name || 'N/C'}`, 50, clientY + 15);
    doc.text(`Hôtel: ${reservation.client_hotel || 'N/C'}`, 50, clientY + 30);
    doc.text(`Téléphone: ${reservation.phone || 'N/C'}`, 50, clientY + 45);
    doc.text(`Adultes: ${reservation.pax_adults} | Enfants: ${reservation.pax_children}`, 50, clientY + 60);
    doc.text(`Prise en charge: ${reservation.pickup_time || 'N/C'}`, 50, clientY + 75);

    // Excursion info box
    doc.rect(310, doc.y - 5, 245, 110).fill(LIGHT).stroke('#E0E7EF');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('EXCURSION', 320, doc.y + 3);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    const excY = doc.y + 0;
    doc.text(`Code: ${(reservation as unknown as Record<string, unknown>)['excursion_code'] as string || 'N/C'}`, 320, excY + 15);
    doc.text(`Nom: ${(reservation as unknown as Record<string, unknown>)['excursion_name'] as string || 'N/C'}`, 320, excY + 30, { width: 220 });
    doc.text(`Date: ${reservation.excursion_date || 'N/C'}`, 320, excY + 47);
    doc.text(`Durée: ${(reservation as unknown as Record<string, unknown>)['duration_days'] as number || 1} jour(s)`, 320, excY + 62);
    doc.text(`Statut: ${reservation.status.toUpperCase()}`, 320, excY + 77);

    doc.y = clientY + 105;
    doc.moveDown(0.5);

    // Resources section
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('RESSOURCES ASSIGNÉES', 40);
    doc.moveDown(0.3);

    const resY = doc.y;
    const widths = [80, 150, 130, 155];
    tableRow(doc, resY, ['Type', 'Nom', 'Contact', 'Détails'], widths, 40, true);
    let row = 0;
    if (reservation.driver_name) {
      tableRow(doc, resY + 22 + row * 20, ['Chauffeur', reservation.driver_name as string, reservation.driver_phone as string || '', (reservation as unknown as Record<string, unknown>)['vehicle_type'] as string || ''], widths, 40, false, row % 2 === 0);
      row++;
    }
    if (reservation.guide_name) {
      tableRow(doc, resY + 22 + row * 20, ['Guide', reservation.guide_name as string, reservation.guide_phone as string || '', ''], widths, 40, false, row % 2 === 0);
      row++;
    }
    if (reservation.transporter_name) {
      tableRow(doc, resY + 22 + row * 20, ['Transport', reservation.transporter_name as string, '', ''], widths, 40, false, row % 2 === 0);
      row++;
    }
    if (row === 0) {
      doc.fillColor(MUTED).fontSize(9).text('Aucune ressource assignée', 50, resY + 22);
      row = 1;
    }
    doc.y = resY + 22 + row * 20 + 15;

    // Supplier bookings
    if ((supplierBookings as unknown[]).length > 0) {
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('RÉSERVATIONS FOURNISSEURS', 40);
      doc.moveDown(0.3);
      const sbY = doc.y;
      const sbWidths = [80, 130, 80, 80, 100];
      tableRow(doc, sbY, ['Type service', 'Partenaire', 'Date', 'Montant', 'Statut'], sbWidths, 40, true);
      (supplierBookings as Array<{ service_type: string; partner_name: string; date: string; amount: number; currency: string; status: string }>).forEach((sb, i) => {
        tableRow(doc, sbY + 22 + i * 20,
          [sb.service_type, sb.partner_name || 'N/C', sb.date || '', `${sb.amount} ${sb.currency}`, sb.status],
          sbWidths, 40, false, i % 2 === 0);
      });
      doc.y = sbY + 22 + (supplierBookings as unknown[]).length * 20 + 15;
    }

    // Financial summary
    const netPrice = reservation.sale_price * (1 - reservation.commission_pct / 100);
    doc.moveDown(0.5);
    doc.rect(40, doc.y, doc.page.width - 80, 70).fill(LIGHT).stroke('#E0E7EF');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('RÉSUMÉ FINANCIER', 50, doc.y + 8);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    const finY = doc.y + 5;
    doc.text(`Prix de vente brut: ${reservation.sale_price} ${reservation.sale_currency}`, 50, finY + 18);
    doc.text(`Commission OTA (${reservation.commission_pct}%): ${(reservation.sale_price * reservation.commission_pct / 100).toFixed(2)} ${reservation.sale_currency}`, 50, finY + 33);
    doc.fillColor(NAVY).font('Helvetica-Bold')
      .text(`Prix net: ${netPrice.toFixed(2)} ${reservation.sale_currency}`, 50, finY + 48);

    if (reservation.remarks) {
      doc.y = finY + 90;
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text('REMARQUES', 40);
      doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(reservation.remarks, 40, doc.y + 5);
    }

    drawFooter(doc, 1);

    // Update mission order record
    db.prepare(`
      INSERT OR REPLACE INTO mission_orders (reservation_id, generated_at)
      VALUES (?, datetime('now'))
    `).run(reservation.id);

    doc.end();
  } catch (err) {
    next(err);
  }
}

export function partnerSheet(req: Request, res: Response, next: NextFunction): void {
  try {
    const { partnerId, month } = req.params;
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId) as Partner | undefined;
    if (!partner) { next(createError('Partner not found', 404)); return; }

    const bookings = db.prepare(`
      SELECT sb.*, r.client_name, r.excursion_date, e.name AS excursion_name, e.code AS excursion_code,
        r.pax_adults + r.pax_children AS total_pax
      FROM supplier_bookings sb
      LEFT JOIN reservations r ON r.id = sb.reservation_id
      LEFT JOIN excursions e ON e.id = r.excursion_id
      WHERE sb.partner_id = ?
        AND strftime('%Y-%m', COALESCE(sb.date, r.excursion_date)) = ?
        AND sb.status != 'cancelled'
      ORDER BY COALESCE(sb.date, r.excursion_date) ASC
    `).all(partnerId, month) as Array<{
      id: number; service_type: string; client_name: string; excursion_name: string;
      excursion_date: string; total_pax: number; amount: number; currency: string; notes: string;
    }>;

    const totalHt = bookings.reduce((s, b) => s + b.amount, 0);
    const tvaAmount = totalHt * 0.19;
    const fiscalStamp = 1;
    const totalTtc = totalHt + tvaAmount + fiscalStamp;

    const settings = getSettings();
    const agencyName = settings['agency_name'] || 'DepartTravel';
    const [year, mon] = month.split('-');
    const monthLabel = new Date(Number(year), Number(mon) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=partner-sheet-${partnerId}-${month}.pdf`);
    doc.pipe(res);

    drawHeader(doc, `FICHE MENSUELLE PARTENAIRE`, `${monthLabel}`, agencyName);

    // Partner info
    doc.rect(40, doc.y, doc.page.width - 80, 65).fill(LIGHT).stroke('#E0E7EF');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('PARTENAIRE', 50, doc.y + 8);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    const pY = doc.y + 5;
    doc.text(`Nom: ${partner.name}`, 50, pY + 18);
    doc.text(`Type: ${partner.type}`, 50, pY + 33);
    doc.text(`TVA N°: ${partner.tva_number || 'N/A'}`, 300, pY + 18);
    doc.text(`RIB: ${partner.rib || 'N/A'}`, 300, pY + 33);
    doc.y = pY + 80;

    // Bookings table
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('DÉTAIL DES PRESTATIONS', 40);
    doc.moveDown(0.3);

    const tblY = doc.y;
    const cols = ['Date', 'Excursion', 'Client', 'Pax', 'Service', 'Montant HT'];
    const wids = [65, 110, 100, 35, 90, 80];
    tableRow(doc, tblY, cols, wids, 40, true);

    bookings.forEach((b, i) => {
      const y = tblY + 22 + i * 20;
      if (y > doc.page.height - 120) return; // Simple overflow guard
      tableRow(doc, y, [
        b.excursion_date || '',
        b.excursion_name || '',
        b.client_name || '',
        String(b.total_pax || ''),
        b.service_type,
        `${b.amount.toFixed(2)} TND`,
      ], wids, 40, false, i % 2 === 0);
    });

    doc.y = tblY + 22 + bookings.length * 20 + 20;

    // Financial summary
    doc.rect(doc.page.width - 250, doc.y, 210, 95).fill(LIGHT).stroke('#E0E7EF');
    const sumX = doc.page.width - 240;
    const sumY = doc.y + 8;
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('RÉCAPITULATIF', sumX, sumY);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    doc.text(`Total HT:`, sumX, sumY + 18).text(`${totalHt.toFixed(2)} TND`, sumX + 100, sumY + 18);
    doc.text(`TVA (19%):`, sumX, sumY + 33).text(`${tvaAmount.toFixed(2)} TND`, sumX + 100, sumY + 33);
    doc.text(`Timbre fiscal:`, sumX, sumY + 48).text(`${fiscalStamp.toFixed(3)} TND`, sumX + 100, sumY + 48);
    doc.rect(sumX - 2, sumY + 62, 214, 22).fill(NAVY);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
      .text(`TOTAL TTC:`, sumX + 2, sumY + 68)
      .text(`${totalTtc.toFixed(2)} TND`, sumX + 102, sumY + 68);
    doc.y = sumY + 120;

    drawFooter(doc, 1);
    doc.end();
  } catch (err) {
    next(err);
  }
}

export function otaSheet(req: Request, res: Response, next: NextFunction): void {
  try {
    const { otaId, month } = req.params;
    const ota = db.prepare('SELECT * FROM otas WHERE id = ?').get(otaId) as OTA | undefined;
    if (!ota) { next(createError('OTA not found', 404)); return; }

    const reservations = db.prepare(`
      SELECT r.*, e.name AS excursion_name, e.code AS excursion_code
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      WHERE r.ota_id = ?
        AND strftime('%Y-%m', COALESCE(r.excursion_date, r.date_received)) = ?
        AND r.status != 'cancelled'
      ORDER BY r.excursion_date ASC
    `).all(otaId, month) as Array<Reservation & { excursion_name: string; excursion_code: string }>;

    const grossRevenue = reservations.reduce((s, r) => s + r.sale_price, 0);
    const commissionAmount = grossRevenue * (ota.commission_pct / 100);
    const netRevenue = grossRevenue - commissionAmount;

    const settings = getSettings();
    const agencyName = settings['agency_name'] || 'DepartTravel';
    const [year, mon] = month.split('-');
    const monthLabel = new Date(Number(year), Number(mon) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=ota-sheet-${otaId}-${month}.pdf`);
    doc.pipe(res);

    drawHeader(doc, `RELEVÉ OTA — ${ota.name}`, monthLabel, agencyName);

    // OTA info
    doc.rect(40, doc.y, 250, 55).fill(LIGHT).stroke('#E0E7EF');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('PLATEFORME OTA', 50, doc.y + 8);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    const oY = doc.y + 5;
    doc.text(`Nom: ${ota.name}`, 50, oY + 18);
    doc.text(`Commission: ${ota.commission_pct}%`, 50, oY + 33);
    doc.text(`Devise: ${ota.default_currency}`, 200, oY + 18);
    doc.y = oY + 72;

    // Reservations table
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text(`RÉSERVATIONS — ${reservations.length} dossier(s)`, 40);
    doc.moveDown(0.3);

    const tblY = doc.y;
    const cols = ['Réf OTA', 'Client', 'Excursion', 'Date', 'Adultes', 'Enfants', 'Prix brut', 'Net'];
    const wids = [65, 80, 85, 65, 40, 40, 65, 65];
    tableRow(doc, tblY, cols, wids, 40, true);

    reservations.forEach((r, i) => {
      const net = r.sale_price * (1 - r.commission_pct / 100);
      tableRow(doc, tblY + 22 + i * 20, [
        r.ota_ref || '', r.client_name || '', r.excursion_name || '',
        r.excursion_date || '', String(r.pax_adults), String(r.pax_children),
        `${r.sale_price.toFixed(2)}`, `${net.toFixed(2)}`,
      ], wids, 40, false, i % 2 === 0);
    });

    doc.y = tblY + 22 + reservations.length * 20 + 20;

    // Summary
    doc.rect(doc.page.width - 250, doc.y, 210, 80).fill(LIGHT).stroke('#E0E7EF');
    const sX = doc.page.width - 240;
    const sY = doc.y + 8;
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('RÉCAPITULATIF', sX, sY);
    doc.fillColor(TEXT).font('Helvetica').fontSize(9);
    doc.text('Chiffre d\'affaires brut:', sX, sY + 18).text(`${grossRevenue.toFixed(2)} ${ota.default_currency}`, sX + 125, sY + 18);
    doc.text(`Commission (${ota.commission_pct}%):`, sX, sY + 33).text(`-${commissionAmount.toFixed(2)} ${ota.default_currency}`, sX + 125, sY + 33);
    doc.rect(sX - 2, sY + 49, 214, 22).fill(NAVY);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
      .text('Net à recevoir:', sX + 2, sY + 55)
      .text(`${netRevenue.toFixed(2)} ${ota.default_currency}`, sX + 127, sY + 55);

    drawFooter(doc, 1);
    doc.end();
  } catch (err) {
    next(err);
  }
}

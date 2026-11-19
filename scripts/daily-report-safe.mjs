#!/usr/bin/env node
// ============================================================
//  DTS — Rapport Quotidien Automatique (SAFE VERSION)
//
//  SECURITE :
//  - 100% LECTURE SEULE — uniquement des SELECT, jamais d'INSERT/UPDATE/DELETE
//  - Connexion PostgreSQL independante (pg) — n'utilise PAS Prisma
//  - Ne touche a AUCUN fichier de l'app (pas de .env, pas de schema, rien)
//  - Tourne dans son propre dossier (~/dts-reports/) SEPARE de l'app
//  - Si une query echoue, le script continue les autres checks
//  - Si l'envoi mail echoue, le rapport est quand meme affiche en console
// ============================================================

import pg from "pg";
import nodemailer from "nodemailer";

// ---- CONFIG ------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERREUR: DATABASE_URL manquant. Usage: DATABASE_URL=postgresql://... node daily-report-safe.mjs");
  process.exit(1);
}

const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SEND_EMAILS = !!GMAIL_APP_PASSWORD; // Si pas de password, on affiche seulement en console

const SMTP_CONFIG = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "agence.departtravel@gmail.com",
    pass: GMAIL_APP_PASSWORD || "",
  },
};

const TEAM_EMAILS = {
  karima:  "Ktkitek@gmail.com",
  farah:   "bakirfarah31@gmail.com",
  elyes:   "Bnlres13@gmail.com",
  imed:    "imedboughali1@gmail.com",
  mohamed: "ounissim354@gmail.com",
  hiba:    "boubguirahiba2@gmail.com",
  hersi:   "hersikhalil26@gmail.com",
  montana: "montanaguidepro@gmail.com",
  amine:   "amine.departtravel@gmail.com",
  adel:    "adelebouajila@gmail.com",
  aymen:   "agence.departtravel@gmail.com",
};

// ---- DB CONNECTION (read-only) -----------------------------
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 2, // Seulement 2 connexions pour ne pas surcharger
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000, // 15s max par query
});

/** Execute un SELECT et retourne les rows. Refuse tout sauf SELECT. */
async function query(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    throw new Error(`SECURITE: Seuls les SELECT sont autorises. Query refusee: ${sql.substring(0, 50)}`);
  }
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.warn(`  [WARN] Query echouee (on continue): ${err.message}`);
    return [];
  }
}

// ---- HELPERS -----------------------------------------------
const now = new Date();
const todayStr = now.toISOString().split("T")[0]; // "2026-11-16"
const yesterdayDate = new Date(now);
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
const tomorrowDate = new Date(now);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

const findings = [];
const taskLists = {}; // person -> [{ title, items: [string] }]

function flag(person, level, message) {
  findings.push({ person, level, message });
}

function addTaskList(person, title, items) {
  if (!taskLists[person]) taskLists[person] = [];
  if (items.length > 0) {
    taskLists[person].push({ title, items });
  }
}

// ---- SCHEMA DISCOVERY (safe) --------------------------------
async function tableExists(tableName) {
  const rows = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function listTables() {
  return await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
}

async function listColumns(tableName) {
  return await query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tableName]
  );
}

// ---- CHECKS ------------------------------------------------
async function checkBookings() {
  try {
    if (!(await tableExists("Booking"))) {
      if (!(await tableExists("booking"))) {
        console.log("  [INFO] Table 'Booking'/'booking' non trouvee — check reservations ignore");
        return;
      }
    }

    const bookingTable = (await tableExists("Booking")) ? '"Booking"' : "booking";
    const cols = await listColumns(bookingTable.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);
    console.log(`  [INFO] Colonnes de ${bookingTable}: ${colNames.slice(0, 15).join(", ")}...`);

    if (colNames.includes("price") && colNames.includes("createdAt")) {
      const incomplete = await query(
        `SELECT id, "clientName", price, "priceCurrency"
         FROM ${bookingTable}
         WHERE "createdAt"::date >= $1 AND "createdAt"::date <= $2
         AND (price IS NULL OR price = 0)`,
        [yesterdayStr, todayStr]
      );
      if (incomplete.length > 0) {
        flag("farah", "ROUGE", `${incomplete.length} reservation(s) sans prix : ${incomplete.map(b => b.clientName || b.id).join(", ")}`);
      }
    }

    if (colNames.includes("remainingAmount") || colNames.includes("remaining_amount")) {
      const remainCol = colNames.includes("remainingAmount") ? '"remainingAmount"' : "remaining_amount";
      const unpaid = await query(
        `SELECT id, "clientName", ${remainCol} as remaining, "priceCurrency"
         FROM ${bookingTable}
         WHERE ${remainCol} > 0
         AND "startDate" < $1
         ORDER BY "startDate" ASC
         LIMIT 20`,
        [todayStr]
      );
      if (unpaid.length > 0) {
        flag("mohamed", "ROUGE", `${unpaid.length} reservation(s) passee(s) avec reste a payer : ${unpaid.slice(0, 5).map(b => `${b.clientName || "?"}: ${b.remaining} ${b.priceCurrency || ""}`).join(", ")}`);
      }
    }
  } catch (err) {
    console.warn(`  [WARN] checkBookings: ${err.message}`);
  }
}

async function checkFinance() {
  try {
    const table = (await tableExists("FinanceEntry")) ? '"FinanceEntry"' :
                  (await tableExists("finance_entry")) ? "finance_entry" : null;
    if (!table) {
      console.log("  [INFO] Table finance non trouvee — check depenses ignore");
      return;
    }

    const cols = await listColumns(table.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);

    if (colNames.includes("description") && colNames.includes("type")) {
      const vague = await query(
        `SELECT id, amount, description, currency
         FROM ${table}
         WHERE "createdAt"::date >= $1
         AND type = 'EXPENSE'
         AND (description IS NULL OR description = '' OR description ILIKE '%divers%' OR description ILIKE '%autre%')
         LIMIT 20`,
        [yesterdayStr]
      );
      if (vague.length > 0) {
        flag("karima", "ROUGE", `${vague.length} depense(s) cash sans motif precis : ${vague.map(e => `${e.amount} ${e.currency || ""} "${e.description || "VIDE"}"`).join(", ")}`);
      }
    }
  } catch (err) {
    console.warn(`  [WARN] checkFinance: ${err.message}`);
  }
}

async function checkTrips() {
  try {
    const table = (await tableExists("Trip")) ? '"Trip"' :
                  (await tableExists("trip")) ? "trip" : null;
    if (!table) {
      console.log("  [INFO] Table Trip non trouvee — check mouvements ignore");
      return;
    }

    const cols = await listColumns(table.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);
    console.log(`  [INFO] Colonnes de ${table}: ${colNames.slice(0, 15).join(", ")}...`);

    const kmStartCol = colNames.includes("kmStart") ? '"kmStart"' :
                       colNames.includes("km_start") ? "km_start" : null;
    const kmEndCol = colNames.includes("kmEnd") ? '"kmEnd"' :
                     colNames.includes("km_end") ? "km_end" : null;

    if (kmStartCol && kmEndCol) {
      const noKm = await query(
        `SELECT id, ${kmStartCol} as km_start, ${kmEndCol} as km_end
         FROM ${table}
         WHERE date >= $1 AND date <= $2
         AND (${kmStartCol} IS NULL OR ${kmEndCol} IS NULL)`,
        [yesterdayStr, todayStr]
      );
      if (noKm.length > 0) {
        flag("chauffeurs", "ROUGE", `${noKm.length} sortie(s) sans km depart ou retour`);

        if (colNames.includes("zone")) {
          const noKmSud = noKm.filter(t => t.zone === "SUD" || t.zone === "sud");
          const noKmNord = noKm.filter(t => t.zone === "NORD" || t.zone === "nord");
          if (noKmSud.length > 0) flag("hiba", "ROUGE", `${noKmSud.length} mouvement(s) Sud sans km complets`);
          if (noKmNord.length > 0) flag("hersi", "ROUGE", `${noKmNord.length} mouvement(s) Nord sans km complets`);
        }
      }
    }
  } catch (err) {
    console.warn(`  [WARN] checkTrips: ${err.message}`);
  }
}

async function checkFuel() {
  try {
    const table = (await tableExists("FuelLog")) ? '"FuelLog"' :
                  (await tableExists("fuel_log")) ? "fuel_log" :
                  (await tableExists("fuel_logs")) ? "fuel_logs" : null;
    if (!table) {
      console.log("  [INFO] Table FuelLog non trouvee — check gasoil ignore");
      return;
    }

    const cols = await listColumns(table.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);

    if (colNames.includes("litres")) {
      const noDetail = await query(
        `SELECT id FROM ${table}
         WHERE date >= $1
         AND (litres IS NULL OR litres = 0)`,
        [yesterdayStr]
      );
      if (noDetail.length > 0) {
        flag("hiba", "ORANGE", `${noDetail.length} plein(s) gasoil sans litres`);
        flag("hersi", "ORANGE", `${noDetail.length} plein(s) gasoil sans litres`);
      }
    }
  } catch (err) {
    console.warn(`  [WARN] checkFuel: ${err.message}`);
  }
}

async function checkCelia() {
  const dayOfMonth = now.getDate();
  if (dayOfMonth >= 11 && dayOfMonth <= 13) {
    flag("celia", "ORANGE", "Rapport mensuel du pour le 10 — verifier s'il a ete envoye");
  }
}

async function checkElyesGYG() {
  try {
    const bookingTable = (await tableExists("Booking")) ? '"Booking"' :
                         (await tableExists("booking")) ? "booking" : null;
    if (!bookingTable) return;

    const cols = await listColumns(bookingTable.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);

    if (!colNames.includes("supplier") || !colNames.includes("startDate")) return;

    const clientCol = colNames.includes("clientName") ? '"clientName"' : "'?'";
    const priceCol = colNames.includes("price") ? "price" : "NULL";
    const currCol = colNames.includes("priceCurrency") ? '"priceCurrency"' : "''";
    const nbCol = colNames.includes("numberOfPeople") ? '"numberOfPeople"' : "NULL";
    const phoneCol = colNames.includes("clientPhone") ? ', "clientPhone"' : "";
    const emailCol = colNames.includes("clientEmail") ? ', "clientEmail"' : "";
    const activityCol = colNames.includes("activity") ? ", activity" :
                        colNames.includes("excursionName") ? ', "excursionName"' :
                        colNames.includes("activityName") ? ', "activityName"' : "";

    const gyg = await query(
      `SELECT id, ${clientCol} as client, "startDate"::date as date_debut,
              ${priceCol} as prix, ${currCol} as devise, ${nbCol} as nb_pers
              ${phoneCol} ${emailCol} ${activityCol}
       FROM ${bookingTable}
       WHERE supplier ILIKE '%gyg%' OR supplier ILIKE '%getyourguide%' OR supplier ILIKE '%get your guide%'
       AND "startDate"::date >= $1 AND "startDate"::date <= $2
       ORDER BY "startDate" ASC
       LIMIT 50`,
      [todayStr, tomorrowStr]
    );

    if (gyg.length > 0) {
      addTaskList("elyes", `Reservations GYG du ${todayStr} au ${tomorrowStr}`, gyg.map(b =>
        `${b.client || "?"} — ${b.date_debut} — ${b.nb_pers || "?"} pers. — ${b.prix || "?"} ${b.devise || ""}` +
        (b.clientPhone ? ` — Tel: ${b.clientPhone}` : "") +
        (b.clientEmail ? ` — ${b.clientEmail}` : "") +
        (b.activity || b.excursionName || b.activityName ? ` — ${b.activity || b.excursionName || b.activityName}` : "")
      ));
    }

    const cancelledCol = colNames.includes("status") ? "status" :
                         colNames.includes("cancelled") ? "cancelled" : null;
    if (cancelledCol) {
      const cancelled = await query(
        `SELECT id, ${clientCol} as client, "startDate"::date as date_debut
         FROM ${bookingTable}
         WHERE (supplier ILIKE '%gyg%' OR supplier ILIKE '%getyourguide%')
         AND (${cancelledCol === "status" ? `status ILIKE '%cancel%'` : `cancelled = true`})
         AND "updatedAt"::date >= $1
         ORDER BY "updatedAt" DESC
         LIMIT 20`,
        [yesterdayStr]
      );
      if (cancelled.length > 0) {
        flag("elyes", "ORANGE", `${cancelled.length} annulation(s) GYG recente(s) : ${cancelled.map(b => b.client || b.id).join(", ")}`);
      }
    }
  } catch (err) {
    console.warn(`  [WARN] checkElyesGYG: ${err.message}`);
  }
}

async function checkImedActivities() {
  try {
    const bookingTable = (await tableExists("Booking")) ? '"Booking"' :
                         (await tableExists("booking")) ? "booking" : null;
    if (!bookingTable) return;

    const cols = await listColumns(bookingTable.replace(/"/g, ""));
    const colNames = cols.map(c => c.column_name);

    if (!colNames.includes("startDate")) return;

    const activityPatterns = [
      "djerba explore", "quad", "dromadaire", "camel",
      "excursion", "activit", "safari", "plongee", "diving",
      "jet ski", "jetski", "parasailing", "banana",
      "thalasso", "spa", "pirate", "flamingo",
      "krokodilfarm", "crocodile", "houmt souk", "guellala",
      "midoun", "erriadh", "street art"
    ];

    const clientCol = colNames.includes("clientName") ? '"clientName"' : "'?'";
    const priceCol = colNames.includes("price") ? "price" : "NULL";
    const currCol = colNames.includes("priceCurrency") ? '"priceCurrency"' : "''";
    const nbCol = colNames.includes("numberOfPeople") ? '"numberOfPeople"' : "NULL";
    const supplierCol = colNames.includes("supplier") ? ", supplier" : "";

    const actCol = colNames.includes("activity") ? "activity" :
                   colNames.includes("excursionName") ? '"excursionName"' :
                   colNames.includes("activityName") ? '"activityName"' :
                   colNames.includes("productName") ? '"productName"' : null;

    if (!actCol) {
      console.log("  [INFO] Pas de colonne activite trouvee — check Imed ignore");
      return;
    }

    const wherePatterns = activityPatterns.map((_, i) => `${actCol} ILIKE $${i + 3}`).join(" OR ");
    const params = [todayStr, tomorrowStr, ...activityPatterns.map(p => `%${p}%`)];

    const activities = await query(
      `SELECT id, ${clientCol} as client, "startDate"::date as date_debut,
              ${actCol} as activite, ${priceCol} as prix, ${currCol} as devise,
              ${nbCol} as nb_pers ${supplierCol}
       FROM ${bookingTable}
       WHERE "startDate"::date >= $1 AND "startDate"::date <= $2
       AND (${wherePatterns})
       ORDER BY "startDate" ASC
       LIMIT 50`,
      params
    );

    if (activities.length > 0) {
      addTaskList("imed", `Activites du ${todayStr} au ${tomorrowStr}`, activities.map(b =>
        `${b.activite || "?"} — ${b.client || "?"} — ${b.date_debut} — ${b.nb_pers || "?"} pers. — ${b.prix || "?"} ${b.devise || ""}` +
        (b.supplier ? ` (${b.supplier})` : "")
      ));
    }
  } catch (err) {
    console.warn(`  [WARN] checkImedActivities: ${err.message}`);
  }
}

// ---- SCHEMA DUMP (for debugging) ---------------------------
async function dumpSchema() {
  console.log("\n=== TABLES DISPONIBLES ===");
  const tables = await listTables();
  for (const t of tables) {
    const cols = await listColumns(t.table_name);
    console.log(`  ${t.table_name} (${cols.length} colonnes): ${cols.map(c => c.column_name).join(", ")}`);
  }
  console.log("=========================\n");
}

// ---- EMAIL -------------------------------------------------
async function sendEmails() {
  if (!SEND_EMAILS) {
    console.log("\n[INFO] GMAIL_APP_PASSWORD non defini — emails non envoyes (mode console uniquement)");
    return;
  }

  const transporter = nodemailer.createTransport(SMTP_CONFIG);

  try {
    await transporter.verify();
  } catch (err) {
    console.error(`[ERREUR] Connexion SMTP echouee: ${err.message}`);
    console.log("[INFO] Les anomalies sont affichees ci-dessus en console.");
    return;
  }

  for (const [person, email] of Object.entries(TEAM_EMAILS)) {
    if (person === "aymen" || person === "amine") continue; // Rapport CEO separe
    const personFindings = findings.filter(f => f.person === person);
    const personTasks = taskLists[person] || [];
    if (personFindings.length === 0 && personTasks.length === 0) continue;

    const rouges = personFindings.filter(f => f.level === "ROUGE");
    const oranges = personFindings.filter(f => f.level === "ORANGE");
    const name = person.charAt(0).toUpperCase() + person.slice(1);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1e3a5f;">DTS — Rapport du ${todayStr}</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        ${personTasks.length > 0 ? personTasks.map(t => `
          <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:12px;margin:10px 0;border-radius:4px;">
            <strong style="color:#2563eb;">TACHES DU JOUR — ${t.title}</strong>
            <ol style="margin:8px 0 0 0;padding-left:20px;">${t.items.map(item => `<li style="margin:4px 0;">${item}</li>`).join("")}</ol>
          </div>`).join("") : ""}
        ${rouges.length > 0 ? `
          <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:10px 0;border-radius:4px;">
            <strong style="color:#dc2626;">URGENT</strong>
            <ul>${rouges.map(f => `<li>${f.message}</li>`).join("")}</ul>
          </div>` : ""}
        ${oranges.length > 0 ? `
          <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:12px;margin:10px 0;border-radius:4px;">
            <strong style="color:#f59e0b;">A CORRIGER</strong>
            <ul>${oranges.map(f => `<li>${f.message}</li>`).join("")}</ul>
          </div>` : ""}
        ${personFindings.length === 0 && personTasks.length > 0 ? "<p style='color:#16a34a;'>Aucune anomalie detectee.</p>" : ""}
        <p style="color:#64748b;font-size:12px;margin-top:20px;">— Rapport automatique DTS</p>
      </div>`;

    try {
      await transporter.sendMail({
        from: '"DTS Rapport" <agence.departtravel@gmail.com>',
        to: email,
        subject: `DTS — ${rouges.length > 0 ? "URGENT — " : ""}${personTasks.length > 0 ? personTasks.length + " tache(s)" : "Rapport"} du ${todayStr}`,
        html,
      });
      console.log(`  Mail envoye a ${name} (${email})`);
    } catch (err) {
      console.warn(`  [WARN] Mail a ${name} echoue: ${err.message}`);
    }
  }

  // Rapport CEO a Aymen ET Amine
  const rouges = findings.filter(f => f.level === "ROUGE");
  const oranges = findings.filter(f => f.level === "ORANGE");

  const allTasks = Object.entries(taskLists);
  const ceoHtml = `
    <div style="font-family:Arial,sans-serif;max-width:700px;">
      <h2 style="color:#1e3a5f;">DTS — Rapport CEO du ${todayStr}</h2>
      <p><strong>${rouges.length}</strong> ROUGE | <strong>${oranges.length}</strong> ORANGE | <strong>${findings.length}</strong> anomalies | <strong>${allTasks.reduce((s, [, t]) => s + t.length, 0)}</strong> listes de taches</p>
      ${allTasks.length > 0 ? `
        <h3 style="color:#2563eb;">TACHES ENVOYEES</h3>
        ${allTasks.map(([person, lists]) => lists.map(t =>
          `<p><strong>${person.toUpperCase()}</strong> — ${t.title} (${t.items.length} items)</p>`
        ).join("")).join("")}` : ""}
      ${rouges.length > 0 ? `
        <h3 style="color:#dc2626;">ROUGE</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#fef2f2;"><th style="text-align:left;padding:8px;border:1px solid #ddd;">Qui</th><th style="text-align:left;padding:8px;border:1px solid #ddd;">Probleme</th></tr>
          ${rouges.map(f => `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${f.person.toUpperCase()}</td><td style="padding:8px;border:1px solid #ddd;">${f.message}</td></tr>`).join("")}
        </table>` : ""}
      ${oranges.length > 0 ? `
        <h3 style="color:#f59e0b;">ORANGE</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#fff7ed;"><th style="text-align:left;padding:8px;border:1px solid #ddd;">Qui</th><th style="text-align:left;padding:8px;border:1px solid #ddd;">Probleme</th></tr>
          ${oranges.map(f => `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${f.person.toUpperCase()}</td><td style="padding:8px;border:1px solid #ddd;">${f.message}</td></tr>`).join("")}
        </table>` : ""}
      ${findings.length === 0 && allTasks.length === 0 ? "<p style='color:#16a34a;font-size:1.2em;font-weight:bold;'>Tout est en ordre aujourd'hui.</p>" : ""}
      <p style="color:#64748b;font-size:12px;margin-top:30px;">— Rapport automatique DTS</p>
    </div>`;

  try {
    await transporter.sendMail({
      from: '"DTS Rapport CEO" <agence.departtravel@gmail.com>',
      to: [TEAM_EMAILS.aymen, TEAM_EMAILS.amine],
      subject: `DTS CEO — ${rouges.length} ROUGE / ${oranges.length} ORANGE — ${todayStr}`,
      html: ceoHtml,
    });
    console.log("  Rapport CEO envoye a Aymen et Amine");
  } catch (err) {
    console.warn(`  [WARN] Rapport CEO echoue: ${err.message}`);
  }
}

// ---- MAIN --------------------------------------------------
async function main() {
  console.log(`=== DTS Rapport Quotidien — ${now.toISOString()} ===`);
  console.log(`    Mode: ${SEND_EMAILS ? "EMAILS ACTIFS" : "CONSOLE UNIQUEMENT (pas de GMAIL_APP_PASSWORD)"}`);

  if (process.argv.includes("--schema")) {
    await dumpSchema();
    await pool.end();
    return;
  }

  console.log("\n--- Checks anomalies ---");
  await checkBookings();
  await checkFinance();
  await checkTrips();
  await checkFuel();
  await checkCelia();

  console.log("\n--- Listes de taches ---");
  await checkElyesGYG();
  await checkImedActivities();

  console.log(`\n--- Resultats: ${findings.length} anomalie(s), ${Object.keys(taskLists).length} liste(s) de taches ---`);
  if (findings.length === 0) {
    console.log("  Aucune anomalie.");
  } else {
    for (const f of findings) {
      console.log(`  [${f.level}] ${f.person.toUpperCase()}: ${f.message}`);
    }
  }
  for (const [person, lists] of Object.entries(taskLists)) {
    for (const t of lists) {
      console.log(`  [TACHES] ${person.toUpperCase()}: ${t.title} (${t.items.length} items)`);
    }
  }

  await sendEmails();

  await pool.end();
  console.log("\nTermine.");
}

main().catch(async (e) => {
  console.error("ERREUR FATALE:", e.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','employee1','employee2')),
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 0,
  default_currency TEXT NOT NULL DEFAULT 'EUR' CHECK(default_currency IN ('TND','EUR','USD')),
  contact_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('restaurant','camp','transport','guide','activity','other')),
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tva_number TEXT,
  rib TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS excursions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost_meal_pp REAL DEFAULT 0,
  cost_accommodation_pp REAL DEFAULT 0,
  cost_extras_pp REAL DEFAULT 0,
  cost_activity_pp REAL DEFAULT 0,
  cost_child_pp REAL DEFAULT 0,
  child_age_max INTEGER DEFAULT 12,
  cost_guide_shared REAL DEFAULT 0,
  cost_transport_shared REAL DEFAULT 0,
  cost_camp_shared REAL DEFAULT 0,
  cost_other_shared REAL DEFAULT 0,
  min_pax INTEGER DEFAULT 1,
  max_pax INTEGER DEFAULT 20,
  duration_days INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  vehicle_type TEXT,
  is_available INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  languages TEXT,
  specialties TEXT,
  is_available INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_received TEXT NOT NULL DEFAULT (date('now')),
  excursion_id INTEGER REFERENCES excursions(id),
  ota_id INTEGER REFERENCES otas(id),
  ota_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('confirmed','cancelled','modified','pending')),
  excursion_date TEXT,
  pax_adults INTEGER DEFAULT 1,
  pax_children INTEGER DEFAULT 0,
  sale_price REAL DEFAULT 0,
  sale_currency TEXT DEFAULT 'EUR' CHECK(sale_currency IN ('TND','EUR','USD')),
  commission_pct REAL DEFAULT 0,
  net_price REAL GENERATED ALWAYS AS (sale_price * (1 - commission_pct/100)) VIRTUAL,
  client_hotel TEXT,
  client_name TEXT,
  pickup_time TEXT,
  phone TEXT,
  remarks TEXT,
  driver_id INTEGER REFERENCES drivers(id),
  guide_id INTEGER REFERENCES guides(id),
  transporter_id INTEGER REFERENCES partners(id),
  workflow_step INTEGER NOT NULL DEFAULT 0 CHECK(workflow_step IN (0,1,2,3)),
  acompte_amount REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','partial','paid')),
  voucher_sent INTEGER DEFAULT 0,
  raw_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'reservation' CHECK(type IN ('reservation','free','rh','supplier')),
  reservation_id INTEGER REFERENCES reservations(id),
  assigned_to INTEGER REFERENCES users(id),
  assigned_by INTEGER REFERENCES users(id),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
  due_date TEXT,
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER REFERENCES reservations(id),
  partner_id INTEGER REFERENCES partners(id),
  service_type TEXT NOT NULL,
  date TEXT,
  amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'TND',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mission_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER UNIQUE REFERENCES reservations(id),
  pdf_path TEXT,
  generated_at TEXT DEFAULT (datetime('now')),
  printed_at TEXT
);

CREATE TABLE IF NOT EXISTS partner_monthly_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER REFERENCES partners(id),
  month TEXT NOT NULL,
  total_ht REAL DEFAULT 0,
  tva_amount REAL DEFAULT 0,
  fiscal_stamp REAL DEFAULT 1,
  total_ttc REAL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid')),
  pdf_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(partner_id, month)
);

CREATE TABLE IF NOT EXISTS partner_sheet_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id INTEGER REFERENCES partner_monthly_sheets(id),
  reservation_id INTEGER REFERENCES reservations(id),
  excursion_name TEXT,
  excursion_date TEXT,
  pax_count INTEGER,
  amount_ht REAL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ota_monthly_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ota_id INTEGER REFERENCES otas(id),
  month TEXT NOT NULL,
  gross_revenue REAL DEFAULT 0,
  commission_amount REAL DEFAULT 0,
  net_revenue REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','received','reconciled')),
  notes TEXT,
  UNIQUE(ota_id, month)
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS crm_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  preferences TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spent_tnd REAL DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(excursion_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_ota ON reservations(ota_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);

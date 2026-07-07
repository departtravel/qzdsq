import dotenv from 'dotenv';
dotenv.config();

import { db, runMigrations } from './database';
import bcrypt from 'bcryptjs';

runMigrations();

function seed() {
  console.log('[Seed] Starting database seeding...');

  // Users
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)`
  );
  const users = [
    { email: 'admin@depart.tn', name: 'Admin', role: 'admin', password: 'admin123' },
    { email: 'emp1@depart.tn', name: 'Employé 1', role: 'employee1', password: 'emp1pass' },
    { email: 'emp2@depart.tn', name: 'Employé 2', role: 'employee2', password: 'emp2pass' },
  ];
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(u.email, u.name, u.role, hash);
  }
  console.log('[Seed] Users created');

  // OTAs
  const insertOta = db.prepare(
    `INSERT OR IGNORE INTO otas (name, commission_pct, default_currency, contact_email) VALUES (?, ?, ?, ?)`
  );
  insertOta.run('GetYourGuide', 20, 'EUR', 'partners@getyourguide.com');
  insertOta.run('Viator', 25, 'USD', 'partners@viator.com');
  insertOta.run('TourRadar', 18, 'EUR', 'partners@tourradar.com');
  insertOta.run('Museement', 20, 'EUR', 'partners@museement.com');
  insertOta.run('Mail Direct', 0, 'TND', null);
  console.log('[Seed] OTAs created');

  // Excursions
  const insertExc = db.prepare(`INSERT OR IGNORE INTO excursions
    (code, name, description, cost_meal_pp, cost_accommodation_pp, cost_extras_pp, cost_activity_pp,
     cost_child_pp, child_age_max, cost_guide_shared, cost_transport_shared, cost_camp_shared,
     cost_other_shared, min_pax, max_pax, duration_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  insertExc.run(
    'EXC001', 'Désert Erg Chebbi', 'Circuit 3 jours dans le désert de l\'Erg Chebbi avec nuit en camp',
    35, 60, 10, 20, 25, 12, 80, 120, 150, 30, 2, 20, 3
  );
  insertExc.run(
    'EXC002', 'Quad Sahara + Camp', 'Excursion quad dans le Sahara avec nuit en camp sous les étoiles',
    20, 45, 5, 40, 20, 12, 60, 80, 100, 20, 1, 15, 1
  );
  insertExc.run(
    'EXC003', 'Visite Médina + Souks', 'Visite guidée de la médina et des souks traditionnels',
    15, 0, 5, 0, 10, 12, 70, 40, 0, 10, 1, 25, 1
  );
  insertExc.run(
    'EXC004', 'Tour des Ksours', 'Circuit 2 jours à la découverte des ksours berbères',
    30, 50, 15, 15, 20, 12, 90, 110, 80, 25, 2, 18, 2
  );
  console.log('[Seed] Excursions created');

  // Partners
  const insertPartner = db.prepare(`INSERT OR IGNORE INTO partners
    (name, type, contact_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  insertPartner.run(
    'Chez Mohammed', 'restaurant', 'Mohammed Ben Ali', '+216 75 123 456',
    'contact@chezmohammed.tn', 'Rue de la Médina, Douz', 'Restaurant traditionnel tunisien, spécialité couscous'
  );
  insertPartner.run(
    'Camp Sahara Dreams', 'camp', 'Fatima Trabelsi', '+216 98 765 432',
    'info@saharadreams.tn', 'Route du Désert KM 5, Douz', 'Camp luxe 20 tentes, piscine, animation soirée'
  );
  insertPartner.run(
    'Transport Sahara', 'transport', 'Karim Mansouri', '+216 22 333 444',
    'transport@sahara.tn', 'Zone Industrielle, Gabès', '4x4 Land Cruiser et minibus disponibles'
  );
  console.log('[Seed] Partners created');

  // Drivers
  const insertDriver = db.prepare(`INSERT OR IGNORE INTO drivers
    (name, phone, license_number, vehicle_type) VALUES (?, ?, ?, ?)`);
  insertDriver.run('Ahmed Chaabane', '+216 55 111 222', 'TN-2018-DRV-001', 'Minibus 20 places');
  insertDriver.run('Bilel Hamdi', '+216 55 333 444', 'TN-2019-DRV-002', '4x4 Land Cruiser');
  console.log('[Seed] Drivers created');

  // Guides
  const insertGuide = db.prepare(`INSERT OR IGNORE INTO guides
    (name, phone, languages, specialties) VALUES (?, ?, ?, ?)`);
  insertGuide.run('Nour Jebali', '+216 55 555 666', 'Arabe, Français, Anglais', 'Désert, Histoire berbère');
  insertGuide.run('Sami Bouazizi', '+216 55 777 888', 'Arabe, Français, Allemand, Italien', 'Médina, Artisanat, Cuisine');
  console.log('[Seed] Guides created');

  // Exchange Rates
  const insertRate = db.prepare(`INSERT OR REPLACE INTO exchange_rates
    (from_currency, to_currency, rate) VALUES (?, ?, ?)`);
  insertRate.run('EUR', 'TND', 3.35);
  insertRate.run('USD', 'TND', 3.10);
  insertRate.run('TND', 'EUR', 1 / 3.35);
  insertRate.run('TND', 'USD', 1 / 3.10);
  insertRate.run('EUR', 'USD', 1.08);
  insertRate.run('USD', 'EUR', 1 / 1.08);
  console.log('[Seed] Exchange rates created');

  // Settings
  const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  insertSetting.run('agency_name', 'DepartTravel');
  insertSetting.run('agency_address', 'Avenue Habib Bourguiba, Tunis 1000, Tunisie');
  insertSetting.run('tva_number', 'TN-12345678-A');
  insertSetting.run('rib', 'TN59 0000 0000 0000 0000 0000');
  insertSetting.run('agency_phone', '+216 71 000 000');
  insertSetting.run('agency_email', 'contact@departtravel.tn');
  insertSetting.run('tva_rate', '19');
  insertSetting.run('fiscal_stamp', '1');
  console.log('[Seed] Settings created');

  console.log('[Seed] Database seeding completed successfully!');
}

seed();
db.close();

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'employee1' | 'employee2';
  password_hash: string;
  created_at: string;
}

export interface Reservation {
  id: number;
  date_received: string;
  excursion_id: number | null;
  ota_id: number | null;
  ota_ref: string | null;
  status: 'confirmed' | 'cancelled' | 'modified' | 'pending';
  excursion_date: string | null;
  pax_adults: number;
  pax_children: number;
  sale_price: number;
  sale_currency: 'TND' | 'EUR' | 'USD';
  commission_pct: number;
  net_price?: number;
  client_hotel: string | null;
  client_name: string | null;
  pickup_time: string | null;
  phone: string | null;
  remarks: string | null;
  driver_id: number | null;
  guide_id: number | null;
  transporter_id: number | null;
  workflow_step: 0 | 1 | 2 | 3;
  acompte_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  voucher_sent: number;
  raw_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Excursion {
  id: number;
  code: string;
  name: string;
  description: string | null;
  cost_meal_pp: number;
  cost_accommodation_pp: number;
  cost_extras_pp: number;
  cost_activity_pp: number;
  cost_child_pp: number;
  child_age_max: number;
  cost_guide_shared: number;
  cost_transport_shared: number;
  cost_camp_shared: number;
  cost_other_shared: number;
  min_pax: number;
  max_pax: number;
  duration_days: number;
  is_active: number;
  created_at?: string;
}

export interface OTA {
  id: number;
  name: string;
  commission_pct: number;
  default_currency: 'TND' | 'EUR' | 'USD';
  contact_email: string | null;
  is_active: number;
}

export interface Partner {
  id: number;
  name: string;
  type: 'restaurant' | 'camp' | 'transport' | 'guide' | 'activity' | 'other';
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tva_number: string | null;
  rib: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  type: 'reservation' | 'free' | 'rh' | 'supplier';
  reservation_id: number | null;
  assigned_to: number | null;
  assigned_by: number | null;
  priority: 'normal' | 'high' | 'urgent';
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierBooking {
  id: number;
  reservation_id: number | null;
  partner_id: number | null;
  service_type: string;
  date: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface MissionOrder {
  id: number;
  reservation_id: number;
  pdf_path: string | null;
  generated_at: string;
  printed_at: string | null;
}

export interface PartnerMonthlySheet {
  id: number;
  partner_id: number;
  month: string;
  total_ht: number;
  tva_amount: number;
  fiscal_stamp: number;
  total_ttc: number;
  status: 'draft' | 'sent' | 'paid';
  pdf_path: string | null;
  created_at: string;
}

export interface OtaMonthlySheet {
  id: number;
  ota_id: number;
  month: string;
  gross_revenue: number;
  commission_amount: number;
  net_revenue: number;
  currency: string;
  payment_status: 'pending' | 'received' | 'reconciled';
  notes: string | null;
}

export interface AgentLog {
  id: number;
  agent_type: string;
  input_summary: string | null;
  output_summary: string | null;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'admin' | 'employee1' | 'employee2';
  iat?: number;
  exp?: number;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export interface CrmClient {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  preferences: string | null;
  total_bookings: number;
  total_spent_tnd: number;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
}

export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  license_number: string | null;
  vehicle_type: string | null;
  is_available: number;
  is_active: number;
}

export interface Guide {
  id: number;
  name: string;
  phone: string | null;
  languages: string | null;
  specialties: string | null;
  is_available: number;
  is_active: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

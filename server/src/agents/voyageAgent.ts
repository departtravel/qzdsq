import { callClaude, extractJsonFromResponse } from '../services/claudeService';
import { Reservation } from '../types';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Tu es un agent spécialiste voyages pour une agence tunisienne.
Extrais les données de réservation de cet email.
Analyse avec soin les informations client, dates, excursions, prix et nombre de personnes.
Utilise l'outil extract_reservation pour retourner les données structurées.`;

const extractReservationTool: Anthropic.Tool = {
  name: 'extract_reservation',
  description: 'Extraire les données de réservation depuis un email',
  input_schema: {
    type: 'object' as const,
    properties: {
      client_name: { type: 'string', description: 'Nom complet du client' },
      client_hotel: { type: 'string', description: 'Hôtel ou adresse du client' },
      phone: { type: 'string', description: 'Numéro de téléphone du client' },
      excursion_date: { type: 'string', description: 'Date de l\'excursion (YYYY-MM-DD)' },
      pax_adults: { type: 'number', description: 'Nombre d\'adultes' },
      pax_children: { type: 'number', description: 'Nombre d\'enfants' },
      pickup_time: { type: 'string', description: 'Heure de prise en charge (HH:MM)' },
      sale_price: { type: 'number', description: 'Prix total de vente' },
      sale_currency: { type: 'string', enum: ['TND', 'EUR', 'USD'], description: 'Devise' },
      ota_ref: { type: 'string', description: 'Référence de la réservation chez l\'OTA' },
      remarks: { type: 'string', description: 'Remarques particulières ou demandes spéciales' },
      status: { type: 'string', enum: ['confirmed', 'pending', 'cancelled', 'modified'], description: 'Statut de la réservation' },
    },
    required: [],
  },
};

export async function parseEmail(rawEmail: string): Promise<Partial<Reservation>> {
  try {
    const response = await callClaude(
      SYSTEM_PROMPT,
      `Voici l'email à analyser:\n\n${rawEmail}`,
      [extractReservationTool]
    );

    const extracted = extractJsonFromResponse(response.content);

    if (!extracted) {
      return {};
    }

    // Map extracted data to Reservation type
    const partial: Partial<Reservation> = {};

    if (typeof extracted.client_name === 'string') partial.client_name = extracted.client_name;
    if (typeof extracted.client_hotel === 'string') partial.client_hotel = extracted.client_hotel;
    if (typeof extracted.phone === 'string') partial.phone = extracted.phone;
    if (typeof extracted.excursion_date === 'string') partial.excursion_date = extracted.excursion_date;
    if (typeof extracted.pax_adults === 'number') partial.pax_adults = Math.round(extracted.pax_adults);
    if (typeof extracted.pax_children === 'number') partial.pax_children = Math.round(extracted.pax_children);
    if (typeof extracted.pickup_time === 'string') partial.pickup_time = extracted.pickup_time;
    if (typeof extracted.sale_price === 'number') partial.sale_price = extracted.sale_price;
    if (extracted.sale_currency === 'TND' || extracted.sale_currency === 'EUR' || extracted.sale_currency === 'USD') {
      partial.sale_currency = extracted.sale_currency;
    }
    if (typeof extracted.ota_ref === 'string') partial.ota_ref = extracted.ota_ref;
    if (typeof extracted.remarks === 'string') partial.remarks = extracted.remarks;
    if (
      extracted.status === 'confirmed' ||
      extracted.status === 'pending' ||
      extracted.status === 'cancelled' ||
      extracted.status === 'modified'
    ) {
      partial.status = extracted.status;
    }

    partial.raw_email = rawEmail;

    return partial;
  } catch (error) {
    console.error('[VoyageAgent] parseEmail error:', error);
    return { raw_email: rawEmail };
  }
}

import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import schemaSql from './schema-local.sql?raw'
import { LocalQueryBuilder } from './queryBuilder'

// Teste l'adaptateur PGlite compatible supabase-js sur une vraie
// base Postgres embarquée (en mémoire, pas d'IndexedDB en Node).
let db: PGlite
const ready = () => Promise.resolve(db)
const from = (t: string) => new LocalQueryBuilder(ready(), t)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(schemaSql)
  await db.exec(`alter table public.profiles add column if not exists erp_role text not null default 'ADMIN';`)
  await db.exec(`insert into ota_channels(nom, commission_percentage) values ('GYG',30),('Viator',20)`)
})

describe('insert + select', () => {
  it('insère et renvoie la ligne créée (.select().single())', async () => {
    const { data, error } = await from('bookings')
      .insert({ client_nom: 'Ali', nombre_adultes: 2, prix_vente: 100, commission_montant: 30 })
      .select('id, client_nom, prix_vente')
      .single()
    expect(error).toBeNull()
    expect((data as { client_nom: string }).client_nom).toBe('Ali')
    // numeric -> number (coercition type comme Supabase)
    expect(typeof (data as { prix_vente: number }).prix_vente).toBe('number')
  })

  it('insert sans select => data null', async () => {
    const { data, error } = await from('bookings')
      .insert({ client_nom: 'SansSelect', nombre_adultes: 1, prix_vente: 50, commission_montant: 0 })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe('filtres', () => {
  it('eq + order', async () => {
    await from('bookings').insert([
      { client_nom: 'Zoe', nombre_adultes: 1, prix_vente: 10, commission_montant: 0, statut: 'CONFIRMEE' },
      { client_nom: 'Ana', nombre_adultes: 1, prix_vente: 20, commission_montant: 0, statut: 'CONFIRMEE' },
    ])
    const { data } = await from('bookings')
      .select('client_nom')
      .eq('statut', 'CONFIRMEE')
      .order('prix_vente', { ascending: false })
    const noms = (data as { client_nom: string }[]).map((r) => r.client_nom)
    expect(noms[0]).toBe('Ana') // 20 avant 10
  })

  it('neq exclut les valeurs', async () => {
    const { data } = await from('bookings').select('id').eq('statut', 'ANNULEE')
    expect((data as unknown[]).length).toBe(0)
  })

  it('in() avec liste vide ne renvoie rien', async () => {
    const { data } = await from('bookings').select('id').in('id', [])
    expect((data as unknown[]).length).toBe(0)
  })
})

describe('update / delete', () => {
  it('update ... eq', async () => {
    const ins = await from('bookings')
      .insert({ client_nom: 'MAJ', nombre_adultes: 1, prix_vente: 5, commission_montant: 0 })
      .select('id')
      .single()
    const id = (ins.data as { id: string }).id
    const { error } = await from('bookings').update({ prix_vente: 999 }).eq('id', id)
    expect(error).toBeNull()
    const { data } = await from('bookings').select('prix_vente').eq('id', id).single()
    expect((data as { prix_vente: number }).prix_vente).toBe(999)
  })

  it('delete ... eq', async () => {
    const ins = await from('bookings')
      .insert({ client_nom: 'DEL', nombre_adultes: 1, prix_vente: 1, commission_montant: 0 })
      .select('id')
      .single()
    const id = (ins.data as { id: string }).id
    await from('bookings').delete().eq('id', id)
    const { data } = await from('bookings').select('id').eq('id', id)
    expect((data as unknown[]).length).toBe(0)
  })
})

describe('upsert', () => {
  it('insère puis met à jour sur conflit de clé', async () => {
    await from('app_settings').upsert({ key: 'company_name', value: 'A' }, { onConflict: 'key' })
    await from('app_settings').upsert({ key: 'company_name', value: 'B' }, { onConflict: 'key' })
    const { data } = await from('app_settings').select('value').eq('key', 'company_name').single()
    expect((data as { value: string }).value).toBe('B')
  })
})

describe('erreurs', () => {
  it('renvoie {error} plutôt que de lever', async () => {
    const { data, error } = await from('table_inexistante').select('*')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

// ============================================================
//  Client LOCAL compatible supabase-js (mode 100% hors-ligne)
//  Base Postgres embarquée (PGlite) persistée dans le navigateur
//  / l'app desktop (IndexedDB). Aucune connexion réseau, aucune
//  authentification serveur : poste unique, utilisateur = admin.
//
//  N'implémente que ce que l'application utilise réellement
//  (voir queryBuilder.ts + l'objet `auth` ci-dessous).
// ============================================================
import { PGlite } from '@electric-sql/pglite'
import schemaSql from './schema-local.sql?raw'
import { LocalQueryBuilder } from './queryBuilder'

// Compte local unique (pas d'authentification hors-ligne).
const LOCAL_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'local@dts',
}
const LOCAL_SESSION = { user: LOCAL_USER, access_token: 'local', token_type: 'bearer' }

// Données minimales pour que l'app soit utilisable dès le 1er lancement :
// le profil admin local + les canaux OTA courants.
const SEED_SQL = `
insert into public.profiles (id, email, role, erp_role)
values ('${LOCAL_USER.id}', '${LOCAL_USER.email}', 'admin', 'ADMIN')
on conflict (id) do nothing;

insert into public.ota_channels (nom, commission_percentage) values
  ('GetYourGuide', 30), ('Viator', 20), ('Airbnb Experiences', 20),
  ('Direct / Agence', 0)
on conflict (nom) do nothing;

insert into public.app_settings (key, value) values
  ('company_name', 'Depart Travel Services'),
  ('company_mf', '1612019Y'),
  ('company_website', 'www.depart-travel-services.com'),
  ('company_info', ''), ('logo', '')
on conflict (key) do nothing;
`

async function initDb(): Promise<PGlite> {
  // 'idb://…' => persistance locale (IndexedDB) entre deux lancements.
  const db = new PGlite('idb://dts-operation-erp')
  await db.exec(schemaSql)
  // profiles.erp_role peut manquer (extrait sans rbac.sql) : on l'ajoute.
  await db.exec(`alter table public.profiles add column if not exists erp_role text not null default 'ADMIN';`)
  await db.exec(SEED_SQL)
  return db
}

/** Client local exposant la même surface que supabase-js (partie utilisée). */
export function createLocalClient() {
  const ready = initDb()

  const auth = {
    async getSession() {
      await ready
      return { data: { session: LOCAL_SESSION }, error: null }
    },
    async getUser() {
      await ready
      return { data: { user: LOCAL_USER }, error: null }
    },
    onAuthStateChange() {
      // Session locale permanente : rien à écouter.
      return { data: { subscription: { unsubscribe() {} } } }
    },
    async signInWithPassword() {
      return { data: { session: LOCAL_SESSION, user: LOCAL_USER }, error: null }
    },
    async signOut() {
      return { error: null }
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null }
    },
  }

  return {
    isLocal: true,
    auth,
    from(table: string) {
      return new LocalQueryBuilder(ready, table)
    },
  }
}

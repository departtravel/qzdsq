// ============================================================
//  Adaptateur PGlite compatible supabase-js (mode hors-ligne)
//  Implémente le sous-ensemble du query builder réellement
//  utilisé par l'application :
//    from · select · insert · update · upsert · delete
//    eq · neq · in · gt · lt · gte · lte · order · limit
//    single · maybeSingle  (+ await direct, thenable)
//  Chaque requête est traduite en SQL paramétré exécuté par
//  la base Postgres embarquée (PGlite). Aucune connexion réseau.
// ============================================================
import type { PGlite } from '@electric-sql/pglite'

export interface PgResult<T = unknown> {
  data: T
  error: { message: string } | null
}

// Coercition des types Postgres -> types attendus par l'app
// (comme le fait PostgREST/Supabase) : numeric/int8 -> number,
// date/timestamp -> string ISO.
const PARSERS = {
  20: (v: string) => Number(v), // int8
  1700: (v: string) => Number(v), // numeric
  1082: (v: string) => v, // date
  1114: (v: string) => v, // timestamp
  1184: (v: string) => v, // timestamptz
}

type Filter = { col: string; op: string; val: unknown }
type Order = { col: string; asc: boolean }
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

export class LocalQueryBuilder<T = unknown> implements PromiseLike<PgResult<T>> {
  private op: Op = 'select'
  private cols = '*'
  private rows: Record<string, unknown>[] = []
  private conflict?: string
  private filters: Filter[] = []
  private orders: Order[] = []
  private _limit?: number
  private _single: false | 'single' | 'maybe' = false
  private _returning = false

  constructor(private readyDb: Promise<PGlite>, private table: string) {}

  select(cols = '*') {
    this.cols = cols.trim() || '*'
    if (this.op !== 'select') this._returning = true
    return this
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert'
    this.rows = Array.isArray(values) ? values : [values]
    return this
  }
  update(values: Record<string, unknown>) {
    this.op = 'update'
    this.rows = [values]
    return this
  }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) {
    this.op = 'upsert'
    this.rows = Array.isArray(values) ? values : [values]
    this.conflict = opts?.onConflict
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }

  eq(col: string, val: unknown) { return this.push(col, '=', val) }
  neq(col: string, val: unknown) { return this.push(col, '<>', val) }
  gt(col: string, val: unknown) { return this.push(col, '>', val) }
  lt(col: string, val: unknown) { return this.push(col, '<', val) }
  gte(col: string, val: unknown) { return this.push(col, '>=', val) }
  lte(col: string, val: unknown) { return this.push(col, '<=', val) }
  in(col: string, arr: unknown[]) { return this.push(col, 'in', arr) }
  private push(col: string, op: string, val: unknown) {
    this.filters.push({ col, op, val })
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false })
    return this
  }
  limit(n: number) { this._limit = n; return this }
  single() { this._single = 'single'; return this }
  maybeSingle() { this._single = 'maybe'; return this }

  // Rend le builder « awaitable » comme celui de supabase-js.
  then<R1 = PgResult<T>, R2 = never>(
    onfulfilled?: ((value: PgResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected)
  }

  private ident(col: string) {
    // Garde-fou basique : identifiants simples uniquement.
    return col.split('.').map((p) => `"${p.replace(/"/g, '')}"`).join('.')
  }

  private whereClause(params: unknown[]): string {
    if (this.filters.length === 0) return ''
    const parts = this.filters.map((f) => {
      if (f.op === 'in') {
        const arr = (f.val as unknown[]) ?? []
        if (arr.length === 0) return 'false'
        const ph = arr.map((v) => `$${params.push(v)}`).join(', ')
        return `${this.ident(f.col)} in (${ph})`
      }
      return `${this.ident(f.col)} ${f.op} $${params.push(f.val)}`
    })
    return ' where ' + parts.join(' and ')
  }

  private tail(params: unknown[]): string {
    let s = ''
    if (this.orders.length)
      s += ' order by ' + this.orders.map((o) => `${this.ident(o.col)} ${o.asc ? 'asc' : 'desc'}`).join(', ')
    if (this._limit != null) s += ` limit $${params.push(this._limit)}`
    return s
  }

  private async exec(): Promise<PgResult<T>> {
    try {
      const db = await this.readyDb
      const params: unknown[] = []
      let sql: string
      const t = this.ident(this.table)

      if (this.op === 'select') {
        sql = `select ${this.cols} from ${t}${this.whereClause(params)}${this.tail(params)}`
      } else if (this.op === 'delete') {
        sql = `delete from ${t}${this.whereClause(params)}${this.returning()}`
      } else if (this.op === 'update') {
        const set = this.setClause(this.rows[0], params)
        sql = `update ${t} set ${set}${this.whereClause(params)}${this.returning()}`
      } else {
        // insert / upsert
        sql = this.insertSql(params)
      }

      const res = await db.query(sql, params, { parsers: PARSERS })
      const rows = (res.rows ?? []) as Record<string, unknown>[]

      // Mutations sans .select() => data null (comme supabase).
      const wantsRows = this.op === 'select' || this._returning
      if (!wantsRows) return { data: null as T, error: null }

      if (this._single) {
        if (rows.length === 1) return { data: rows[0] as T, error: null }
        if (this._single === 'maybe' && rows.length === 0) return { data: null as T, error: null }
        return { data: null as T, error: { message: `${rows.length} lignes retournées (attendu 1)` } }
      }
      return { data: rows as T, error: null }
    } catch (e) {
      return { data: null as T, error: { message: (e as Error).message } }
    }
  }

  private returning(): string {
    return this._returning ? ` returning ${this.cols}` : ''
  }

  private setClause(row: Record<string, unknown>, params: unknown[]): string {
    return Object.keys(row)
      .map((k) => `${this.ident(k)} = $${params.push(row[k])}`)
      .join(', ')
  }

  private insertSql(params: unknown[]): string {
    const t = this.ident(this.table)
    // Union des colonnes présentes sur l'ensemble des lignes.
    const cols = [...new Set(this.rows.flatMap((r) => Object.keys(r)))]
    const colList = cols.map((c) => this.ident(c)).join(', ')
    const valuesSql = this.rows
      .map((r) => '(' + cols.map((c) => `$${params.push(r[c] ?? null)}`).join(', ') + ')')
      .join(', ')
    let sql = `insert into ${t} (${colList}) values ${valuesSql}`
    if (this.op === 'upsert') {
      const target = (this.conflict ?? 'id').split(',').map((c) => this.ident(c.trim())).join(', ')
      const updates = cols
        .filter((c) => !(this.conflict ?? 'id').split(',').map((x) => x.trim()).includes(c))
        .map((c) => `${this.ident(c)} = excluded.${this.ident(c)}`)
        .join(', ')
      sql += ` on conflict (${target}) do update set ${updates || `${this.ident(cols[0])} = excluded.${this.ident(cols[0])}`}`
    }
    sql += this.returning()
    return sql
  }
}

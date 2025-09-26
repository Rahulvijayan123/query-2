type Row = Record<string, any>
type Table = Row[]

function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : ((r&0x3)|0x8)
    return v.toString(16)
  })
}

class Query {
  private table: Table
  private tableName: string
  private store: Record<string, Table>
  private rows: Row[] | null = null
  private filters: { col: string; val: any }[] = []
  private orderBy: { col: string; ascending: boolean } | null = null

  constructor(name: string, store: Record<string, Table>) {
    this.tableName = name
    this.store = store
    this.table = store[name] ?? (store[name] = [])
  }

  insert(values: Row | Row[]) {
    const arr = Array.isArray(values) ? values : [values]
    const inserted = arr.map(v => {
      const copy = { ...v }
      if (!copy.id) copy.id = genId()
      this.table.push(copy)
      return copy
    })
    this.rows = inserted
    return this
  }

  upsert(values: Row | Row[]) {
    const arr = Array.isArray(values) ? values : [values]
    const upserted = arr.map(v => {
      if (!v.id) {
        if (this.tableName === 'clarification_answers') {
          const idx = this.table.findIndex(r => r.session_id === v.session_id && r.question_id === v.question_id)
          if (idx >= 0) {
            this.table[idx] = { ...this.table[idx], ...v }
            return this.table[idx]
          }
        }
        v.id = genId()
      }
      const idx = this.table.findIndex(r => r.id === v.id)
      if (idx >= 0) {
        this.table[idx] = { ...this.table[idx], ...v }
        return this.table[idx]
      }
      this.table.push(v)
      return v
    })
    this.rows = upserted
    return this
  }

  update(patch: Row) {
    const filtered = this._applyFilters()
    for (const r of filtered) Object.assign(r, patch)
    this.rows = filtered
    return this
  }

  select(_cols = '*') {
    const filtered = this._applyFilters()
    let out = filtered
    if (this.orderBy) {
      const { col, ascending } = this.orderBy
      out = [...out].sort((a, b) => (a[col] < b[col] ? (ascending ? -1 : 1) : a[col] > b[col] ? (ascending ? 1 : -1) : 0))
    }
    this.rows = out
    return this
  }

  limit(_n: number) {
    // No-op for fake
    return this
  }

  eq(col: string, val: any) {
    this.filters.push({ col, val })
    return this
  }

  order(col: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderBy = { col, ascending }
    return this
  }

  single() {
    const row = (this.rows ?? [])[0] ?? null
    return { data: row, error: row ? null : null }
  }

  then(resolve: any) {
    return resolve({ data: this.rows ?? [], error: null })
  }

  private _applyFilters() {
    return (this.rows ?? this.table).filter(r =>
      this.filters.every(f => r[f.col] === f.val)
    )
  }
}

export class FakeSupabase {
  public store: Record<string, Table> = {
    clarification_sessions: [],
    clarification_questions: [],
    clarification_answers: [],
    clarification_events: [],
  }

  from(name: string) {
    return new Query(name, this.store)
  }
}

export function makeFakeSupabase() {
  return new FakeSupabase()
}



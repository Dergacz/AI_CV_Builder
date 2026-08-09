import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

/**
 * In-memory stand-in for the Supabase client, covering exactly the query chains
 * `src/lib/services/cv-repository.ts` uses. It lets the real repository functions run
 * against seeded rows so owner scoping can be asserted without Docker or a live DB.
 *
 * What it proves: the app-layer `.eq("user_id", …)` filters (defense-in-depth).
 * What it does NOT prove: the database RLS policies themselves — those are enforced by
 * `supabase/migrations/20260606103740_create_cvs.sql` and verified manually with two
 * accounts (see `context/foundation/test-plan.md`).
 *
 * Deliberately simple: filters are equality-only, and `select(columns)` returns whole
 * rows rather than projecting, since every caller reads a subset of real columns.
 */

export type CvRow = Database["public"]["Tables"]["cvs"]["Row"];
type CvInsert = Database["public"]["Tables"]["cvs"]["Insert"];
type CvUpdate = Database["public"]["Tables"]["cvs"]["Update"];

type Operation = "select" | "insert" | "update" | "delete";

interface Filter {
  column: keyof CvRow;
  value: unknown;
}

interface QueryResult {
  data: CvRow[] | CvRow | null;
  error: { message: string } | null;
}

/** `postgrest-js` builders are thenable, so `await`ing one without a terminal method works. */
class FakeQueryBuilder implements PromiseLike<QueryResult> {
  private readonly filters: Filter[] = [];
  // Not named `order` — an instance field would shadow the `order()` method below.
  private ordering: { column: keyof CvRow; ascending: boolean } | null = null;

  constructor(
    private readonly rows: CvRow[],
    private readonly operation: Operation,
    private readonly payload?: CvInsert | CvUpdate,
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column: column as keyof CvRow, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.ordering = { column: column as keyof CvRow, ascending: options?.ascending ?? true };
    return this;
  }

  maybeSingle(): Promise<{ data: CvRow | null; error: { message: string } | null }> {
    const matched = this.run();
    if (matched.length > 1) {
      return Promise.resolve({ data: null, error: { message: "multiple rows returned" } });
    }
    return Promise.resolve({ data: matched[0] ?? null, error: null });
  }

  single(): Promise<{ data: CvRow | null; error: { message: string } | null }> {
    const matched = this.run();
    if (matched.length !== 1) {
      return Promise.resolve({ data: null, error: { message: "expected exactly one row" } });
    }
    return Promise.resolve({ data: matched[0], error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve<QueryResult>({ data: this.run(), error: null }).then(onfulfilled, onrejected);
  }

  private matches(row: CvRow): boolean {
    return this.filters.every((filter) => row[filter.column] === filter.value);
  }

  /** Apply the operation to the backing array and return the affected rows. */
  private run(): CvRow[] {
    if (this.operation === "insert") {
      const insert = this.payload as CvInsert;
      const now = new Date().toISOString();
      const inserted: CvRow = {
        id: insert.id ?? `generated-${String(this.rows.length + 1)}`,
        user_id: insert.user_id,
        title: insert.title,
        language: insert.language,
        draft: insert.draft,
        source_snapshot: insert.source_snapshot,
        created_at: insert.created_at ?? now,
        updated_at: insert.updated_at ?? now,
      };
      this.rows.push(inserted);
      return [inserted];
    }

    const matched = this.rows.filter((row) => this.matches(row));

    if (this.operation === "update") {
      const patch = this.payload as CvUpdate;
      // The DB trigger `cvs_set_updated_at` bumps updated_at; mirror that here.
      const bumped = new Date().toISOString();
      for (const row of matched) {
        Object.assign(row, patch, { updated_at: bumped });
      }
      return matched;
    }

    if (this.operation === "delete") {
      for (const row of matched) {
        this.rows.splice(this.rows.indexOf(row), 1);
      }
      return matched;
    }

    if (this.ordering) {
      const { column, ascending } = this.ordering;
      matched.sort((a, b) => {
        const left = a[column];
        const right = b[column];
        // Only the text columns (timestamps, title) are ever ordered on.
        if (typeof left !== "string" || typeof right !== "string") {
          return 0;
        }
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    return matched;
  }
}

export interface FakeSupabase {
  /** Cast to the typed client the repository expects; structurally it only needs `.from()`. */
  client: SupabaseClient<Database>;
  /** Live backing store — assert on it to catch writes that should never have happened. */
  rows: CvRow[];
}

export function createFakeSupabase(seed: CvRow[]): FakeSupabase {
  const rows = seed.map((row) => ({ ...row }));
  const client = {
    from: (_table: "cvs") => ({
      select: () => new FakeQueryBuilder(rows, "select"),
      insert: (payload: CvInsert) => new FakeQueryBuilder(rows, "insert", payload),
      update: (payload: CvUpdate) => new FakeQueryBuilder(rows, "update", payload),
      delete: () => new FakeQueryBuilder(rows, "delete"),
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, rows };
}

// Conexión a PostgreSQL 16 (controlador pg) y ayudas para transacciones.
// RNF-03: las operaciones que cambian agenda, cupos o estados se hacen dentro de una transacción.
import { Pool, PoolClient, types } from "pg";

// NUMERIC (1700) y BIGINT (20) se devuelven como número de JavaScript.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => Number(v));

const g = globalThis as unknown as { __bsPool?: Pool };

function nuevoPool(): Pool {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
  // Una base de datos en la nube puede cerrar conexiones en reposo; sin este aviso el error detendría el servidor.
  p.on("error", (e) => console.error("Conexión a la base de datos cerrada:", e.message));
  return p;
}

export const pool: Pool = g.__bsPool ?? (g.__bsPool = nuevoPool());

export type Db = Pool | PoolClient;

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

export async function q1<T = Record<string, unknown>>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const r = await db.query(sql, params);
  return (r.rows[0] as T) ?? null;
}

/** Ejecuta fn dentro de BEGIN/COMMIT; ante cualquier error hace ROLLBACK. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

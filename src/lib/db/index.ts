import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

let cached: NodePgDatabase<typeof schema> | null = null;

export function db() {
  if (!cached) {
    const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
    cached = drizzle(pool, { schema });
  }
  return cached;
}

export { schema };

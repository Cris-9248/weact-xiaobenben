import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * The database connection.
 *
 * This module owns two things and nothing else: turning `DATABASE_URL` into a
 * live connection pool, and making sure exactly one pool exists per process.
 * Query and authorization logic belongs in the data access layer above it —
 * this file should never learn what a user is allowed to see.
 */

// `server-only` is a compile-time guard, not a runtime one. It resolves to an
// empty module under React's `react-server` condition and to a module that
// throws otherwise, so importing this file from a Client Component fails the
// build outright rather than shipping a connection string to the browser.
// Nothing below this line is ever bundled for the client.

/**
 * Read a required environment variable, failing loudly here rather than letting
 * `undefined` travel into the driver and resurface later as a confusing
 * connection error. Returning the value also narrows it to `string` for callers
 * — a module-level `if (!url)` check would not, since TypeScript cannot carry
 * that narrowing into the closure that actually uses it.
 */
function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

const url = requireEnv(
  "DATABASE_URL",
  "Copy .env.example to .env.local — and when running on the host, the host " +
    "must be `localhost`, not `db`.",
);

export type Db = ReturnType<typeof createDb>;

/**
 * 事务句柄。`db.transaction(async (tx) => …)` 里那个 `tx` 的类型。
 *
 * 用 `Parameters<…>` 推导而不是从 drizzle 里 import `PgTransaction`：那个类型带
 * 一长串泛型参数，写死就等于把驱动换掉时要改的地方从一处变成若干处。这里只关心
 * 「和 db 说同一套查询语言、但没有 `transaction` 方法」这一件事。
 */
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

function createDb() {
  const client = postgres(url, {
    // Pool size. postgres.js already defaults to 10; stated explicitly because
    // this is the number that decides whether the app runs out of connections.
    // Postgres accepts 100 by default, shared across every pool — so with more
    // than one app instance, `instances × max` has to stay well under that.
    max: 10,
  });

  return drizzle(client, {
    schema,

    // Load-bearing, and the easiest thing here to get wrong: this option also
    // appears in drizzle.config.ts, and the two are independent. That one tells
    // drizzle-kit how to name columns when it writes migration SQL; this one
    // tells the ORM how to name them when it builds queries. Set it in only one
    // place and they disagree — the migration creates `avatar_url` while every
    // query asks for `avatarUrl`, and nothing works.
    casing: "snake_case",
  });
}

// In development the module graph is re-evaluated on every hot reload, and each
// evaluation would otherwise open a fresh pool — edit a file twenty times and
// Postgres starts refusing connections. Parking the instance on `globalThis`
// means reloads reuse the pool that is already open.
//
// Guarded to non-production because there it would be pointless: a production
// server evaluates this module once per process, so the cache is never hit and
// the entry only keeps a reference alive.
const globalForDb = globalThis as unknown as { __weactDb?: Db };

export const db: Db = globalForDb.__weactDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__weactDb = db;
}

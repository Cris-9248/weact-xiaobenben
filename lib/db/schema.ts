/**
 * Database schema — the source of truth for table structure.
 *
 * `drizzle-kit generate` diffs this file against the migrations in ./drizzle
 * and writes the SQL; `drizzle-kit migrate` applies it. Nothing here runs at
 * request time.
 *
 * Naming: fields are camelCase (`avatarUrl`), the columns they map to are
 * snake_case (`avatar_url`), because drizzle.config.ts sets
 * `casing: "snake_case"`. That option must ALSO be passed to the runtime
 * `drizzle()` call in lib/db/index.ts — with it set in only one of the two
 * places, the ORM builds queries against column names that do not exist.
 */

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Accounts. `phone` is the login identity, so its uniqueness is enforced by
 * the database: an application-level "is this taken?" check would race two
 * simultaneous signups and let both through.
 */
export const users = pgTable("users", {
  /**
   * UUID rather than a serial integer. Ids appear in URLs and share links, and
   * a counter would leak how many accounts exist and the order they were
   * created in. `gen_random_uuid()` is built into Postgres 13+.
   */
  id: uuid().primaryKey().defaultRandom(),

  /** E.164-ish, normalized: `13800138000`. */
  phone: text().notNull().unique(),

  nickname: text().notNull(),

  avatarUrl: text(),

  /**
   * Null until the user completes the set-password step after auto-signup.
   * A timestamp rather than a boolean: the *moment* is what you need in order
   * to invalidate sessions issued before a password change.
   *
   * No password column yet, deliberately — `User` in lib/types.ts is the
   * public view of an account, and password storage belongs to whatever auth
   * design lands. When it does, the column is `passwordHash`, never the
   * password itself.
   */
  passwordSetAt: timestamp({ withTimezone: true }),

  /**
   * `withTimezone: true` is not optional. A bare `timestamp` stores wall-clock
   * with no offset, so the same instant written from two machines becomes
   * indistinguishable — and this app's data is timezone-aware throughout.
   */
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** `$onUpdate` fires for writes made through Drizzle; raw SQL bypasses it. */
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * A row as read back from the database. Named `…Row` to avoid colliding with
 * the `User` view type in lib/types.ts — related, but not the same thing: the
 * row carries fields the UI never shows.
 */
export type UserRow = typeof users.$inferSelect;
/** Insert shape: `id` and the timestamps may be omitted, the database fills them. */
export type NewUserRow = typeof users.$inferInsert;

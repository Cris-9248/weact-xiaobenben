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

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

  /**
   * Nullable, and deliberately so. Signing in with an unrecognised phone
   * number *creates* the account right there — phone and password arrive in
   * the same request — and the nickname is collected on the screen after it.
   * So there is a real window in which a row exists without one, and the
   * column has to admit that rather than invent a placeholder to satisfy
   * `notNull`. Application code reads a null nickname as "registration not
   * finished" — the row is real and signable, the account just has no name on
   * it yet. Nothing writes or clears it today; the Server Actions that close
   * that window are still to be built.
   */
  nickname: text(),

  avatarUrl: text(),

  /**
   * `scrypt:N:r:p:salt:hash`. The cost parameters travel inside the string, so
   * raising them later only affects passwords set after the change — every
   * existing hash stays verifiable. Never the password itself.
   */
  passwordHash: text().notNull(),

  /**
   * When the password was last set or changed. A timestamp rather than a
   * boolean because the *moment* is the useful part: sessions issued before it
   * can be treated as stale and revoked.
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
 * Login sessions. One row per signed-in device, so signing out of one does not
 * sign out the others, and "revoke everything" is a single delete by `userId`.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),

    /**
     * `cascade` matters: deleting an account must take its sessions with it.
     * Without it the delete fails on the foreign key, and the rows that
     * survive would be live credentials for a user that no longer exists.
     */
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * SHA-256 of the cookie value, hex-encoded. The cookie itself holds a
     * 256-bit random token; this column is what a database leak actually
     * exposes, and it is not usable as a credential.
     *
     * Plain SHA-256 rather than scrypt is deliberate. A password needs a slow
     * KDF because it is low-entropy and guessable; this token is 256 random
     * bits, so there is nothing to slow an attacker down to. And unlike a
     * password, this lookup runs on *every* authenticated request — putting a
     * KDF here would be a self-inflicted denial of service.
     */
    tokenHash: text().notNull().unique(),

    expiresAt: timestamp({ withTimezone: true }).notNull(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Array form: Drizzle 0.45 deprecated the object form of this callback.
  // Indexed for "revoke every session belonging to this user", which is what a
  // password change and an account deletion both need.
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/**
 * A row as read back from the database. Named `…Row` to avoid colliding with
 * the `User` view type in lib/types.ts — related, but not the same thing: the
 * row carries fields the UI never shows, and `passwordHash` must never cross
 * into the view type.
 */
export type UserRow = typeof users.$inferSelect;
/** Insert shape: `id` and the timestamps may be omitted, the database fills them. */
export type NewUserRow = typeof users.$inferInsert;

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI, not a Next.js process, so none of Next's env
// loading applies here. It bundles dotenv but only reads `.env`; this project
// keeps its values in `.env.local` (the file Next loads), so read that too.
//
// `loadEnvFile` never overrides a variable that is already set, so the first
// file to define a key wins while a real shell variable or a Docker-supplied
// value takes precedence over both files. Paths are cwd-relative, matching how
// `schema` and `out` below are resolved — run drizzle-kit from the repo root.
for (const file of [".env.local", ".env"]) {
  try {
    loadEnvFile(file);
  } catch {
    // An absent file is not an error: the value may come from the environment.
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and check that " +
      "the host is `localhost` (not `db`) when running on the host machine.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  // The table definitions. drizzle-kit reads this to compute migration diffs;
  // the runtime connection in `lib/db/index.ts` imports the same file.
  schema: "./lib/db/schema.ts",
  // Generated SQL migrations, committed to git so schema changes stay
  // reviewable and reproducible.
  out: "./drizzle",
  dbCredentials: { url },
  // Map camelCase fields onto snake_case columns automatically, so a field
  // named `createdAt` is the column `created_at` without spelling it out.
  // This is the Postgres convention, and changing it later renames columns —
  // which is why it is set before any table exists.
  casing: "snake_case",
  // `verbose` and `strict` are both documented as applying to `push` only.
  // `verbose` prints every statement it would run; `strict` makes it ask for
  // confirmation first. They are learning and safety aids — the flow this
  // project uses (`generate` + `migrate`) writes the SQL to a file you can
  // read and review instead, so these never fire unless someone reaches for
  // `push` on real data.
  verbose: true,
  strict: true,
});

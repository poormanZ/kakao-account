#!/usr/bin/env node
/* global process, console, fetch */

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accountDbId = process.env.PRODUCTION_D1_DATABASE_ID;
const gameDbId = process.env.PRODUCTION_GAME_D1_DATABASE_ID;

if (!token || !accountId || !accountDbId || !gameDbId) {
  throw new Error("CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PRODUCTION_D1_DATABASE_ID and PRODUCTION_GAME_D1_DATABASE_ID are required");
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`;

async function query(databaseId, sql, params = []) {
  const response = await fetch(`${baseUrl}/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(`D1 query failed: ${response.status} ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.result?.[0] ?? { results: [] };
}

const legacyRows = (result) => result.results ?? [];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cleanup = process.argv.includes("--cleanup");

  if (cleanup && dryRun) throw new Error("--cleanup cannot be combined with --dry-run");

  const source = await query(
    accountDbId,
    `SELECT id, game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo,
            combo5_count, combo10_count, combo20_count, created_at
       FROM game_scores
      ORDER BY id ASC`,
  );
  const rows = legacyRows(source);
  const activeRows = rows.filter((row) => row.duration_seconds === 60);

  console.log(`Legacy Account D1 rows: ${rows.length}`);
  console.log(`Rows eligible for active Click Rush migration (60s): ${activeRows.length}`);
  console.log(`Rows archived as historical-only (20/40/60 mismatch aside): ${rows.length - activeRows.length}`);

  if (dryRun) return;

  for (const row of rows) {
    await query(
      gameDbId,
      `INSERT OR IGNORE INTO legacy_game_scores
       (source_id, game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo,
        combo5_count, combo10_count, combo20_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.game_slug,
        row.account_user_id,
        row.duration_seconds,
        row.score,
        row.clicks,
        row.misses,
        row.max_combo,
        row.combo5_count,
        row.combo10_count,
        row.combo20_count,
        row.created_at,
      ],
    );
  }

  for (const row of activeRows) {
    await query(
      gameDbId,
      `INSERT OR IGNORE INTO game_scores
       (game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo,
        combo5_count, combo10_count, combo20_count, created_at, legacy_source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.game_slug,
        row.account_user_id,
        row.duration_seconds,
        row.score,
        row.clicks,
        row.misses,
        row.max_combo,
        row.combo5_count,
        row.combo10_count,
        row.combo20_count,
        row.created_at,
        row.id,
      ],
    );
  }

  const archived = await query(gameDbId, "SELECT COUNT(*) AS count FROM legacy_game_scores");
  const migrated = await query(gameDbId, "SELECT COUNT(*) AS count FROM game_scores WHERE legacy_source_id IS NOT NULL");
  const archivedCount = Number(legacyRows(archived)[0]?.count ?? 0);
  const migratedCount = Number(legacyRows(migrated)[0]?.count ?? 0);

  if (archivedCount < rows.length || migratedCount < activeRows.length) {
    throw new Error(`Migration verification failed: archived=${archivedCount}/${rows.length}, migrated=${migratedCount}/${activeRows.length}`);
  }

  console.log(`Verified Game D1 archive: ${archivedCount}/${rows.length}`);
  console.log(`Verified active migration: ${migratedCount}/${activeRows.length}`);

  if (cleanup) {
    await query(accountDbId, "DROP TABLE IF EXISTS game_scores");
    console.log("Dropped legacy Account D1 game_scores table.");
  } else {
    console.log("Legacy Account D1 table retained. Re-run with --cleanup only after reviewing the migration result.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

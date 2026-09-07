const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Régression prod 07/09/2026 : sur une base existante sans la colonne error_code,
// l'ALTER de migration était schedulé après db.close() → SQLITE_MISUSE, conteneur
// en crash-loop au boot. initDb doit migrer proprement et se fermer sans erreur.
test('initDb migre une base ancienne (sans error_code) sans crash', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acdb-'));
  const dbPath = path.join(tmp, 'scans.db');

  // Ancienne base : schéma d'avant la colonne error_code.
  await new Promise((res, rej) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      `CREATE TABLE scans (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, offer TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL,
        started_at TEXT, finished_at TEXT, result TEXT, error TEXT
      )`,
      (e) => (e ? rej(e) : db.close(() => res()))
    );
  });

  process.env.DATABASE_PATH = dbPath;
  const { initDb } = require('../db.js'); // DATABASE_PATH lu au chargement du module
  await initDb();

  const columns = await new Promise((res, rej) => {
    const db = new sqlite3.Database(dbPath);
    db.all("SELECT name FROM pragma_table_info('scans')", (e, rows) =>
      e ? rej(e) : db.close(() => res(rows.map((r) => r.name)))
    );
  });
  assert.ok(columns.includes('error_code'), 'colonne error_code ajoutée par la migration');
});

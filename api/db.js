const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'scans.db');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb() {
  ensureDir(DB_PATH);
  return new sqlite3.Database(DB_PATH);
}

function initDb() {
  return new Promise((resolve, reject) => {
    ensureDir(DB_PATH);
    const db = getDb();
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          offer TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          result TEXT,
          error TEXT
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at)`);
    });
    db.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function createScan(id, url, offer) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO scans (id, url, offer, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, url, offer, 'pending', now],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ id, url, offer, status: 'pending', created_at: now });
      }
    );
  });
}

function getScan(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get('SELECT * FROM scans WHERE id = ?', [id], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function updateScanStatus(id, status, extra = {}) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const fields = ['status = ?'];
    const values = [status];

    if (extra.started_at) { fields.push('started_at = ?'); values.push(extra.started_at); }
    if (extra.finished_at) { fields.push('finished_at = ?'); values.push(extra.finished_at); }
    if (extra.result !== undefined) { fields.push('result = ?'); values.push(extra.result); }
    if (extra.error !== undefined) { fields.push('error = ?'); values.push(extra.error); }

    values.push(id);
    const sql = `UPDATE scans SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values, function (err) {
      db.close();
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

function listPendingScans() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all("SELECT * FROM scans WHERE status = 'pending' ORDER BY created_at ASC", [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  initDb,
  createScan,
  getScan,
  updateScanStatus,
  listPendingScans,
};

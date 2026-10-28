const { query } = require('../server/db/database');

async function run() {
  const tables = ['verification_progress', 'verification_cases', 'verification_attempts', 'audit_logs', 'verification_timeline', 'verification_evidence'];
  for (const t of tables) {
    const cols = (await query.all('PRAGMA table_info(' + t + ')')).map(c => c.name);
    console.log(t, cols.filter(c => c.includes('tl') || c.includes('agent') || c.includes('employee')));
  }
}

run().catch(console.error).finally(() => process.exit());

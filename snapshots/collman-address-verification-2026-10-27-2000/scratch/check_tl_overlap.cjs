const { query } = require('../server/db/database');

async function test() {
  const overlap = await query.all(`
    SELECT u.id, u.username, u.full_name, u.role, e.employee_id, e.employee_name
    FROM users u
    JOIN employees e ON LOWER(u.username) = LOWER(e.employee_id)
    WHERE u.role = 'Team Leader'
  `);
  console.log('TL users that are also in employees table:', overlap);

  // Check how team_leader is populated in employees table
  const allEmps = await query.all('SELECT employee_id, employee_name, team_leader FROM employees');
  console.log('All employees in employees table:', allEmps);
}

test().catch(console.error).finally(() => process.exit());

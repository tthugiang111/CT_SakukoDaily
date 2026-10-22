const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'chamdiem',
  password: 'chamdiem_secret_2026',
  database: 'cham_diem_nhan_su'
});

async function run() {
  await pool.query('SET search_path TO the_nbt, public');
  const cust = await pool.query('SELECT id FROM customers WHERE phone = $1', ['0386353791']);
  if (cust.rows.length > 0) {
    const custId = cust.rows[0].id;
    await pool.query('DELETE FROM redemptions WHERE customer_id = $1', [custId]);
    await pool.query('DELETE FROM violations WHERE customer_phone = $1', ['0386353791']);
    await pool.query('DELETE FROM pin_reset_requests WHERE phone = $1', ['0386353791']);
    await pool.query('DELETE FROM cards WHERE customer_id = $1', [custId]);
    await pool.query('DELETE FROM customers WHERE id = $1', [custId]);
    console.log('DELETED: 0386353791');
  } else {
    console.log('NOT_FOUND');
  }
  process.exit(0);
}
run();

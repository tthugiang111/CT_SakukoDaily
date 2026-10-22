const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'chamdiem',
  password: '***',
  database: 'cham_diem_nhan_su'
});

async function run() {
  await pool.query('SET search_path TO the_nbt, public');
  const rCards = await pool.query('SELECT count(*) FROM cards');
  const rCust = await pool.query('SELECT count(*) FROM customers');
  const rRedeem = await pool.query('SELECT count(*) FROM redemptions');
  console.log('DB STATUS:', {
    cards: rCards.rows[0].count,
    customers: rCust.rows[0].count,
    redemptions: rRedeem.rows[0].count
  });
  process.exit(0);
}
run();

const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'chamdiem',
  password: '***',
  database: 'cham_diem_nhan_su',
});

async function test() {
  const client = await pool.connect();
  await client.query('SET search_path TO the_nbt, public;');
  const c = await client.query('SELECT count(*) FROM customers');
  const cd = await client.query('SELECT count(*) FROM cards');
  const r = await client.query('SELECT count(*) FROM redemptions');
  console.log('OK DB:', { customers: c.rows[0].count, cards: cd.rows[0].count, redemptions: r.rows[0].count });
  client.release();
  process.exit(0);
}
test();

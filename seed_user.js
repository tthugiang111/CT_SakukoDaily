const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'chamdiem',
  password: process.env.PGPASSWORD || 'chamdiem_secret_2026',
  database: 'cham_diem_nhan_su',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO the_nbt, public;');
    const phone = '0386353791';
    const pin = '123456';
    const pinHash = await bcrypt.hash(pin, 10);
    const recHash = await bcrypt.hash('SAKUKO88', 10);

    let custRes = await client.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    let custId;
    if (custRes.rows.length === 0) {
      const ins = await client.query(
        'INSERT INTO customers (phone, pin_hash, recovery_code_hash, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [phone, pinHash, recHash, 'active']
      );
      custId = ins.rows[0].id;
    } else {
      custId = custRes.rows[0].id;
      await client.query('UPDATE customers SET pin_hash = $1, status = $2 WHERE id = $3', [pinHash, 'active', custId]);
    }

    const progRes = await client.query("SELECT id FROM programs WHERE status = 'active' LIMIT 1");
    const progId = progRes.rows[0].id;

    await client.query('DELETE FROM redemptions WHERE customer_id = $1', [custId]);
    await client.query('DELETE FROM cards WHERE customer_id = $1', [custId]);

    const cardRes = await client.query(`
      INSERT INTO cards (
        customer_id, program_id, store_code, purchased_at, usable_from, status, uses_count
      ) VALUES (
        $1, $2, 'XT', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 day', 'active', 0
      ) RETURNING id, usable_from, status, uses_count
    `, [custId, progId]);

    console.log('SUCCESS:', { customerId: custId, phone, pin, card: cardRes.rows[0] });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

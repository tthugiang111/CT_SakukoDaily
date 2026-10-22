const fs = require('fs');
const serverFile = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

const posApiCode = `
// ==========================================
// API DÀNH CHO HARAVAN POS EXTENSION
// ==========================================

// POS Extension gửi sự kiện khách mua thẻ tại quầy
app.post('/api/pos/card-purchase', async (req, res) => {
  try {
    const { phone, storeCode, orderNo, programId } = req.body;
    if (!phone) return res.status(400).json({ ok: false, error: 'Thiếu số điện thoại khách hàng' });

    const cleanPhone = phone.trim().replace(/^(\+84|84)/, '0');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Tìm hoặc tự động tạo customer nếu chưa đăng ký web
      let custRes = await client.query('SELECT * FROM customers WHERE phone = $1', [cleanPhone]);
      let custId;
      if (custRes.rows.length === 0) {
        const defaultPinHash = await bcrypt.hash('123456', 10);
        const newCust = await client.query(
          \`INSERT INTO customers (phone, pin_hash, status, must_change_pin)
           VALUES ($1, $2, 'active', TRUE) RETURNING id\`,
          [cleanPhone, defaultPinHash]
        );
        custId = newCust.rows[0].id;
      } else {
        custId = custRes.rows[0].id;
      }

      // 2. Kiểm tra thẻ active
      const checkCard = await client.query(
        \`SELECT id FROM cards WHERE customer_id = $1 AND status IN ('active', 'pending_active')\`,
        [custId]
      );
      if (checkCard.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Khách hàng đang có thẻ chưa hoàn thành 10 lượt' });
      }

      // 3. Lấy program
      const progRes = await client.query('SELECT * FROM programs WHERE status = $1 LIMIT 1', ['active']);
      const prog = progRes.rows[0];
      const progId = programId || (prog ? prog.id : 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const usableFromStr = tomorrow.toISOString().split('T')[0];

      const newCard = await client.query(
        \`INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count)
         VALUES ($1, $2, $3, $4, 'active', 0) RETURNING *\`,
        [custId, progId, storeCode || 'XT', usableFromStr]
      );

      // 4. Ghi nhận log POS event
      await client.query(
        \`INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)\`,
        ['POS_EXTENSION', 'PURCHASE_CARD', cleanPhone, \`Đơn: \${orderNo || 'POS_DIRECT'} - CH: \${storeCode || 'XT'}\`]
      );

      await client.query('COMMIT');
      return res.json({
        ok: true,
        message: 'Kích hoạt thẻ NBT thành công từ máy POS!',
        card: newCard.rows[0]
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POS Purchase Error]', err);
    return res.status(500).json({ ok: false, error: 'Lỗi kích hoạt thẻ từ POS' });
  }
});
`;

if (!content.includes('/api/pos/card-purchase')) {
  content = content.replace("// Fallback SPA", posApiCode + "\n// Fallback SPA");
  fs.writeFileSync(serverFile, content);
  console.log('Added /api/pos/card-purchase to server.js');
} else {
  console.log('/api/pos/card-purchase already exists');
}

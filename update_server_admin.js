const fs = require('fs');

const serverFile = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// Thêm các API mở rộng cho Admin PC vào server.js
const adminAPIExtension = `
// ==========================================
// 3. API BÁO CÁO VẬN HÀNH & QUẢN TRỊ PC ĐẦY ĐỦ
// ==========================================

// Báo cáo vận hành chuyên sâu cho PC
app.get('/api/admin/detailed-reports', adminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // 1. Phễu giữ chân (Funnel 1 -> 10)
      const funnelRes = await client.query(\`
        SELECT 
          s.use_step,
          COUNT(c.id) as reach_count
        FROM generate_series(1, 10) s(use_step)
        LEFT JOIN cards c ON c.uses_count >= s.use_step AND c.status IN ('active', 'used_up')
        GROUP BY s.use_step
        ORDER BY s.use_step ASC;
      \`);

      // 2. Thẻ bán & hủy theo cửa hàng
      const cardStatsRes = await client.query(\`
        SELECT 
          COALESCE(store_code, 'XT') as store_code,
          COUNT(*) FILTER (WHERE status != 'cancelled') as total_sold,
          COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled
        FROM cards
        GROUP BY store_code;
      \`);

      // 3. Doanh thu, Tiền giảm & AOV
      const financeRes = await client.query(\`
        SELECT 
          COUNT(*) as total_redemptions,
          COALESCE(SUM(CASE WHEN discount = 5000 THEN 1 ELSE 0 END), 0) as count_5k,
          COALESCE(SUM(CASE WHEN discount = 10000 THEN 1 ELSE 0 END), 0) as count_10k,
          COALESCE(SUM(discount), 0) as total_discount_amount,
          COALESCE(COUNT(*) * 32000, 0) as est_revenue,
          CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(COUNT(*) * 32000 / COUNT(*), 0)) ELSE 0 END as aov_est
        FROM redemptions
        WHERE valid = TRUE;
      \`);

      // 4. Thẻ ngủ (> 5 ngày chưa dùng lượt tiếp theo)
      const dormantRes = await client.query(\`
        SELECT 
          c.id, c.customer_id, cust.phone, c.store_code, c.uses_count,
          COALESCE(MAX(r.used_at), c.purchased_at) as last_active_at,
          ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(r.used_at), c.purchased_at))) / 86400) as dormant_days
        FROM cards c
        JOIN customers cust ON c.customer_id = cust.id
        LEFT JOIN redemptions r ON c.id = r.card_id
        WHERE c.status = 'active' AND c.uses_count < 10
        GROUP BY c.id, c.customer_id, cust.phone, c.store_code, c.uses_count, c.purchased_at
        HAVING EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(r.used_at), c.purchased_at))) / 86400 >= 3
        ORDER BY dormant_days DESC;
      \`);

      // 5. Vi phạm V01 - V10
      const violationsRes = await client.query(\`
        SELECT * FROM violations ORDER BY detected_at DESC LIMIT 50;
      \`);

      // 6. Tình trạng Extension theo máy POS
      const posRes = await client.query(\`
        SELECT 
          p.*,
          ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.last_seen_at)) / 60) as minutes_ago,
          (SELECT COUNT(*) FROM violations v WHERE v.rule_code = 'V10' AND v.store_code = p.store_code) as missing_events_v10
        FROM pos_tokens p
        ORDER BY p.store_code, p.id;
      \`);

      // 7. Danh sách chương trình & cửa hàng
      const programsRes = await client.query(\`SELECT * FROM programs ORDER BY id DESC;\`);
      const storesRes = await client.query(\`SELECT * FROM stores ORDER BY store_code;\`);

      return res.json({
        ok: true,
        funnel: funnelRes.rows,
        cardStats: cardStatsRes.rows,
        finance: financeRes.rows[0],
        dormantCards: dormantRes.rows,
        violations: violationsRes.rows,
        posDevices: posRes.rows,
        programs: programsRes.rows,
        stores: storesRes.rows
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Lỗi tải báo cáo chi tiết' });
  }
});

// Admin tạo Token Extension cho máy POS
app.post('/api/admin/create-pos-token', adminAuth, async (req, res) => {
  try {
    const { storeCode, deviceName } = req.body;
    if (!storeCode || !deviceName) return res.status(400).json({ ok: false, error: 'Thiếu thông tin' });

    const rawToken = 'nbt_pos_' + Math.random().toString(36).substring(2, 12);
    const display = rawToken.slice(0, 10) + '***';
    const hash = await bcrypt.hash(rawToken, 10);

    const client = await pool.connect();
    try {
      const r = await client.query(\`
        INSERT INTO pos_tokens (store_code, device_name, token_hash, token_display)
        VALUES ($1, $2, $3, $4) RETURNING *;
      \`, [storeCode, deviceName, hash, display]);
      return res.json({ ok: true, rawToken, token: r.rows[0], message: 'Tạo token thành công!' });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi tạo token' });
  }
});
`;

if (!content.includes('/api/admin/detailed-reports')) {
  content = content.replace("// Fallback SPA", adminAPIExtension + "\n// Fallback SPA");
  fs.writeFileSync(serverFile, content);
  console.log('Added detailed-reports endpoints to server.js');
} else {
  console.log('Endpoints already present');
}

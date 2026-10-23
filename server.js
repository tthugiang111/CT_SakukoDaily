const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8082;
const JWT_SECRET = process.env.JWT_SECRET || 'sakuko_nbt_secret_key_2026';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'chamdiem',
  password: process.env.PGPASSWORD || 'chamdiem_secret_2026',
  database: process.env.PGDATABASE || 'cham_diem_nhan_su',
});

pool.on('connect', (client) => {
  client.query('SET search_path TO the_nbt, public;');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());


// ==========================================
// BỘ NHỚ ĐỆM TẠM THỜI CHO WEBHOOK EVENTS (TTL 30 PHÚT)
// ==========================================
const recentWebhookEvents = [];
const WEBHOOK_EVENT_TTL_MS = 30 * 60 * 1000; // 30 phút

function recordWebhookEvent(eventData) {
  const now = Date.now();
  recentWebhookEvents.push({
    received_at: new Date(now).toISOString(),
    timestamp_ms: now,
    ...eventData
  });
  cleanupOldWebhookEvents();
}

function cleanupOldWebhookEvents() {
  const cutoff = Date.now() - WEBHOOK_EVENT_TTL_MS;
  while (recentWebhookEvents.length > 0 && recentWebhookEvents[0].timestamp_ms < cutoff) {
    recentWebhookEvents.shift();
  }
}

// Chạy dọn dẹp định kỳ mỗi 5 phút
setInterval(cleanupOldWebhookEvents, 5 * 60 * 1000);

// GLOBAL REQUEST LOGGER FOR WEBHOOK DEBUGGING
app.use((req, res, next) => {
  if (req.path.includes('webhook') || req.method === 'POST') {
    console.log(`[REQ ${req.method}] ${req.path} - Headers:`, {
      'x-haravan-topic': req.headers['x-haravan-topic'],
      'x-event-type': req.headers['x-event-type'],
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });
  }
  next();
});

// Static files
// Chặn truy cập trực tiếp file admin.html tĩnh khi chưa xác thực Lark Admin
app.get('/admin.html', (req, res) => {
  return res.redirect('/admin');
});

// Middleware kiểm tra quyền admin cho mọi request vào /admin
const adminAuthGuard = (req, res, next) => {
  const token = req.cookies.nbt_admin_token;
  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin_ho', 'store_manager'].includes(decoded.role)) {
      return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
    }
    req.admin = decoded;
    return next();
  } catch (err) {
    return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
  }
};

app.get('/admin', adminAuthGuard, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Static files (sau khi đã chặn route admin)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false // Không tự động index
}));



app.get('/api/admin/logout', (req, res) => {
  res.clearCookie('nbt_admin_token', { path: '/' });
  return res.redirect('/admin');
});


// Middleware Auth Khách hàng
function customerAuth(req, res, next) {
  const token = req.cookies.nbt_admin_token || req.cookies.nbt_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ ok: false, error: 'Sai quyền' });
    req.customer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Phiên đăng nhập hết hạn' });
  }
}

// Middleware Auth Admin & CHT
function adminAuth(req, res, next) {
  const token = req.cookies.nbt_admin_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.status(401).json({ ok: false, error: 'Chưa đăng nhập quyền quản trị' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin_ho', 'store_manager'].includes(decoded.role)) {
      return res.status(403).json({ ok: false, error: 'Không có quyền truy cập' });
    }
    req.adminUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Phiên quản trị hết hạn' });
  }
}

// ==========================================
// 1. API KHÁCH HÀNG (MOBILE SAKUKO DAILY)
// ==========================================

// Đăng ký / Đăng nhập
app.post('/api/auth/login-or-register', async (req, res) => {
  try {
    let { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ ok: false, error: 'Thiếu SĐT hoặc mã PIN' });

    phone = phone.trim().replace(/^(\+84|84)/, '0');
    if (!/^0\d{9}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ ok: false, error: 'Mã PIN phải gồm đúng 6 chữ số' });
    }

    const client = await pool.connect();
    try {
      const userRes = await client.query('SELECT * FROM customers WHERE phone = $1', [phone]);

      if (userRes.rows.length === 0) {
        // Đăng ký mới
        const pinHash = await bcrypt.hash(pin, 10);
        const recoveryCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const recHash = await bcrypt.hash(recoveryCode, 10);

        const newCust = await client.query(
          `INSERT INTO customers (phone, pin_hash, recovery_code_hash, status)
           VALUES ($1, $2, $3, 'active') RETURNING id, phone`,
          [phone, pinHash, recHash]
        );

        const token = jwt.sign({ id: newCust.rows[0].id, phone, role: 'customer' }, JWT_SECRET, { expiresIn: '90d' });
        res.cookie('nbt_token', token, { httpOnly: true, maxAge: 90 * 24 * 3600 * 1000 });

        // Khách mới chưa có đơn hàng mua thẻ trà: không tự động cấp thẻ ảo, chờ webhook Haravan kích hoạt khi mua tại quầy

        return res.json({
          ok: true,
          isNew: true,
          token,
          recoveryCode,
          message: 'Đăng ký thành công! Bạn hãy lưu lại Mã bảo mật để khôi phục mật khẩu khi cần.'
        });
      }

      // Khách cũ đăng nhập
      const cust = userRes.rows[0];
      if (cust.status === 'locked') {
        return res.status(403).json({ ok: false, error: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.' });
      }

      const match = await bcrypt.compare(pin, cust.pin_hash);
      if (!match) {
        return res.status(400).json({ ok: false, error: 'Mã PIN không chính xác' });
      }

      const token = jwt.sign({ id: cust.id, phone, role: 'customer' }, JWT_SECRET, { expiresIn: '90d' });
      res.cookie('nbt_token', token, { httpOnly: true, maxAge: 90 * 24 * 3600 * 1000 });

      return res.json({
        ok: true,
        isNew: false,
        token,
        mustChangePin: cust.must_change_pin,
        message: 'Đăng nhập thành công!'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi hệ thống khi đăng nhập' });
  }
});

// Quên PIN - Tự khôi phục
app.post('/api/auth/reset-pin-by-recovery', async (req, res) => {
  try {
    let { phone, recoveryCode, newPin } = req.body;
    if (!phone || !recoveryCode || !newPin) return res.status(400).json({ ok: false, error: 'Thiếu thông tin' });

    phone = phone.trim().replace(/^(\+84|84)/, '0');
    if (!/^\d{6}$/.test(newPin)) return res.status(400).json({ ok: false, error: 'Mã PIN mới phải đúng 6 chữ số' });

    const client = await pool.connect();
    try {
      const custRes = await client.query('SELECT * FROM customers WHERE phone = $1', [phone]);
      if (custRes.rows.length === 0) return res.status(404).json({ ok: false, error: 'Không tìm thấy SĐT này' });

      const cust = custRes.rows[0];
      const match = await bcrypt.compare(recoveryCode.trim().toUpperCase(), cust.recovery_code_hash);
      if (!match) return res.status(400).json({ ok: false, error: 'Mã khôi phục không đúng' });

      const newPinHash = await bcrypt.hash(newPin, 10);
      const newRecoveryCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newRecHash = await bcrypt.hash(newRecoveryCode, 10);

      await client.query(
        `UPDATE customers SET pin_hash = $1, recovery_code_hash = $2, must_change_pin = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [newPinHash, newRecHash, cust.id]
      );

      return res.json({
        ok: true,
        newRecoveryCode,
        message: 'Đổi mã PIN thành công! Đây là mã khôi phục mới của bạn.'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi máy chủ' });
  }
});

// Lấy thông tin cá nhân & Thẻ

// API lấy toàn bộ thẻ của khách hàng (active, used_up, expired)
app.get('/api/customer/my-cards', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const client = await pool.connect();
    try {
      const cardsRes = await client.query(`
        SELECT c.*, p.name as program_name, p.end_date, p.card_price, p.item_code
        FROM cards c
        JOIN programs p ON c.program_id = p.id
        WHERE c.customer_id = $1
        ORDER BY c.id DESC
      `, [custId]);
      return res.json({ ok: true, cards: cardsRes.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh sách thẻ' });
  }
});

// API lấy lịch sử áp dụng voucher của khách hàng
app.get('/api/customer/redemption-history', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const client = await pool.connect();
    try {
      const historyRes = await client.query(`
        SELECT r.*, c.store_code, p.name as program_name
        FROM redemptions r
        JOIN cards c ON r.card_id = c.id
        JOIN programs p ON c.program_id = p.id
        WHERE c.customer_id = $1
        ORDER BY r.used_at DESC
      `, [custId]);
      return res.json({ ok: true, history: historyRes.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải lịch sử ưu đãi' });
  }
});

app.get('/api/customer/me', customerAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const custId = req.customer.id;
      const custRes = await client.query('SELECT id, phone, status, created_at FROM customers WHERE id = $1', [custId]);
      if (custRes.rows.length === 0) return res.status(404).json({ ok: false, error: 'Khách không tồn tại' });

      const progRes = await client.query(`SELECT * FROM programs WHERE status = 'active' ORDER BY id DESC LIMIT 1`);
      const activeProgram = progRes.rows[0] || null;

      const cardRes = await client.query(
        `SELECT c.*, p.name as program_name, p.end_date, p.stop_sale_date, p.voucher_5k, p.voucher_10k, p.aov_min
         FROM cards c
         JOIN programs p ON c.program_id = p.id
         WHERE c.customer_id = $1 AND c.status IN ('active', 'pending_active')
         ORDER BY c.id DESC LIMIT 1`,
        [custId]
      );

      const currentCard = cardRes.rows[0] || null;
      let usedToday = false;
      let nextVoucher = null;

      if (currentCard) {
        const todayRes = await client.query(
          `SELECT * FROM redemptions 
           WHERE card_id = $1 AND DATE(used_at) = CURRENT_DATE AND valid = TRUE`,
          [currentCard.id]
        );
        usedToday = todayRes.rows.length > 0;

        const nextUseNo = currentCard.uses_count + 1;
        if (nextUseNo <= 10) {
          const isBig = (nextUseNo === 5 || nextUseNo === 10);
          nextVoucher = {
            useNo: nextUseNo,
            discount: isBig ? 10000 : 5000,
            voucherCode: isBig ? currentCard.voucher_10k : currentCard.voucher_5k,
            aovMin: Number(currentCard.aov_min),
            programEndDate: currentCard.end_date,
            canUseNow: (new Date() >= new Date(currentCard.usable_from)) && !usedToday
          };
        }
      }

      const allProgsRes = await client.query("SELECT * FROM programs WHERE status = 'active' ORDER BY id DESC;");
      return res.json({
        ok: true,
        customer: custRes.rows[0],
        activeProgram,
        programs: allProgsRes.rows,
        currentCard,
        usedToday,
        nextVoucher
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải thông tin' });
  }
});

// Mua thẻ

// API GIẢ LẬP KÍCH HOẠT THẺ NHANH & DÙNG ĐƯỢC NGAY
app.post('/api/customer/fast-activate-card', customerAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const custId = req.customer.id;
    const phone = req.customer.phone;

    await client.query('BEGIN');

    // Lấy chương trình đang active
    const progRes = await client.query("SELECT * FROM programs WHERE status = 'active' ORDER BY id DESC LIMIT 1");
    const prog = progRes.rows[0];
    const progId = prog ? prog.id : 1;

    // Hủy hoặc đánh dấu hoàn tất các thẻ cũ nếu có để tạo thẻ mới tinh
    await client.query(
      `UPDATE cards SET status = 'cancelled', updated_at = NOW() 
       WHERE customer_id = $1 AND status IN ('active', 'pending_active')`,
      [custId]
    );

    // Tua thời gian: usable_from là ngày hôm qua để hôm nay dùng được ngay lượt 1
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const usableFromStr = yesterday.toISOString().split('T')[0];

    const cardRes = await client.query(
      `INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count, order_no, created_at)
       VALUES ($1, $2, 'XT', $3, 'active', 0, $4, NOW() - INTERVAL '1 day') RETURNING *`,
      [custId, progId, usableFromStr, 'SIMULATED_TEST_' + Math.floor(Math.random() * 899999 + 100000)]
    );

    await client.query(
      `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
      ['TEST_CLIENT_SIMULATOR', 'FAST_ACTIVATE_CARD', `customer:${phone}`, JSON.stringify({ cardId: cardRes.rows[0].id })]
    );

    await client.query('COMMIT');
    return res.json({
      ok: true,
      message: 'Giả lập kích hoạt thẻ thành công! Lượt #1 đã sẵn sàng để quét ưu đãi ngay hôm nay.',
      card: cardRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ ok: false, error: 'Lỗi kích hoạt thẻ giả lập: ' + err.message });
  } finally {
    client.release();
  }
});

app.post('/api/customer/buy-card', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const { programId, storeCode } = req.body;

    const client = await pool.connect();
    try {
      const checkCard = await client.query(
        `SELECT id FROM cards WHERE customer_id = $1 AND status IN ('active', 'pending_active')`,
        [custId]
      );
      if (checkCard.rows.length > 0) {
        return res.status(400).json({ ok: false, error: 'Bạn đang có một thẻ đang hoạt động. Hãy dùng hết 10 lượt trước khi mua thẻ mới!' });
      }

      const progRes = await client.query('SELECT * FROM programs WHERE id = $1', [programId]);
      if (progRes.rows.length === 0) return res.status(404).json({ ok: false, error: 'Chương trình không tồn tại' });
      const prog = progRes.rows[0];

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const usableFromStr = tomorrow.toISOString().split('T')[0];

      const newCard = await client.query(
        `INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count)
         VALUES ($1, $2, $3, $4, 'active', 0) RETURNING *`,
        [custId, programId, storeCode || 'XT', usableFromStr]
      );

      return res.json({
        ok: true,
        card: newCard.rows[0],
        message: 'Mua thẻ thành công! Bạn có thể bắt đầu sử dụng ưu đãi lượt 1 từ ngày mai.'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tạo thẻ' });
  }
});

// Áp dụng voucher
app.post('/api/customer/redeem-voucher', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const { cardId, orderNo, storeCode } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cardRes = await client.query(
        `SELECT c.*, p.voucher_5k, p.voucher_10k, p.end_date 
         FROM cards c 
         JOIN programs p ON c.program_id = p.id 
         WHERE c.id = $1 AND c.customer_id = $2 FOR UPDATE`,
        [cardId, custId]
      );

      if (cardRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Không tìm thấy thẻ' });
      }

      const card = cardRes.rows[0];
      if (card.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Thẻ không trong trạng thái hoạt động' });
      }

      const todayRedeem = await client.query(
        `SELECT id FROM redemptions WHERE card_id = $1 AND DATE(used_at) = CURRENT_DATE AND valid = TRUE`,
        [card.id]
      );
      if (todayRedeem.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Hôm nay bạn đã dùng ưu đãi rồi! Vui lòng quay lại vào ngày mai.' });
      }

      const nextUseNo = card.uses_count + 1;
      if (nextUseNo > 10) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Thẻ đã sử dụng hết 10 lượt ưu đãi!' });
      }

      const isBig = (nextUseNo === 5 || nextUseNo === 10);
      const discount = isBig ? 10000 : 5000;
      const voucherCode = isBig ? card.voucher_10k : card.voucher_5k;

      await client.query(
        `INSERT INTO redemptions (card_id, customer_id, use_no, voucher_code, discount, order_no, store_code, source, valid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'web', TRUE)`,
        [card.id, custId, nextUseNo, voucherCode, discount, orderNo || 'DEMO_ORDER', storeCode || card.store_code || 'XT']
      );

      const newStatus = nextUseNo >= 10 ? 'used_up' : 'active';
      await client.query(
        `UPDATE cards SET uses_count = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [nextUseNo, newStatus, card.id]
      );

      await client.query('COMMIT');
      return res.json({
        ok: true,
        useNo: nextUseNo,
        discount,
        voucherCode,
        message: `Đã áp dụng thành công lượt ${nextUseNo}/10 (Giảm ${discount.toLocaleString()}đ)!`
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi thực hiện giao dịch' });
  }
});

// ==========================================
// 2. API QUẢN TRỊ ADMIN HO & CỬA HÀNG TRƯỞNG
// ==========================================

// Lấy danh sách tài khoản quản trị để chọn đăng nhập giả lập / Lark OAuth
app.get('/api/admin/accounts', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT lark_open_id, name, email, role, store_code FROM admin_users WHERE status = $1 ORDER BY id ASC', ['active']);
      return res.json({ ok: true, accounts: r.rows });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh sách quản trị' });
  }
});

// Đăng nhập quản trị viên (theo Lark OpenID)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { larkOpenId } = req.body;
    if (!larkOpenId) return res.status(400).json({ ok: false, error: 'Thiếu Lark OpenID' });

    const client = await pool.connect();
    try {
      const r = await client.query('SELECT * FROM admin_users WHERE lark_open_id = $1 AND status = $2', [larkOpenId, 'active']);
      if (r.rows.length === 0) return res.status(403).json({ ok: false, error: 'Tài khoản không tồn tại hoặc bị khóa' });

      const user = r.rows[0];
      const token = jwt.sign({
        id: user.id, 
        larkOpenId: user.lark_open_id, 
        name: user.name, 
        role: user.role, 
        storeCode: user.store_code 
      }, JWT_SECRET, { expiresIn: '12h' });

      res.cookie('nbt_admin_token', token, { path: '/', httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 86400 * 1000 });
      return res.json({ ok: true, user, token, message: `Chào mừng ${user.name} (${user.role === 'admin_ho' ? 'Admin HO' : 'Cửa hàng trưởng'})` });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi đăng nhập quản trị' });
  }
});

// Thông tin admin hiện tại
app.get('/api/admin/me', adminAuth, (req, res) => {
  return res.json({ ok: true, user: req.adminUser });
});

// Thống kê & Báo cáo phân quyền
app.get('/api/admin/overview', adminAuth, async (req, res) => {
  try {
    const { role, storeCode } = req.adminUser;
    const client = await pool.connect();
    try {
      let custQuery = 'SELECT COUNT(*) FROM customers';
      let cardQuery = role === 'admin_ho' 
        ? "SELECT COUNT(*) FROM cards" 
        : `SELECT COUNT(*) FROM cards WHERE store_code = '${storeCode}'`;
      let activeCardQuery = role === 'admin_ho'
        ? "SELECT COUNT(*) FROM cards WHERE status = 'active'"
        : `SELECT COUNT(*) FROM cards WHERE status = 'active' AND store_code = '${storeCode}'`;
      let redeemQuery = role === 'admin_ho'
        ? "SELECT COUNT(*), COALESCE(SUM(discount),0) as total_discount FROM redemptions WHERE valid = TRUE"
        : `SELECT COUNT(*), COALESCE(SUM(discount),0) as total_discount FROM redemptions WHERE valid = TRUE AND store_code = '${storeCode}'`;

      const custCount = await client.query(custQuery);
      const cardCount = await client.query(cardQuery);
      const activeCardCount = await client.query(activeCardQuery);
      const redeemCount = await client.query(redeemQuery);

      // Danh sách khách gần đây
      let custTableQuery = role === 'admin_ho'
        ? `SELECT c.id, c.phone, c.status, c.created_at, cd.uses_count, cd.status as card_status, cd.store_code
           FROM customers c
           LEFT JOIN cards cd ON c.id = cd.customer_id
           ORDER BY c.id DESC LIMIT 20`
        : `SELECT c.id, c.phone, c.status, c.created_at, cd.uses_count, cd.status as card_status, cd.store_code
           FROM customers c
           JOIN cards cd ON c.id = cd.customer_id
           WHERE cd.store_code = '${storeCode}'
           ORDER BY c.id DESC LIMIT 20`;

      const recentCust = await client.query(custTableQuery);

      // Danh sách yêu cầu Reset PIN
      let reqQuery = role === 'admin_ho'
        ? `SELECT * FROM pin_reset_requests ORDER BY id DESC LIMIT 10`
        : `SELECT * FROM pin_reset_requests WHERE store_code = '${storeCode}' ORDER BY id DESC LIMIT 10`;
      const requests = await client.query(reqQuery);

      // Danh sách vi phạm (V01 - V10)
      let violQuery = role === 'admin_ho'
        ? `SELECT * FROM violations ORDER BY id DESC LIMIT 10`
        : `SELECT * FROM violations WHERE store_code = '${storeCode}' ORDER BY id DESC LIMIT 10`;
      const violations = await client.query(violQuery);

      return res.json({
        ok: true,
        user: req.adminUser,
        metrics: {
          totalCustomers: Number(custCount.rows[0].count),
          totalCards: Number(cardCount.rows[0].count),
          activeCards: Number(activeCardCount.rows[0].count),
          totalRedemptions: Number(redeemCount.rows[0].count),
          totalDiscount: Number(redeemCount.rows[0].total_discount)
        },
        recentCustomers: recentCust.rows,
        pinRequests: requests.rows,
        violations: violations.rows
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải dữ liệu admin' });
  }
});

// Cửa hàng trưởng gửi yêu cầu Reset PIN lên Admin HO
app.post('/api/admin/request-pin-reset', adminAuth, async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone) return res.status(400).json({ ok: false, error: 'Thiếu số điện thoại' });

    const client = await pool.connect();
    try {
      const r = await client.query(
        `INSERT INTO pin_reset_requests (phone, store_code, requested_by, reason, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
        [phone.trim(), req.adminUser.storeCode || 'XT', req.adminUser.name, reason || 'Khách quên PIN và mất mã khôi phục tại quầy']
      );
      return res.json({ ok: true, request: r.rows[0], message: 'Đã gửi yêu cầu reset PIN lên Admin HO thành công!' });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi gửi yêu cầu' });
  }
});

// Admin HO duyệt Reset PIN trực tiếp
app.post('/api/admin/approve-pin-reset', adminAuth, async (req, res) => {
  try {
    if (req.adminUser.role !== 'admin_ho') {
      return res.status(403).json({ ok: false, error: 'Chỉ Admin HO mới có quyền duyệt reset PIN' });
    }

    const { requestId, phone, tempPin } = req.body;
    const finalPin = tempPin || '123456';
    const pinHash = await bcrypt.hash(finalPin, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Cập nhật PIN khách
      await client.query(
        `UPDATE customers SET pin_hash = $1, must_change_pin = TRUE, updated_at = CURRENT_TIMESTAMP WHERE phone = $2`,
        [pinHash, phone.trim()]
      );

      // Cập nhật trạng thái yêu cầu nếu có requestId
      if (requestId) {
        await client.query(
          `UPDATE pin_reset_requests SET status = 'approved', temp_pin = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [finalPin, requestId]
        );
      }

      await client.query(
        `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
        [req.adminUser.name, 'RESET_PIN', phone, `Đã cấp PIN tạm: ${finalPin}`]
      );

      await client.query('COMMIT');
      return res.json({ ok: true, tempPin: finalPin, message: `Đã reset PIN cho khách ${phone} về: ${finalPin}` });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi xử lý duyệt reset PIN' });
  }
});


// ==========================================
// 3. API BÁO CÁO VẬN HÀNH & QUẢN TRỊ PC ĐẦY ĐỦ
// ==========================================

// Báo cáo vận hành chuyên sâu cho PC

// API LẤY LỊCH SỬ HOẠT ĐỘNG / TRUY CẬP / CẬP NHẬT HỆ THỐNG

// API LẤY CÁC SỰ KIỆN WEBHOOK TRONG VÒNG 30 PHÚT
app.get('/api/admin/recent-webhooks', adminAuth, (req, res) => {
  cleanupOldWebhookEvents();
  return res.json({
    ok: true,
    ttl_minutes: 30,
    total: recentWebhookEvents.length,
    events: [...recentWebhookEvents].reverse()
  });
});

app.get('/api/admin/audit-logs', adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const logs = await client.query(
      `SELECT id, actor, action, target, detail, created_at 
       FROM the_nbt.audit_log 
       ORDER BY id DESC LIMIT $1`,
      [limit]
    );
    return res.json({ ok: true, logs: logs.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải nhật ký hoạt động' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/detailed-reports', adminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // 1. Phễu giữ chân (Funnel 1 -> 10)
      const funnelRes = await client.query(`
        SELECT 
          s.use_step,
          COUNT(c.id) as reach_count
        FROM generate_series(1, 10) s(use_step)
        LEFT JOIN cards c ON c.uses_count >= s.use_step AND c.status IN ('active', 'used_up')
        GROUP BY s.use_step
        ORDER BY s.use_step ASC;
      `);

      // 2. Thẻ bán & hủy theo cửa hàng
      const cardStatsRes = await client.query(`
        SELECT 
          COALESCE(store_code, 'XT') as store_code,
          COUNT(*) FILTER (WHERE status != 'cancelled') as total_sold,
          COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled
        FROM cards
        GROUP BY store_code;
      `);

      // 3. Doanh thu, Tiền giảm & AOV
      const financeRes = await client.query(`
        SELECT 
          COUNT(*) as total_redemptions,
          COALESCE(SUM(CASE WHEN discount = 5000 THEN 1 ELSE 0 END), 0) as count_5k,
          COALESCE(SUM(CASE WHEN discount = 10000 THEN 1 ELSE 0 END), 0) as count_10k,
          COALESCE(SUM(discount), 0) as total_discount_amount,
          COALESCE(COUNT(*) * 32000, 0) as est_revenue,
          CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(COUNT(*) * 32000 / COUNT(*), 0)) ELSE 0 END as aov_est
        FROM redemptions
        WHERE valid = TRUE;
      `);

      // 4. Thẻ ngủ (> 5 ngày chưa dùng lượt tiếp theo)
      const dormantRes = await client.query(`
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
      `);

      // 5. Vi phạm V01 - V10
      const violationsRes = await client.query(`
        SELECT * FROM violations ORDER BY detected_at DESC LIMIT 50;
      `);

      // 6. Tình trạng Extension theo máy POS
      const posRes = await client.query(`
        SELECT 
          p.*,
          ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.last_seen_at)) / 60) as minutes_ago,
          (SELECT COUNT(*) FROM violations v WHERE v.rule_code = 'V10' AND v.store_code = p.store_code) as missing_events_v10
        FROM pos_tokens p
        ORDER BY p.store_code, p.id;
      `);

      // 7. Danh sách chương trình & cửa hàng
      const programsRes = await client.query(`SELECT * FROM programs ORDER BY id DESC;`);
      const storesRes = await client.query(`SELECT * FROM stores ORDER BY store_code;`);

      const customersListRes = await client.query(`
        SELECT 
          c.id, c.phone, c.status as cust_status, c.created_at,
          cd.id as card_id, cd.status as card_status, cd.uses_count, 
          cd.purchased_at, cd.usable_from, COALESCE(cd.store_code, 'XT') as store_code,
          p.name as program_name
        FROM customers c
        LEFT JOIN cards cd ON c.id = cd.customer_id
        LEFT JOIN programs p ON cd.program_id = p.id
        ORDER BY c.id DESC;
      `);

      return res.json({
        ok: true,
        funnel: funnelRes.rows,
        cardStats: cardStatsRes.rows,
        finance: financeRes.rows[0],
        dormantCards: dormantRes.rows,
        violations: violationsRes.rows,
        posDevices: posRes.rows,
        programs: programsRes.rows,
        stores: storesRes.rows,
        customers: customersListRes.rows
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
      const r = await client.query(`
        INSERT INTO pos_tokens (store_code, device_name, token_hash, token_display)
        VALUES ($1, $2, $3, $4) RETURNING *;
      `, [storeCode, deviceName, hash, display]);
      return res.json({ ok: true, rawToken, token: r.rows[0], message: 'Tạo token thành công!' });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lỗi tạo token' });
  }
});


// ==========================================
// LARK OAUTH AUTHENTICATION (STRICT ADMIN HO)
// ==========================================
const LARK_APP_ID = process.env.LARK_APP_ID || 'cli_aaf7321fa3f8ded1';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || 'Zzh2AjvfA2CggKA1fRVxYf1wvyYXlJWO';
const LARK_DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com';
const LARK_REDIRECT_URI = process.env.LARK_REDIRECT_URI || 'https://explosion-synthesis-donna-teens.trycloudflare.com/api/admin/lark/callback';

// DUY NHẤT một tài khoản được cấp quyền Admin HO: Trần Thị Thu Giang
const STRICT_ADMIN_OPEN_ID = 'ou_45760cf4c58e0ab0217683d64cd36f65';

app.get('/api/admin/lark/login', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  res.cookie('lark_oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });
  const authUrl = `${LARK_DOMAIN}/open-apis/authen/v1/authorize?client_id=${LARK_APP_ID}&app_id=${LARK_APP_ID}&redirect_uri=${encodeURIComponent(LARK_REDIRECT_URI)}&state=${state}`;
  return res.redirect(authUrl);
});

app.get('/api/admin/lark/callback', async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies.lark_oauth_state;

  if (!code) {
    return res.status(400).send('<h3>Đăng nhập Lark thất bại: Thiếu mã code</h3><p><a href="/admin">Quay lại</a></p>');
  }

  try {
    // 1. Lấy app_access_token
    const appRes = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: LARK_APP_ID, app_secret: LARK_APP_SECRET })
    });
    const appData = await appRes.json();
    if (appData.code !== 0) {
      console.error('[Lark App Token Error]', appData);
      return res.status(403).send(`<h3>Lỗi xác thực Lark App: ${appData.msg}</h3><p><a href="/admin">Quay lại</a></p>`);
    }

    // 2. Đổi code lấy user access token
    const tokenRes = await fetch(`${LARK_DOMAIN}/open-apis/authen/v1/oidc/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + appData.app_access_token
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
      console.error('[Lark User Token Error]', tokenData);
      return res.status(403).send(`<h3>Lỗi xác thực Lark: ${tokenData.msg}</h3><p><a href="/admin">Quay lại</a></p>`);
    }

    // 3. Lấy thông tin user
    const userRes = await fetch(`${LARK_DOMAIN}/open-apis/authen/v1/user_info`, {
      headers: {
        'Authorization': 'Bearer ' + tokenData.data.access_token
      }
    });
    const userData = await userRes.json();
    if (userData.code !== 0) {
      console.error('[Lark User Info Error]', userData);
      return res.status(403).send(`<h3>Lỗi lấy thông tin Lark: ${userData.msg}</h3><p><a href="/admin">Quay lại</a></p>`);
    }

    const { open_id, name, avatar_url } = userData.data;

    // 2. KIỂM TRA QUYỀN NGHIÊM NGẶT (CHỈ DUY NHẤT TRẦN THỊ THU GIANG)
    if (open_id !== STRICT_ADMIN_OPEN_ID) {
      return res.status(403).send(`
        <div style="font-family: sans-serif; max-width: 500px; margin: 80px auto; padding: 24px; border: 1px solid #fda4af; border-radius: 12px; background: #fff1f2; color: #9f1239;">
          <h2 style="margin-top: 0;">Truy cập bị từ chối!</h2>
          <p>Tài khoản Lark: <b>${name || open_id}</b> không có quyền truy cập hệ thống quản trị Sakuko Daily.</p>
          <p style="font-size: 13px; color: #881337;">Hệ thống chỉ cấp quyền toàn quyền duy nhất cho Quản trị viên HO (Trần Thị Thu Giang).</p>
          <hr style="border: none; border-top: 1px solid #fecdd3; margin: 16px 0;" />
          <a href="/admin" style="display: inline-block; padding: 8px 16px; background: #e11d48; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">Quay lại Cổng Admin</a>
        </div>
      `);
    }

    // 3. Cấp Token Admin HO
    const adminUser = {
      openId: open_id,
      name: name || 'Trần Thị Thu Giang',
      role: 'admin_ho',
      store_code: 'ALL',
      avatar: avatar_url
    };

    const token = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('nbt_admin_token', token, { path: '/', httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 86400 * 1000 });

    // Chuyển hướng về admin.html
    return res.redirect('/admin');
  } catch (err) {
    console.error('[Lark OAuth Error]', err);
    return res.status(500).send('<h3>Lỗi hệ thống trong quá trình đăng nhập Lark</h3>');
  }
});





// ==========================================
// 4. API PHÂN QUYỀN VAI TRÒ (RBAC) & QUẢN TRỊ TÀI KHOẢN
// ==========================================

// Lấy danh sách toàn bộ tài khoản và vai trò
app.get('/api/admin/roles/users', adminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id, lark_open_id, name, email, role, store_code, status, created_at FROM admin_users ORDER BY id ASC');
      return res.json({ ok: true, users: r.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh sách người dùng' });
  }
});

// Admin HO thêm / sửa tài khoản phân quyền
app.post('/api/admin/roles/save-user', adminAuth, async (req, res) => {
  try {
    if (req.adminUser.role !== 'admin_ho') {
      return res.status(403).json({ ok: false, error: 'Chỉ Admin HO mới có quyền phân quyền tài khoản' });
    }

    const { id, larkOpenId, name, email, role, storeCode } = req.body;
    if (!larkOpenId || !name || !role) {
      return res.status(400).json({ ok: false, error: 'Thiếu thông tin: Lark OpenID, Tên hoặc Vai trò' });
    }

    const client = await pool.connect();
    try {
      if (id) {
        // Cập nhật
        await client.query(`
          UPDATE admin_users 
          SET lark_open_id = $1, name = $2, email = $3, role = $4, store_code = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [larkOpenId.trim(), name.trim(), email ? email.trim() : null, role, storeCode || null, id]);
        return res.json({ ok: true, message: 'Cập nhật phân quyền tài khoản thành công!' });
      } else {
        // Thêm mới
        await client.query(`
          INSERT INTO admin_users (lark_open_id, name, email, role, store_code, status)
          VALUES ($1, $2, $3, $4, $5, 'active')
        `, [larkOpenId.trim(), name.trim(), email ? email.trim() : null, role, storeCode || null]);
        return res.json({ ok: true, message: 'Thêm tài khoản phân quyền mới thành công!' });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Lỗi lưu thông tin tài khoản' });
  }
});

// Admin HO xóa / thu hồi quyền tài khoản
app.post('/api/admin/roles/delete-user', adminAuth, async (req, res) => {
  try {
    if (req.adminUser.role !== 'admin_ho') {
      return res.status(403).json({ ok: false, error: 'Chỉ Admin HO mới có quyền xóa tài khoản' });
    }

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: 'Thiếu ID tài khoản' });

    const client = await pool.connect();
    try {
      // Không cho xóa tài khoản chính của chị Giang
      const check = await client.query('SELECT lark_open_id FROM admin_users WHERE id = $1', [id]);
      if (check.rows.length > 0 && check.rows[0].lark_open_id === 'ou_45760cf4c58e0ab0217683d64cd36f65') {
        return res.status(400).json({ ok: false, error: 'Không thể xóa tài khoản Quản trị viên tối cao' });
      }

      await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
      return res.json({ ok: true, message: 'Đã xóa tài khoản thành công!' });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi xóa tài khoản' });
  }
});


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
        const dummyRecoveryHash = await bcrypt.hash('SAKUKO' + Math.floor(Math.random() * 899999 + 100000), 10);
        const newCust = await client.query(
          `INSERT INTO customers (phone, pin_hash, recovery_code_hash, status, must_change_pin)
           VALUES ($1, $2, $3, 'active', TRUE) RETURNING id`,
          [cleanPhone, defaultPinHash, dummyRecoveryHash]
        );
        custId = newCust.rows[0].id;
      } else {
        custId = custRes.rows[0].id;
      }

      // 2. Kiểm tra thẻ active
      const checkCard = await client.query(
        `SELECT id FROM cards WHERE customer_id = $1 AND status IN ('active', 'pending_active')`,
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
        `INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count)
         VALUES ($1, $2, $3, $4, 'active', 0) RETURNING *`,
        [custId, progId, storeCode || 'XT', usableFromStr]
      );

      // 4. Ghi nhận log POS event
      await client.query(
        `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
        ['POS_EXTENSION', 'PURCHASE_CARD', cleanPhone, `Đơn: ${orderNo || 'POS_DIRECT'} - CH: ${storeCode || 'XT'}`]
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



// ==========================================
// WEBHOOK CALLBACK: REALTIME ORDERS & PRODUCTS
// ==========================================

// HARAVAN WEBHOOK VERIFICATION (GET)
app.get('/api/webhook/pos-events', (req, res) => {
  const challenge = req.query['hub.challenge'] || req.query.challenge;
  const verifyToken = req.query['hub.verify_token'] || req.query.verify_token || req.query.token;
  console.log('[HARAVAN WEBHOOK VERIFY GET]', req.query);

  if (challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(200).send('OK');
});

app.post('/api/webhook/pos-events', async (req, res) => {
  try {
    recordWebhookEvent({
      method: req.method,
      path: req.path,
      topic: req.headers['x-haravan-topic'] || req.headers['x-event-type'] || req.body?.event || 'unknown',
      headers: {
        'x-haravan-topic': req.headers['x-haravan-topic'],
        'x-event-type': req.headers['x-event-type'],
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      },
      payload: req.body || {}
    });
  } catch (errCache) {
    console.error('[WEBHOOK CACHE ERROR]', errCache);
  }
  const client = await pool.connect();
  try {
    const payload = req.body || {};
    const eventType = String(req.headers['x-event-type'] || payload.event || payload.type || 'unknown').toLowerCase();
    console.log('[WEBHOOK RECEIVED]', new Date().toISOString(), 'Event:', eventType, 'Order:', payload.order_number || payload.order_no || payload.id, 'Data:', JSON.stringify(payload));

    const orderNo = payload.order_number || payload.order_no || payload.code || payload.order_code || (payload.id ? `HRV_${payload.id}` : null);
    
    // Lấy SĐT từ các nguồn chuẩn của Haravan & POS
    const customerObj = payload.customer || {};
    const billingObj = payload.billing_address || {};
    const shippingObj = payload.shipping_address || {};
    const rawPhone = customerObj.phone || billingObj.phone || shippingObj.phone || payload.customer_phone || payload.phone;

    const storeCode = payload.location_id || payload.store_code || payload.branch_code || 'XT';
    const items = payload.line_items || payload.items || payload.products || [];
    const discounts = payload.discount_codes || payload.discounts || payload.promotions || [];

    // Kiểm tra trạng thái đơn: Phải hoàn thành / đã thanh toán
    const finStatus = String(payload.financial_status || '').toLowerCase();
    const fulfillStatus = String(payload.fulfillment_status || '').toLowerCase();
    const isPaidEvent = eventType.includes('paid') || eventType.includes('fulfilled') || eventType.includes('completed');
    const isPaidStatus = finStatus === 'paid' || fulfillStatus === 'fulfilled' || payload.send_paid === true || payload.status === 'completed';
    const isCancelled = payload.cancelled_at || payload.cancel_reason || finStatus === 'voided' || finStatus === 'refunded';

    if (rawPhone && !isCancelled) {
      // Chuẩn hóa và xác thực số điện thoại
      let cleanPhone = String(rawPhone).trim().replace(/\s+/g, '').replace(/^(\+84|84)/, '0');
      const isValidVnPhone = /^0(3|5|7|8|9)[0-9]{8}$/.test(cleanPhone);

      if (!isValidVnPhone) {
        console.log(`[WEBHOOK SKIPPED] Số điện thoại không hợp lệ: "${rawPhone}" -> "${cleanPhone}"`);
        return res.status(200).json({ ok: true, message: 'Số điện thoại không hợp lệ, bỏ qua' });
      }

      await client.query('BEGIN');

      // 1. Tìm hoặc tự động tạo customer theo đúng SĐT
      let custRes = await client.query('SELECT * FROM customers WHERE phone = $1', [cleanPhone]);
      let custId;
      if (custRes.rows.length === 0) {
        const defaultPinHash = await bcrypt.hash('123456', 10);
        const dummyRecoveryHash = await bcrypt.hash('SAKUKO' + Math.floor(Math.random() * 899999 + 100000), 10);
        const newCust = await client.query(
          `INSERT INTO customers (phone, pin_hash, recovery_code_hash, status, must_change_pin)
           VALUES ($1, $2, $3, 'active', TRUE) RETURNING id`,
          [cleanPhone, defaultPinHash, dummyRecoveryHash]
        );
        custId = newCust.rows[0].id;
      } else {
        custId = custRes.rows[0].id;
      }

      // Lấy chương trình đang active
      const progRes = await client.query('SELECT * FROM programs WHERE status = $1 LIMIT 1', ['active']);
      const activeProg = progRes.rows[0];

      // CASE 1: KIỂM TRA ĐƠN HÀNG CÓ MÃ BARCODE RTD.TP00013 -> KÍCH HOẠT THẺ
      // Điều kiện: Đơn phải ở trạng thái đã thanh toán / hoàn thành (isPaidStatus hoặc isPaidEvent)
      const isEligibleToActivate = isPaidStatus || isPaidEvent || !payload.financial_status; // fallback nếu pos không gửi financial_status

      const cardItem = items.find(it => {
        const barcode = String(it.barcode || '').trim().toUpperCase();
        const sku = String(it.sku || it.item_code || it.product_code || '').trim().toUpperCase();
        const name = String(it.name || it.title || it.product_name || '').toUpperCase();
        return barcode === '2025041800002' || sku === '2025041800002' ||
               barcode === 'RTD.TP00013' || sku === 'RTD.TP00013' ||
               barcode === '8936000000018' || sku === 'SP_NBT_XUANTHUY' ||
               name.includes('2025041800002') || name.includes('RTD.TP00013') || 
               name.includes('SAKUKO DAILY') || name.includes('THẺ NBT') || name.includes('THẺ TRÀ');
      });

      if (cardItem) {
        if (!isEligibleToActivate) {
          console.log(`[WEBHOOK HOLD] Đơn ${orderNo} có barcode RTD.TP00013 nhưng chưa hoàn thành thanh toán (financial_status: ${finStatus})`);
        } else {
          const checkCard = await client.query(
            `SELECT id FROM cards WHERE customer_id = $1 AND status IN ('active', 'pending_active')`,
            [custId]
          );
          if (checkCard.rows.length === 0) {
            const tomorrow = new Date();
            const usableFromStr = new Date().toISOString().split('T')[0];
            const progId = activeProg ? activeProg.id : 1;

            const insertedCard = await client.query(
              `INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count, order_no) VALUES ($1, $2, $3, CURRENT_DATE, 'active', 0, $4) RETURNING id`,
              [custId, progId, storeCode, orderNo || null]
            );

            await client.query(
              `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
              ['HARAVAN_WEBHOOK', 'CARD_ACTIVATED_BARCODE', `customer:${cleanPhone}`, JSON.stringify({
                orderNo,
                barcode: cardItem.barcode || cardItem.sku || 'RTD.TP00013',
                financial_status: finStatus || 'paid',
                cardId: insertedCard.rows[0].id
              })]
            );
            console.log(`[WEBHOOK ACTIVATED CARD] SĐT: ${cleanPhone}, Đơn: ${orderNo}, Barcode: RTD.TP00013, Status: PAID`);
          } else {
            console.log(`[WEBHOOK INFO] Khách ${cleanPhone} đã có thẻ active (${checkCard.rows[0].id}), không tạo trùng`);
          }
        }
      }

      // CASE 2: KIỂM TRA ĐƠN HÀNG CÓ SỬ DỤNG VOUCHER NBT KHÔNG -> TĂNG LƯỢT DÙNG
      const hasNbtVoucher = discounts.some(d => {
        const code = String(d.code || d.voucher_code || d.name || '').toUpperCase();
        return code.includes('DAILY5K') || code.includes('DAILY10K') || code.includes('NBT');
      }) || items.some(it => {
        const sku = String(it.sku || it.item_code || '').toUpperCase();
        return sku.includes('DAILY5K') || sku.includes('DAILY10K');
      });

      if (hasNbtVoucher && isEligibleToActivate) {
        const cardRes = await client.query(
          `SELECT * FROM cards WHERE customer_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [custId]
        );
        if (cardRes.rows.length > 0) {
          const card = cardRes.rows[0];
          const newUsesCount = Number(card.uses_count) + 1;
          const isBig = (newUsesCount === 5 || newUsesCount === 10);
          const discountVal = isBig ? 10000 : 5000;
          const voucherCode = isBig ? (activeProg?.voucher_10k || 'DAILY10K') : (activeProg?.voucher_5k || 'DAILY5K');
          const newStatus = newUsesCount >= 10 ? 'used_up' : 'active';

          await client.query(
            `INSERT INTO redemptions (card_id, customer_id, use_no, order_no, discount, store_code, voucher_code, source, valid)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'haravan_webhook', true)`,
            [card.id, custId, newUsesCount, orderNo || 'POS_WEBHOOK', discountVal, storeCode, voucherCode]
          );

          await client.query(
            `UPDATE cards SET uses_count = $1, status = $2, updated_at = NOW() WHERE id = $3`,
            [newUsesCount, newStatus, card.id]
          );

          await client.query(
            `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
            ['HARAVAN_WEBHOOK', 'VOUCHER_REDEEMED', `card:${card.id}`, JSON.stringify({ orderNo, newUsesCount, discountVal, storeCode })]
          );
          console.log(`[WEBHOOK REDEEMED VOUCHER] SĐT: ${cleanPhone}, Lượt: #${newUsesCount}, Trạng thái: ${newStatus}`);
        }
      }

      await client.query('COMMIT');
    }

    return res.status(200).json({ ok: true, received_at: new Date().toISOString() });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[WEBHOOK ERROR]', err);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ==========================================
// CƠ CHẾ DỰ PHÒNG: TỰ ĐỘNG ĐỒNG BỘ ĐƠN HÀNG TỪ HARAVAN QUA TOKEN
// ==========================================
const HARAVAN_PRIVATE_TOKEN = '596EE140311D1CC2AE8A1C6DF8E9E4E7F5F0A2D53B7A49C414F23069BDF58434';
let isSyncingHaravan = false;

async function syncRecentHaravanOrders() {
  if (isSyncingHaravan) return;
  isSyncingHaravan = true;
  try {
    const url = 'https://apis.haravan.com/com/orders.json?limit=20';
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${HARAVAN_PRIVATE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const orders = data.orders || [];

    for (const order of orders) {
      const items = order.line_items || [];
      const hasCardBarcode = items.some(it => {
        const b = String(it.barcode || '').trim();
        const s = String(it.sku || '').trim();
        return b === '2025041800002' || s === '2025041800002' || b === 'RTD.TP00013' || s === 'RTD.TP00013';
      });

      if (!hasCardBarcode) continue;

      const finStatus = String(order.financial_status || '').toLowerCase();
      const fulfillStatus = String(order.fulfillment_status || '').toLowerCase();
      const isPaid = finStatus === 'paid' || fulfillStatus === 'fulfilled';
      if (!isPaid) continue;

      const cust = order.customer || order.billing_address || order.shipping_address || {};
      const rawPhone = cust.phone;
      if (!rawPhone) continue;

      const cleanPhone = String(rawPhone).trim().replace(/\s+/g, '').replace(/^(\+84|84)/, '0');
      if (!/^0(3|5|7|8|9)[0-9]{8}$/.test(cleanPhone)) continue;

      // Kích hoạt qua handler nội bộ
      const client = await pool.connect();
      try {
        await client.query('SET search_path TO the_nbt;');
        const custRes = await client.query('SELECT id FROM customers WHERE phone = $1', [cleanPhone]);
        let custId;
        if (custRes.rows.length === 0) {
          const defaultPinHash = await bcrypt.hash('123456', 10);
          const dummyRecoveryHash = await bcrypt.hash('SAKUKO' + Math.floor(Math.random() * 899999 + 100000), 10);
          const newCust = await client.query(
            `INSERT INTO customers (phone, pin_hash, recovery_code_hash, status)
             VALUES ($1, $2, $3, 'active') RETURNING id`,
            [cleanPhone, defaultPinHash, dummyRecoveryHash]
          );
          custId = newCust.rows[0].id;
        } else {
          custId = custRes.rows[0].id;
        }

        const checkCard = await client.query(
          `SELECT id FROM cards WHERE customer_id = $1 AND status IN ('active', 'pending_active')`,
          [custId]
        );

        if (checkCard.rows.length === 0) {
          const progRes = await client.query("SELECT id FROM programs WHERE status = 'active' LIMIT 1");
          const progId = progRes.rows.length > 0 ? progRes.rows[0].id : 1;
          const storeCode = order.location_id || 'XT';
          const orderNo = order.order_number || ('HRV_' + order.id);

          const insertedCard = await client.query(
            `INSERT INTO cards (customer_id, program_id, store_code, usable_from, status, uses_count, order_no)
             VALUES ($1, $2, $3, CURRENT_DATE, 'active', 0, $4) RETURNING id`,
            [custId, progId, storeCode, orderNo]
          );

          await client.query(
            `INSERT INTO audit_log (actor, action, target, detail) VALUES ($1, $2, $3, $4)`,
            ['HARAVAN_REALTIME_SYNC', 'CARD_ACTIVATED_BARCODE', `customer:${cleanPhone}`, JSON.stringify({
              orderNo,
              barcode: '2025041800002',
              financial_status: finStatus,
              cardId: insertedCard.rows[0].id
            })]
          );
          console.log(`[REALTIME SYNC ACTIVATED] SĐT: ${cleanPhone}, Đơn: ${orderNo}`);
        }
      } catch (err) {
        console.error('[SYNC ORDER ERR]', err.message);
      } finally {
        client.release();
      }
    }
  } catch (e) {
    console.error('[SYNC HARAVAN ERR]', e.message);
  } finally {
    isSyncingHaravan = false;
  }
}

// Chạy quét đồng bộ mỗi 30 giây
setInterval(syncRecentHaravanOrders, 30 * 1000);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Web Thẻ NBT service is running at http://127.0.0.1:${PORT}`);
});

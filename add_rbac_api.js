const fs = require('fs');
const serverFile = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

const rbacCode = `
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
        await client.query(\`
          UPDATE admin_users 
          SET lark_open_id = $1, name = $2, email = $3, role = $4, store_code = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        \`, [larkOpenId.trim(), name.trim(), email ? email.trim() : null, role, storeCode || null, id]);
        return res.json({ ok: true, message: 'Cập nhật phân quyền tài khoản thành công!' });
      } else {
        // Thêm mới
        await client.query(\`
          INSERT INTO admin_users (lark_open_id, name, email, role, store_code, status)
          VALUES ($1, $2, $3, $4, $5, 'active')
        \`, [larkOpenId.trim(), name.trim(), email ? email.trim() : null, role, storeCode || null]);
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
`;

if (!content.includes('/api/admin/roles/users')) {
  content = content.replace("// Fallback SPA", rbacCode + "\n// Fallback SPA");
  fs.writeFileSync(serverFile, content);
  console.log('Added RBAC endpoints to server.js');
} else {
  console.log('RBAC endpoints already exist');
}

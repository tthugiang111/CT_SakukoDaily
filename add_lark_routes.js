const fs = require('fs');

const serverFile = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// Định nghĩa cơ chế OAuth Lark và chặn strict: CHỈ cho phép Trần Thị Thu Giang
const larkOAuthCode = `
// ==========================================
// LARK OAUTH AUTHENTICATION (STRICT ADMIN HO)
// ==========================================
const LARK_APP_ID = process.env.LARK_APP_ID || 'cli_aaf7321fa3f8ded1';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';
const LARK_DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com';
const LARK_REDIRECT_URI = process.env.LARK_REDIRECT_URI || 'https://terminology-bye-clay-gay.trycloudflare.com/api/admin/lark/callback';

// DUY NHẤT một tài khoản được cấp quyền Admin HO: Trần Thị Thu Giang
const STRICT_ADMIN_OPEN_ID = 'ou_45760cf4c58e0ab0217683d64cd36f65';

app.get('/api/admin/lark/login', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  res.cookie('lark_oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });
  const authUrl = \`\${LARK_DOMAIN}/open-apis/authen/v1/authorize?client_id=\${LARK_APP_ID}&app_id=\${LARK_APP_ID}&redirect_uri=\${encodeURIComponent(LARK_REDIRECT_URI)}&state=\${state}\`;
  return res.redirect(authUrl);
});

app.get('/api/admin/lark/callback', async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies.lark_oauth_state;

  if (!code) {
    return res.status(400).send('<h3>Đăng nhập Lark thất bại: Thiếu mã code</h3><p><a href="/admin.html">Quay lại</a></p>');
  }

  try {
    // 1. Lấy user_access_token từ Lark
    const tokenRes = await fetch(\`\${LARK_DOMAIN}/open-apis/authen/v1/access_token\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: LARK_APP_ID,
        app_id: LARK_APP_ID,
        app_secret: LARK_APP_SECRET,
        code
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
      console.error('[Lark Token Error]', tokenData);
      return res.status(403).send(\`<h3>Lỗi xác thực Lark: \${tokenData.msg}</h3><p><a href="/admin.html">Quay lại</a></p>\`);
    }

    const { open_id, name, avatar_url } = tokenData.data;

    // 2. KIỂM TRA QUYỀN NGHIÊM NGẶT (CHỈ DUY NHẤT TRẦN THỊ THU GIANG)
    if (open_id !== STRICT_ADMIN_OPEN_ID) {
      return res.status(403).send(\`
        <div style="font-family: sans-serif; max-width: 500px; margin: 80px auto; padding: 24px; border: 1px solid #fda4af; border-radius: 12px; background: #fff1f2; color: #9f1239;">
          <h2 style="margin-top: 0;">Truy cập bị từ chối!</h2>
          <p>Tài khoản Lark: <b>\${name || open_id}</b> không có quyền truy cập hệ thống quản trị Sakuko Daily.</p>
          <p style="font-size: 13px; color: #881337;">Hệ thống chỉ cấp quyền toàn quyền duy nhất cho Quản trị viên HO (Trần Thị Thu Giang).</p>
          <hr style="border: none; border-top: 1px solid #fecdd3; margin: 16px 0;" />
          <a href="/admin.html" style="display: inline-block; padding: 8px 16px; background: #e11d48; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">Quay lại Cổng Admin</a>
        </div>
      \`);
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
    res.cookie('nbt_admin_token', token, { httpOnly: true, maxAge: 7 * 86400 * 1000 });

    // Chuyển hướng về admin.html
    return res.redirect('/admin.html');
  } catch (err) {
    console.error('[Lark OAuth Error]', err);
    return res.status(500).send('<h3>Lỗi hệ thống trong quá trình đăng nhập Lark</h3>');
  }
});
`;

if (!content.includes('/api/admin/lark/login')) {
  content = content.replace("// Fallback SPA", larkOAuthCode + "\n// Fallback SPA");
  fs.writeFileSync(serverFile, content);
  console.log('Added Lark OAuth routes to server.js');
} else {
  console.log('Lark OAuth routes already exist');
}

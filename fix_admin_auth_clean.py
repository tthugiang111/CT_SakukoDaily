import re

# 1. Cập nhật server.js:
# - app.get('/admin') bắt buộc kiểm tra cookie nbt_admin_token. Nếu chưa đăng nhập -> chuyển hướng ngay sang /admin-login
# - Hoặc nếu chưa đăng nhập -> serve trang login riêng / chặn tuyệt đối, không gửi file admin.html ra.
server_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js'
with open(server_path, 'r', encoding='utf-8') as f:
    server_code = f.read()

# Sửa adminAuth chỉ dùng nbt_admin_token
server_code = re.sub(
    r'function adminAuth\(req, res, next\) \{[\s\S]*?const token = .*?;',
    '''function adminAuth(req, res, next) {
  const token = req.cookies.nbt_admin_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);''',
    server_code
)

# Sửa route /admin: Server-side check auth trước khi trả file HTML
admin_gate_code = """
// Route kiểm soát truy cập Cổng Quản Trị Admin
app.get('/admin', (req, res) => {
  const token = req.cookies.nbt_admin_token;
  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin_ho', 'store_manager'].includes(decoded.role)) {
      return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
    }
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } catch (err) {
    return res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
  }
});

app.get('/api/admin/logout', (req, res) => {
  res.clearCookie('nbt_admin_token', { path: '/' });
  return res.redirect('/admin');
});
"""

server_code = re.sub(
    r'// Route sạch không đuôi cho Cổng Quản Trị Admin[\s\S]*?res\.sendFile\(path\.join\(__dirname, \'public\', \'admin\.html\'\)\);\s*\}\);',
    admin_gate_code.strip(),
    server_code
)

with open(server_path, 'w', encoding='utf-8') as f:
    f.write(server_code)

print("Updated server.js with strict server-side admin guard")

# 2. Tạo trang đăng nhập Lark chuyên biệt: public/admin_login.html
login_html = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng Nhập Quản Trị · Thẻ NBT Sakuko</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .sakuko-gradient { background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
    <div class="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-3xl border border-rose-500/20">
      <i class="fa-solid fa-shield-halved"></i>
    </div>
    
    <div class="space-y-2">
      <div class="inline-block px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-wider">
        Khu Vực Quản Trị Hệ Thống
      </div>
      <h1 class="text-xl font-black text-white tracking-tight">Hệ Thống Thẻ Thành Viên NBT</h1>
      <p class="text-xs text-slate-400 leading-relaxed">
        Trang này yêu cầu xác thực bảo mật cấp cao. Vui lòng đăng nhập bằng tài khoản <b>Lark Suite</b> của tổ chức để được cấp quyền quản trị.
      </p>
    </div>

    <div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-700/60 text-left text-xs text-slate-300 space-y-2">
      <div class="font-bold text-white flex items-center">
        <i class="fa-solid fa-lock text-emerald-400 mr-2"></i> Yêu cầu truy cập:
      </div>
      <p class="text-[11px] text-slate-400 leading-relaxed">• Đăng nhập tài khoản Lark Suite chính thức được phân quyền Admin HO.</p>
      <p class="text-[11px] text-slate-400 leading-relaxed">• Xác thực định danh qua OpenID trước khi cấp phiên làm việc.</p>
    </div>

    <div class="pt-2">
      <a href="/api/admin/lark/login"
        class="w-full py-4 rounded-2xl bg-[#00D6B9] hover:bg-[#00c2a7] text-slate-950 font-black text-sm shadow-lg shadow-teal-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2.5">
        <i class="fa-solid fa-arrow-right-to-bracket text-base"></i>
        <span>Đăng Nhập Bằng Lark Suite</span>
      </a>
    </div>

    <div class="text-[11px] text-slate-500 pt-2">
      Sakuko Vietnam Retail Management · Phiên bản 2.4
    </div>
  </div>
</body>
</html>
"""

with open('/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin_login.html', 'w', encoding='utf-8') as f:
    f.write(login_html)

print("Created admin_login.html")

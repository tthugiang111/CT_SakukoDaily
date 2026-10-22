const fs = require('fs');

const adminHtmlPath = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html';
let html = fs.readFileSync(adminHtmlPath, 'utf8');

// Thay đổi header: bỏ selector chọn tài khoản, thêm nút "Đăng nhập bằng Lark" trực tiếp hoặc hiển thị profile Trần Thị Thu Giang
// Đảm bảo nếu chưa đăng nhập qua Lark, hiện modal/overlay bắt buộc bấm "Đăng nhập bằng Lark"
const newHeaderUserSection = `
    <!-- User Profile & Lark Auth -->
    <div class="flex items-center space-x-3">
      <div id="loggedOutSection" class="hidden flex items-center space-x-2">
        <a href="/api/admin/lark/login" class="px-4 py-2 rounded-xl sakuko-gradient text-white text-xs font-bold shadow-sm hover:opacity-95 transition flex items-center">
          <i class="fa-brands fa-slack mr-2 text-sm"></i> Đăng nhập bằng Lark
        </a>
      </div>

      <div id="loggedInSection" class="flex items-center space-x-3">
        <div class="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <img id="adminAvatarImg" src="https://ui-avatars.com/api/?name=Giang+Tran&background=e11d48&color=fff" class="w-7 h-7 rounded-lg object-cover border border-rose-200" />
          <div class="text-left text-xs leading-tight">
            <span id="currentAdminName" class="font-bold text-slate-900 block">Trần Thị Thu Giang</span>
            <span id="currentAdminRoleBadge" class="text-[10px] font-semibold text-rose-600">Admin HO (Toàn quyền duy nhất)</span>
          </div>
        </div>

        <button onclick="loadAllAdminData()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center">
          <i class="fa-solid fa-rotate mr-1.5"></i> Làm mới
        </button>

        <button onclick="handleLogout()" title="Đăng xuất" class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
`;

// Thay thế đoạn profile cũ
html = html.replace(/<!-- User Profile & Switcher -->[\s\S]*?<\/header>/, newHeaderUserSection + '\n  </header>');

// Thêm Modal / Overlay cảnh báo khi chưa đăng nhập hoặc đăng nhập sai
const authGuardOverlay = `
  <!-- Overlay Bắt Buộc Đăng Nhập Lark -->
  <div id="larkAuthOverlay" class="hidden fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="card-clean max-w-md w-full p-6 rounded-3xl bg-white shadow-2xl text-center space-y-4 border border-rose-200">
      <div class="w-14 h-14 rounded-2xl sakuko-gradient text-white flex items-center justify-center text-2xl mx-auto shadow-md">
        <i class="fa-brands fa-slack"></i>
      </div>
      <div>
        <h3 class="text-base font-black text-slate-900">Yêu Cầu Đăng Nhập Lark Quản Trị</h3>
        <p class="text-xs text-slate-500 mt-1">Cổng Admin Sakuko Daily chỉ dành riêng cho tài khoản quản trị HO được phân quyền.</p>
      </div>
      <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 text-left">
        <i class="fa-solid fa-shield-halved mr-1 text-rose-600"></i>
        <b>Chính sách bảo mật:</b> Chỉ duy nhất tài khoản Lark của <b>Trần Thị Thu Giang</b> được cấp quyền truy cập hệ thống.
      </div>
      <a href="/api/admin/lark/login" class="w-full py-3 rounded-2xl sakuko-gradient text-white font-bold text-sm shadow-md hover:opacity-95 transition flex items-center justify-center">
        <i class="fa-brands fa-slack mr-2 text-base"></i> Đăng nhập qua Lark ngay
      </a>
    </div>
  </div>
`;

html = html.replace('</body>', authGuardOverlay + '\n</body>');

// Cập nhật lại JS trong admin.html
const newScriptPart = `
  <script>
    let currentAdmin = null;
    let detailedData = null;

    function switchView(viewName) {
      ['overview', 'funnel', 'violations', 'dormant', 'pin', 'pos', 'programs'].forEach(name => {
        const el = document.getElementById('view-' + name);
        const nav = document.getElementById('nav-' + name);
        if (el) el.classList.add('hidden');
        if (nav) nav.classList.remove('active');
      });
      const targetEl = document.getElementById('view-' + viewName);
      const targetNav = document.getElementById('nav-' + viewName);
      if (targetEl) targetEl.classList.remove('hidden');
      if (targetNav) targetNav.classList.add('active');
    }

    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        if (!data.ok || !data.user) {
          showAuthOverlay();
          return false;
        }

        // Kiểm tra strict đúng Trần Thị Thu Giang (ou_45760cf4c58e0ab0217683d64cd36f65)
        if (data.user.openId !== 'ou_45760cf4c58e0ab0217683d64cd36f65') {
          alert('Từ chối truy cập: Tài khoản không phải Trần Thị Thu Giang!');
          showAuthOverlay();
          return false;
        }

        currentAdmin = data.user;
        document.getElementById('loggedOutSection').classList.add('hidden');
        document.getElementById('loggedInSection').classList.remove('hidden');
        document.getElementById('larkAuthOverlay').classList.add('hidden');

        document.getElementById('currentAdminName').innerText = currentAdmin.name;
        if (currentAdmin.avatar) {
          document.getElementById('adminAvatarImg').src = currentAdmin.avatar;
        }

        return true;
      } catch (e) {
        showAuthOverlay();
        return false;
      }
    }

    function showAuthOverlay() {
      document.getElementById('loggedOutSection').classList.remove('hidden');
      document.getElementById('loggedInSection').classList.add('hidden');
      document.getElementById('larkAuthOverlay').classList.remove('hidden');
    }

    async function handleLogout() {
      document.cookie = 'nbt_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      window.location.reload();
    }

    async function initAdminPC() {
      const isAuthed = await checkAuth();
      if (isAuthed) {
        await loadAllAdminData();
      }
    }
`;

html = html.replace(/<script>[\s\S]*?async function initAdminPC\(\) \{[\s\S]*?loadPinRequests\(\);\s*\}\s*catch \(err\) \{[\s\S]*?\}\s*\}/, newScriptPart + `
    async function loadAllAdminData() {
      try {
        const res = await fetch('/api/admin/detailed-reports');
        const data = await res.json();
        if (!data.ok) return;
        detailedData = data;

        renderOverview(data);
        renderFunnel(data.funnel);
        renderViolations(data.violations);
        renderDormant(data.dormantCards);
        renderPosDevices(data.posDevices);
        renderProgramsAndStores(data.programs, data.stores);
        loadPinRequests();
      } catch (err) {
        console.error(err);
      }
    }`);

fs.writeFileSync(adminHtmlPath, html);
console.log('admin.html updated with Lark Login flow & strict user guard!');

import re

html_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update switchView list if needed
html = html.replace(
    "['overview', 'funnel', 'violations', 'dormant', 'pin', 'pos', 'programs']",
    "['overview', 'funnel', 'violations', 'dormant', 'pin', 'pos', 'programs', 'roles']"
)

# 2. Check if view-roles is in html
if 'id="view-roles"' not in html:
    rbac_view = """
      <!-- ============================================ -->
      <!-- VIEW 8: BẢNG PHÂN QUYỀN VAI TRÒ (RBAC)       -->
      <!-- ============================================ -->
      <div id="view-roles" class="hidden space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-black text-slate-900 tracking-tight">Bảng Phân Quyền Vai Trò (Admin HO & Cửa Hàng Trưởng)</h2>
            <p class="text-xs text-slate-500">Quản lý quyền hạn truy cập: CHT gửi request cấp lại mã PIN, Admin HO duyệt cấp mã</p>
          </div>
          <button onclick="openAddUserModal()" class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm flex items-center">
            <i class="fa-solid fa-user-plus mr-1.5"></i> Cấp Quyền Tài Khoản Mới
          </button>
        </div>

        <!-- Bảng Phân Quyền -->
        <div class="card-clean p-5 rounded-2xl space-y-4">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 border-b border-slate-100">
                  <th class="pb-2.5">Tên Cán Bộ / Quản Lý</th>
                  <th class="pb-2.5">Lark Open ID</th>
                  <th class="pb-2.5">Email</th>
                  <th class="pb-2.5">Vai Trò Phân Bổ</th>
                  <th class="pb-2.5">Cửa Hàng Quản Lý</th>
                  <th class="pb-2.5">Quyền Hạn Thực Thi</th>
                  <th class="pb-2.5 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody id="tableRolesBody" class="divide-y divide-slate-100"></tbody>
            </table>
          </div>
        </div>

        <!-- Bảng Ma Trận Quyền Hạn -->
        <div class="card-clean p-5 rounded-2xl space-y-3 bg-purple-50/50 border border-purple-200">
          <h3 class="text-xs font-black uppercase text-purple-900 tracking-wide flex items-center">
            <i class="fa-solid fa-shield-halved mr-2 text-purple-600"></i> Ma Trận Quyền Hạn Nghiệp Vụ
          </h3>
          <div class="grid grid-cols-2 gap-4 text-xs pt-1">
            <div class="p-3.5 rounded-xl bg-white border border-purple-100 space-y-1.5">
              <div class="font-bold text-rose-700 flex items-center">
                <span class="w-2 h-2 rounded-full bg-rose-600 mr-2"></span> Admin HO (Toàn Quyền Hệ Thống)
              </div>
              <ul class="text-[11px] text-slate-600 space-y-1 pl-4 list-disc">
                <li>Xem toàn bộ số liệu, doanh thu, AOV, phễu giữ chân toàn chuỗi.</li>
                <li><b>Duyệt cấp mã PIN tạm / mã bí mật</b> khi CHT gửi request lên.</li>
                <li>Thêm, sửa, thu hồi quyền hạn Admin & Cửa hàng trưởng.</li>
                <li>Tạo và quản lý Token kết nối máy POS Extension.</li>
              </ul>
            </div>
            <div class="p-3.5 rounded-xl bg-white border border-purple-100 space-y-1.5">
              <div class="font-bold text-blue-700 flex items-center">
                <span class="w-2 h-2 rounded-full bg-blue-600 mr-2"></span> Cửa Hàng Trưởng (Store Manager)
              </div>
              <ul class="text-[11px] text-slate-600 space-y-1 pl-4 list-disc">
                <li>Chỉ xem số liệu bán thẻ và danh sách lỗi dùng sai tại điểm bán của mình.</li>
                <li><b>Tạo request gửi lên Admin HO</b> để xin cấp lại mã cho khách quên PIN tại quầy.</li>
                <li>Không được phép tự ý cấp đổi PIN trực tiếp nếu không qua Admin duyệt.</li>
                <li>Không có quyền truy cập cấu hình hệ thống hoặc token máy POS.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
"""
    html = html.replace('<!-- VIEW 7: CHƯƠNG TRÌNH & CỬA HÀNG              -->', rbac_view + '\n      <!-- VIEW 7: CHƯƠNG TRÌNH & CỬA HÀNG              -->')

if 'id="nav-roles"' not in html:
    old_nav = '<button onclick="switchView(\'programs\')" id="nav-programs"'
    rbac_nav = '<button onclick="switchView(\'roles\')" id="nav-roles" class="sidebar-link w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"><i class="fa-solid fa-users-gear w-4 text-center text-purple-600"></i><span>Phân Quyền Vai Trò (RBAC)</span></button>\n        ' + old_nav
    html = html.replace(old_nav, rbac_nav)

if 'id="roleUserModal"' not in html:
    modal_html = """
  <!-- Modal Thêm/Sửa Cấp Quyền Tài Khoản -->
  <div id="roleUserModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="card-clean max-w-md w-full p-6 rounded-3xl bg-white shadow-2xl space-y-4 border border-purple-200">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 id="modalTitle" class="text-sm font-black text-slate-900">Cấp Quyền Tài Khoản Quản Trị</h3>
        <button onclick="closeRoleModal()" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <input type="hidden" id="modalUserId" />
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Họ và Tên</label>
          <input type="text" id="modalUserName" placeholder="VD: Nguyễn Văn A" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Lark Open ID (bắt buộc)</label>
          <input type="text" id="modalUserLarkId" placeholder="ou_xxxxxxxxxxxxxxxx" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Email công việc</label>
          <input type="email" id="modalUserEmail" placeholder="a.nguyen@sakuko.com.vn" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Vai Trò (Role)</label>
            <select id="modalUserRole" onchange="toggleStoreSelect()" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold">
              <option value="store_manager">Cửa Hàng Trưởng (CHT)</option>
              <option value="admin_ho">Admin HO (Toàn quyền)</option>
            </select>
          </div>
          <div id="modalStoreGroup">
            <label class="block font-bold text-slate-700 mb-1">Cửa Hàng Phụ Trách</label>
            <select id="modalUserStore" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold">
              <option value="XT">XT - Xuân Thủy</option>
              <option value="KM">KM - Kim Mã</option>
              <option value="TB">TB - Thái Hà</option>
            </select>
          </div>
        </div>
      </div>
      <div class="flex justify-end space-x-2 pt-2">
        <button onclick="closeRoleModal()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">Hủy</button>
        <button onclick="saveRoleUser()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm">Lưu Cấp Quyền</button>
      </div>
    </div>
  </div>
"""
    html = html.replace('</body>', modal_html + '\n</body>')

# 3. Add JS functions
js_funcs = """
    let rolesUsersList = [];

    async function loadRolesUsers() {
      try {
        const res = await fetch('/api/admin/roles/users', { credentials: 'include' });
        const data = await res.json();
        if (!data.ok) return;
        rolesUsersList = data.users || [];
        renderRolesUsers(rolesUsersList);
      } catch (e) {
        console.error('Lỗi tải danh sách phân quyền:', e);
      }
    }

    function renderRolesUsers(users) {
      const tbody = document.getElementById('tableRolesBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400">Chưa có tài khoản phân quyền.</td></tr>';
        return;
      }
      users.forEach(u => {
        const isAdmin = u.role === 'admin_ho';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
          <td class="py-2.5 font-bold text-slate-900">${u.name}</td>
          <td class="py-2.5 font-mono text-slate-600">${u.lark_open_id}</td>
          <td class="py-2.5 text-slate-500">${u.email || '-'}</td>
          <td class="py-2.5">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isAdmin ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}">
              ${isAdmin ? 'ADMIN HO' : 'CỬA HÀNG TRƯỞNG'}
            </span>
          </td>
          <td class="py-2.5 font-bold text-slate-700">${isAdmin ? 'Toàn chuỗi (ALL)' : (u.store_code || 'Chưa gán')}</td>
          <td class="py-2.5 text-slate-600 text-[11px]">
            ${isAdmin 
              ? '<span class="text-rose-600 font-bold"><i class="fa-solid fa-stamp mr-1"></i> Duyệt cấp PIN / Toàn quyền</span>' 
              : '<span class="text-blue-600 font-semibold"><i class="fa-solid fa-paper-plane mr-1"></i> Gửi request xin cấp mã</span>'}
          </td>
          <td class="py-2.5 text-right space-x-1">
            <button onclick="openEditUserModal(${u.id})" class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            ${u.lark_open_id !== 'ou_45760cf4c58e0ab0217683d64cd36f65' 
              ? `<button onclick="deleteUserRole(${u.id}, '${u.name}')" class="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold"><i class="fa-solid fa-trash"></i></button>`
              : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function toggleStoreSelect() {
      const role = document.getElementById('modalUserRole').value;
      const storeGroup = document.getElementById('modalStoreGroup');
      if (role === 'admin_ho') {
        storeGroup.classList.add('hidden');
      } else {
        storeGroup.classList.remove('hidden');
      }
    }

    function openAddUserModal() {
      document.getElementById('modalTitle').innerText = 'Cấp Quyền Tài Khoản Quản Trị Mới';
      document.getElementById('modalUserId').value = '';
      document.getElementById('modalUserName').value = '';
      document.getElementById('modalUserLarkId').value = '';
      document.getElementById('modalUserEmail').value = '';
      document.getElementById('modalUserRole').value = 'store_manager';
      document.getElementById('modalUserStore').value = 'XT';
      toggleStoreSelect();
      document.getElementById('roleUserModal').classList.remove('hidden');
    }

    function openEditUserModal(userId) {
      const u = rolesUsersList.find(x => Number(x.id) === Number(userId));
      if (!u) return;
      document.getElementById('modalTitle').innerText = 'Sửa Phân Quyền: ' + u.name;
      document.getElementById('modalUserId').value = u.id;
      document.getElementById('modalUserName').value = u.name;
      document.getElementById('modalUserLarkId').value = u.lark_open_id;
      document.getElementById('modalUserEmail').value = u.email || '';
      document.getElementById('modalUserRole').value = u.role;
      document.getElementById('modalUserStore').value = u.store_code || 'XT';
      toggleStoreSelect();
      document.getElementById('roleUserModal').classList.remove('hidden');
    }

    function closeRoleModal() {
      document.getElementById('roleUserModal').classList.add('hidden');
    }

    async function saveRoleUser() {
      const id = document.getElementById('modalUserId').value;
      const name = document.getElementById('modalUserName').value.trim();
      const larkOpenId = document.getElementById('modalUserLarkId').value.trim();
      const email = document.getElementById('modalUserEmail').value.trim();
      const role = document.getElementById('modalUserRole').value;
      const storeCode = role === 'admin_ho' ? null : document.getElementById('modalUserStore').value;

      if (!name || !larkOpenId) return alert('Vui lòng điền họ tên và Lark Open ID!');

      try {
        const res = await fetch('/api/admin/roles/save-user', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id || undefined, name, larkOpenId, email, role, storeCode })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message);
        closeRoleModal();
        loadRolesUsers();
      } catch (e) {
        alert('Lỗi lưu thông tin phân quyền');
      }
    }

    async function deleteUserRole(id, name) {
      if (!confirm('Xác nhận thu hồi quyền truy cập của: ' + name + '?')) return;
      try {
        const res = await fetch('/api/admin/roles/delete-user', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message);
        loadRolesUsers();
      } catch (e) {
        alert('Lỗi xóa quyền tài khoản');
      }
    }
"""

if 'loadRolesUsers();' not in html:
    html = html.replace('loadPinRequests();', 'loadPinRequests();\n        loadRolesUsers();')

if 'function renderRolesUsers' not in html:
    html = html.replace("window.addEventListener('DOMContentLoaded'", js_funcs + "\n    window.addEventListener('DOMContentLoaded'")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Applied RBAC frontend successfully!")

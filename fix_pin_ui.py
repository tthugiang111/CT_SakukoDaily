import re

html_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Thay thế khối view-pin để chia rẽ nhánh theo role
old_pin_view_pattern = r'<!-- ============================================ -->\s*<!-- VIEW 5: QUẢN LÝ & DUYỆT PIN                  -->[\s\S]*?<!-- ============================================ -->\s*<!-- VIEW 6: EXTENSION & MÁY POS                  -->'

new_pin_view = """<!-- ============================================ -->
      <!-- VIEW 5: QUẢN LÝ & DUYỆT PIN                  -->
      <!-- ============================================ -->
      <div id="view-pin" class="hidden space-y-6">
        <div>
          <h2 class="text-lg font-black text-slate-900 tracking-tight">Quản Lý & Phê Duyệt Cấp Lại Mã PIN</h2>
          <p class="text-xs text-slate-500">Phân định rõ thẩm quyền: Cửa hàng trưởng gửi yêu cầu, Admin HO phê duyệt cấp mã</p>
        </div>

        <!-- Khung dành riêng cho Admin HO: Chỉ duyệt yêu cầu (toàn màn hình) -->
        <div id="pinAdminSection" class="card-clean p-6 rounded-2xl space-y-4 border border-rose-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center space-x-2 text-rose-600">
              <i class="fa-solid fa-stamp text-lg"></i>
              <div>
                <h3 class="text-sm font-bold text-slate-900">Danh Sách Yêu Cầu Cấp Lại Mã PIN Từ Cửa Hàng</h3>
                <span class="text-[11px] text-slate-500">Thẩm quyền: Duyệt cấp mã PIN tạm thời cho khách hàng</span>
              </div>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              PIN tạm mặc định: <span class="font-mono font-bold text-slate-900">123456</span>
            </span>
          </div>

          <div id="pinApprovalList" class="space-y-2.5 max-h-[500px] overflow-y-auto">
            <!-- Render requests -->
          </div>
        </div>

        <!-- Khung dành riêng cho Cửa Hàng Trưởng: Form gửi yêu cầu và lịch sử gửi -->
        <div id="pinChtSection" class="hidden grid grid-cols-3 gap-6">
          <div class="card-clean p-5 rounded-2xl space-y-4 border border-blue-200">
            <div class="flex items-center space-x-2 text-blue-600 border-b border-slate-100 pb-3">
              <i class="fa-solid fa-paper-plane"></i>
              <h3 class="text-sm font-bold text-slate-900">Gửi Yêu Cầu Cấp Lại PIN Cho Khách</h3>
            </div>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Số điện thoại khách</label>
                <input type="tel" id="chtPhoneInput" placeholder="0981234567" maxlength="10"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Lý do yêu cầu</label>
                <input type="text" id="chtReasonInput" placeholder="VD: Khách quên PIN, mất mã khôi phục tại quầy"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              </div>
              <button onclick="handleChtSubmitRequest()" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm">
                Gửi Lên Admin HO Phê Duyệt
              </button>
            </div>
          </div>

          <div class="col-span-2 card-clean p-5 rounded-2xl space-y-4 border border-slate-200">
            <h3 class="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Lịch Sử Yêu Cầu Của Cửa Hàng</h3>
            <div id="pinChtHistoryList" class="space-y-2.5 max-h-80 overflow-y-auto"></div>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- VIEW 6: EXTENSION & MÁY POS                  -->"""

html = re.sub(old_pin_view_pattern, new_pin_view, html)

# Cập nhật hàm checkAuth / loadPinRequests để ẩn/hiện section đúng role
role_ui_logic = """
        // Phân tách UI theo role
        const isAdmin = (currentAdmin.role === 'admin_ho');
        const adminSec = document.getElementById('pinAdminSection');
        const chtSec = document.getElementById('pinChtSection');
        if (adminSec && chtSec) {
          if (isAdmin) {
            adminSec.classList.remove('hidden');
            chtSec.classList.add('hidden');
          } else {
            adminSec.classList.add('hidden');
            chtSec.classList.remove('hidden');
          }
        }
"""

if 'pinAdminSection' not in html:
    html = html.replace('document.getElementById(\'currentAdminName\').innerText = currentAdmin.name;',
                        'document.getElementById(\'currentAdminName\').innerText = currentAdmin.name;\n' + role_ui_logic)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated pin UI separation by role")

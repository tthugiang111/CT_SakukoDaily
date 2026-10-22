const fs = require('fs');

const adminHtmlPath = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html';
let html = fs.readFileSync(adminHtmlPath, 'utf8');

// Fix cú pháp fetch() trong <script> của admin.html
html = html.replace(/const res = await fetch\(,\s*\{\s*credentials:\s*"include"\s*\}\);/g, (match, offset) => {
  return match;
});

// Viết lại toàn bộ phần <script> chuẩn xác, không lỗi cú pháp
const scriptStart = html.indexOf('<script>');
if (scriptStart !== -1) {
  const headPart = html.substring(0, scriptStart);
  const cleanScript = `<script>
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
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.ok || !data.user) {
          showAuthOverlay();
          return false;
        }

        // Kiểm tra đúng Trần Thị Thu Giang
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

    async function loadAllAdminData() {
      try {
        const res = await fetch('/api/admin/detailed-reports', { credentials: 'include' });
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
    }

    function renderOverview(data) {
      const f = data.finance || {};
      const stats = data.cardStats || [];
      const totalSold = stats.reduce((sum, s) => sum + Number(s.total_sold || 0), 0);
      const totalCancelled = stats.reduce((sum, s) => sum + Number(s.total_cancelled || 0), 0);

      document.getElementById('kpiTotalSold').innerText = totalSold;
      document.getElementById('kpiActiveCards').innerText = totalSold - totalCancelled;
      document.getElementById('kpiTotalRedeem').innerText = f.total_redemptions || 0;
      document.getElementById('kpiRedeemBreakdown').innerText = \`\${f.count_5k || 0} vé 5K | \${f.count_10k || 0} vé 10K\`;
      document.getElementById('kpiTotalDiscount').innerText = Number(f.total_discount_amount || 0).toLocaleString() + 'đ';
      document.getElementById('kpiAovEst').innerText = Number(f.aov_est || 0).toLocaleString() + 'đ';
      document.getElementById('kpiEstRevenue').innerText = \`D.Thu: \${Number(f.est_revenue || 0).toLocaleString()}đ\`;

      const tbody = document.getElementById('tableStoreStats');
      tbody.innerHTML = '';
      stats.forEach(s => {
        const storeName = s.store_code === 'XT' ? 'Sakuko Xuân Thủy (Pilot)' : s.store_code === 'KM' ? 'Sakuko Kim Mã' : 'Sakuko Thái Hà';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = \`
          <td class="py-2.5 font-bold text-slate-800">\${s.store_code}</td>
          <td class="py-2.5 text-slate-700 font-medium">\${storeName}</td>
          <td class="py-2.5 text-right font-bold text-slate-900">\${s.total_sold}</td>
          <td class="py-2.5 text-right font-medium text-slate-400">\${s.total_cancelled}</td>
          <td class="py-2.5 text-right font-bold text-emerald-600">\${Number(s.total_sold) - Number(s.total_cancelled)}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderFunnel(funnel) {
      const container = document.getElementById('funnelBarsContainer');
      container.innerHTML = '';
      if (!funnel || funnel.length === 0) return;
      const maxCount = Math.max(...funnel.map(f => Number(f.reach_count)), 1);

      funnel.forEach(step => {
        const count = Number(step.reach_count);
        const percent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
        const isBig = (step.use_step === 5 || step.use_step === 10);

        const div = document.createElement('div');
        div.className = 'flex items-center space-x-4 text-xs';
        div.innerHTML = \`
          <div class="w-24 font-bold \${isBig ? 'text-rose-600' : 'text-slate-700'}">
            Lượt #\${step.use_step} \${isBig ? '(Voucher 10K)' : '(5K)'}
          </div>
          <div class="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden p-0.5 border border-slate-200">
            <div class="\${isBig ? 'bg-rose-500' : 'bg-slate-800'} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-[10px] text-white font-bold"
                 style="width: \${Math.max(percent, count > 0 ? 8 : 2)}%">
              \${count} khách
            </div>
          </div>
          <div class="w-14 text-right font-mono font-bold text-slate-500">\${percent}%</div>
        \`;
        container.appendChild(div);
      });
    }

    function renderViolations(violations) {
      const tbody = document.getElementById('tableViolationsBody');
      tbody.innerHTML = '';
      if (!violations || violations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400">Không ghi nhận vi phạm nào.</td></tr>';
        return;
      }
      violations.forEach(v => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = \`
          <td class="py-2.5 font-bold text-rose-600">[\${v.rule_code}]</td>
          <td class="py-2.5 font-mono text-slate-800">\${v.order_no}</td>
          <td class="py-2.5 font-bold text-slate-700">\${v.store_code}</td>
          <td class="py-2.5 text-slate-600">\${v.cashier || 'Chưa ghi nhận'}</td>
          <td class="py-2.5 font-mono text-slate-600">\${v.customer_phone || '-'}</td>
          <td class="py-2.5 text-slate-800 font-medium">\${v.description}</td>
          <td class="py-2.5 text-slate-400 text-[11px]">\${new Date(v.detected_at).toLocaleString('vi-VN')}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderDormant(cards) {
      const tbody = document.getElementById('tableDormantBody');
      tbody.innerHTML = '';
      if (!cards || cards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">Không có thẻ nào bị ngủ quên.</td></tr>';
        return;
      }
      cards.forEach(c => {
        const nextStep = Number(c.uses_count) + 1;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = \`
          <td class="py-2.5 font-mono font-bold text-slate-900">\${c.phone}</td>
          <td class="py-2.5 font-bold text-slate-700">\${c.store_code || 'XT'}</td>
          <td class="py-2.5 text-amber-600 font-bold">\${c.uses_count} / 10 lượt</td>
          <td class="py-2.5 font-semibold text-slate-800">Lượt #\${nextStep} (\${(nextStep === 5 || nextStep === 10) ? 'Giảm 10K' : 'Giảm 5K'})</td>
          <td class="py-2.5 font-bold text-rose-600">\${c.dormant_days} ngày chưa dùng</td>
          <td class="py-2.5">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              Bắn Zalo ZNS nhắc lượt #\${nextStep}
            </span>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderPosDevices(devices) {
      const tbody = document.getElementById('tablePosDevicesBody');
      tbody.innerHTML = '';
      if (!devices) return;
      devices.forEach(d => {
        const isOnline = Number(d.minutes_ago) <= 10;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = \`
          <td class="py-2.5 font-bold text-slate-800">\${d.store_code}</td>
          <td class="py-2.5 font-semibold text-slate-900">\${d.device_name}</td>
          <td class="py-2.5 font-mono text-slate-500">\${d.token_display}</td>
          <td class="py-2.5 text-slate-600">\${d.minutes_ago} phút trước</td>
          <td class="py-2.5 font-bold \${Number(d.missing_events_v10) > 0 ? 'text-rose-600' : 'text-slate-400'}">\${d.missing_events_v10} đơn</td>
          <td class="py-2.5">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold \${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
              \${isOnline ? 'Đang hoạt động' : 'Mất tín hiệu > 10p'}
            </span>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderProgramsAndStores(programs, stores) {
      const pContainer = document.getElementById('programsListContainer');
      pContainer.innerHTML = '';
      if (programs) {
        programs.forEach(p => {
          const div = document.createElement('div');
          div.className = 'p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs';
          div.innerHTML = \`
            <div class="flex justify-between items-center">
              <h4 class="font-bold text-slate-900 text-sm">\${p.name}</h4>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">\${p.status}</span>
            </div>
            <p class="text-slate-600">\${p.description}</p>
            <div class="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-700">
              <div>Giá thẻ: <span class="font-bold">\${Number(p.card_price).toLocaleString()}đ</span></div>
              <div>Mã hàng: <span class="font-bold">\${p.item_code}</span></div>
              <div>Barcode: <span class="font-bold">\${p.barcode}</span></div>
              <div>Voucher 5K: <span class="font-bold text-rose-600">\${p.voucher_5k}</span></div>
              <div>Voucher 10K: <span class="font-bold text-rose-600">\${p.voucher_10k}</span></div>
              <div>AOV tối thiểu: <span class="font-bold">\${Number(p.aov_min).toLocaleString()}đ</span></div>
            </div>
          \`;
          pContainer.appendChild(div);
        });
      }

      const sContainer = document.getElementById('storesListContainer');
      sContainer.innerHTML = '';
      if (stores) {
        stores.forEach(s => {
          const div = document.createElement('div');
          div.className = 'p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs';
          div.innerHTML = \`
            <div>
              <span class="font-bold text-slate-800">[\${s.store_code}]</span>
              <span class="text-slate-700 font-medium ml-1">\${s.name}</span>
            </div>
            <span class="w-2 h-2 rounded-full \${s.active ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
          \`;
          sContainer.appendChild(div);
        });
      }
    }

    async function loadPinRequests() {
      try {
        const res = await fetch('/api/admin/overview', { credentials: 'include' });
        const data = await res.json();
        if (!data.ok) return;

        const container = document.getElementById('pinApprovalList');
        container.innerHTML = '';
        if (data.pinRequests && data.pinRequests.length > 0) {
          data.pinRequests.forEach(r => {
            const div = document.createElement('div');
            div.className = 'p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs';
            div.innerHTML = \`
              <div>
                <span class="font-mono font-bold text-slate-900">\${r.phone}</span>
                <span class="font-bold text-blue-600 ml-1">(\${r.store_code})</span>
                <p class="text-[11px] text-slate-500">\${r.reason || 'Quên PIN'} - Bởi: \${r.requested_by}</p>
              </div>
              <div>
                \${r.status === 'pending'
                  ? \`<button onclick="handleApprovePin(\${r.id}, '\${r.phone}')" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm">
                      Duyệt Cấp 123456
                    </button>\`
                  : \`<span class="text-xs font-bold text-slate-400">Đã cấp: \${r.temp_pin}</span>\`
                }
              </div>
            \`;
            container.appendChild(div);
          });
        } else {
          container.innerHTML = '<p class="text-xs text-slate-400 italic py-2">Hiện không có yêu cầu nào đang chờ duyệt.</p>';
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function handleChtSubmitRequest() {
      const phone = document.getElementById('chtPhoneInput').value.trim();
      const reason = document.getElementById('chtReasonInput').value.trim();
      if (!phone) return alert('Vui lòng nhập SĐT khách hàng!');

      try {
        const res = await fetch('/api/admin/request-pin-reset', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, reason })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message);
        document.getElementById('chtPhoneInput').value = '';
        document.getElementById('chtReasonInput').value = '';
        loadPinRequests();
      } catch (e) {
        alert('Lỗi gửi yêu cầu');
      }
    }

    async function handleApprovePin(requestId, phone) {
      if (!confirm(\`Xác nhận duyệt cấp PIN tạm 123456 cho khách \${phone}?\`)) return;
      try {
        const res = await fetch('/api/admin/approve-pin-reset', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, phone, tempPin: '123456' })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message);
        loadPinRequests();
      } catch (e) {
        alert('Lỗi phê duyệt');
      }
    }

    async function handleCreatePosTokenPrompt() {
      const storeCode = prompt('Nhập mã cửa hàng (XT, KM, TB):', 'XT');
      if (!storeCode) return;
      const deviceName = prompt('Nhập tên máy POS (VD: POS-XT-03):', 'POS-XT-03');
      if (!deviceName) return;

      try {
        const res = await fetch('/api/admin/create-pos-token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeCode, deviceName })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        prompt('Đây là Token bí mật của máy POS (hãy copy ngay):', data.rawToken);
        loadAllAdminData();
      } catch (e) {
        alert('Lỗi tạo token POS');
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      initAdminPC();
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(adminHtmlPath, headPart + cleanScript);
  console.log('Successfully fixed syntax error in admin.html');
}

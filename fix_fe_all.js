const fs = require('fs');

// ==========================================
// 1. UPDATE CLIENT (index.html)
// ==========================================
let clientHtml = fs.readFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html', 'utf8');

// Replace '5K' and '10K' with full text '5.000đ' and '10.000đ'
clientHtml = clientHtml.replace(/Giảm 5\.000đ \(Đơn từ 20K\)/g, 'Giảm 5.000đ (Đơn từ 20.000đ)');
clientHtml = clientHtml.replace(/Giảm 10\.000đ \(Đơn từ 20K\)/g, 'Giảm 10.000đ (Đơn từ 20.000đ)');
clientHtml = clientHtml.replace(/Giảm 5K/g, 'Giảm 5.000đ');
clientHtml = clientHtml.replace(/Giảm 10K/g, 'Giảm 10.000đ');
clientHtml = clientHtml.replace(/'Mở \${discountLabel}'/g, "'Mở ' + (isBig ? '10.000đ' : '5.000đ')");
clientHtml = clientHtml.replace(/'\${discountLabel}'/g, "(isBig ? '10.000đ' : '5.000đ')");

// In renderCardAndVoucher: fix transition to 10 stamps grid when card exists
// When currentCard is present, hide noCardSection, show cardSection, show programsListSection
// In handleBuyCard & simulatePosScanEvent: fix polling and callback to loadCustomerData()
const fixPollingJs = `
    let buyPollTimer = null;

    function handleBuyCard(progId) {
      const prog = (availablePrograms && availablePrograms.find(p => p.id === progId)) || activeProgram;
      if (!prog) return alert('Chưa có thông tin chương trình!');
      selectedProgramToBuy = prog;
      const barcode = prog.barcode || '2000000000018';
      document.getElementById('buyModalBarcodeText').innerText = barcode;
      try {
        JsBarcode('#buyBarcodeSvg', barcode, {
          format: 'CODE128',
          lineColor: '#0f172a',
          width: 2,
          height: 50,
          displayValue: false
        });
      } catch (err) {
        console.error('Lỗi sinh barcode:', err);
      }
      document.getElementById('buyCardModal').classList.remove('hidden');

      if (buyPollTimer) clearInterval(buyPollTimer);
      buyPollTimer = setInterval(async () => {
        try {
          const res = await fetch('/api/customer/me');
          const data = await res.json();
          if (data.ok && data.currentCard) {
            clearInterval(buyPollTimer);
            closeBuyModal();
            alert('Máy POS đã xác nhận thanh toán! Thẻ Sakuko Daily đã được kích hoạt.');
            loadCustomerData();
          }
        } catch (e) {}
      }, 2000);
    }

    function closeBuyModal() {
      if (buyPollTimer) clearInterval(buyPollTimer);
      document.getElementById('buyCardModal').classList.add('hidden');
    }

    async function simulatePosScanEvent() {
      if (!currentCustomer || !currentCustomer.phone) return alert('Chưa có thông tin khách');
      try {
        const prog = selectedProgramToBuy || activeProgram;
        const res = await fetch('/api/pos/card-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: currentCustomer.phone,
            storeCode: 'XT',
            orderNo: 'ORD_POS_' + Math.floor(Math.random() * 899999 + 100000),
            programId: prog ? prog.id : 1
          })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        clearInterval(buyPollTimer);
        closeBuyModal();
        alert('Giả lập POS quét thành công! Thẻ của bạn đã được kích hoạt.');
        loadCustomerData();
      } catch (e) {
        alert('Lỗi giả lập POS');
      }
    }
`;

clientHtml = clientHtml.replace(/let buyPollTimer = null;[\s\S]*?async function simulatePosScanEvent\(\) \{[\s\S]*?\}\s*\}/, fixPollingJs);

// Add Programs List View to Customer Home
const programsListHtml = `
        <!-- DANH SÁCH CHƯƠNG TRÌNH & THỂ LỆ THẺ NBT -->
        <div id="programsSection" class="sakuko-light-card p-5 rounded-3xl space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center space-x-2">
              <div class="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">
                <i class="fa-solid fa-tags"></i>
              </div>
              <div>
                <h3 class="text-xs font-black uppercase text-slate-900 tracking-tight">Chương Trình Ưu Đãi Mở Bán</h3>
                <span class="text-[10px] text-slate-500 font-medium">Chọn chương trình để xem thể lệ và mua thẻ</span>
              </div>
            </div>
          </div>
          <div id="customerProgramsList" class="space-y-3">
            <!-- Render JS -->
          </div>
        </div>
`;

if (!clientHtml.includes('id="programsSection"')) {
  clientHtml = clientHtml.replace('<div id="noCardSection"', programsListHtml + '\n        <div id="noCardSection"');
}

// Add function to render Customer Programs
const renderCustomerProgsJs = `
    let availablePrograms = [];
    let selectedProgramToBuy = null;

    function renderProgramsList(programs, currentCard) {
      const container = document.getElementById('customerProgramsList');
      if (!container) return;
      container.innerHTML = '';
      availablePrograms = programs || [];

      if (!programs || programs.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-2">Hiện chưa có chương trình nào mở bán.</p>';
        return;
      }

      programs.forEach(p => {
        const hasActiveCard = !!currentCard;
        const cardPriceFormatted = Number(p.card_price || 10000).toLocaleString() + 'đ';
        const aovMinFormatted = Number(p.aov_min || 20000).toLocaleString() + 'đ';

        const div = document.createElement('div');
        div.className = 'p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3';
        div.innerHTML = \`
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Đang Mở Bán</span>
              <h4 class="font-bold text-slate-900 text-sm mt-1">\${p.name}</h4>
              <p class="text-[11px] text-slate-600 mt-0.5">\${p.description || 'Thẻ ảo 10 lượt tiết kiệm cho khách hàng thân thiết'}</p>
            </div>
            <span class="text-sm font-black text-rose-600 font-mono">\${cardPriceFormatted}</span>
          </div>

          <!-- Chi tiết thể lệ -->
          <div class="p-3 bg-white rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div class="font-bold text-slate-800 text-xs mb-1 flex items-center">
              <i class="fa-solid fa-circle-info text-rose-500 mr-1.5"></i> Thể lệ chương trình:
            </div>
            <p>• <b>Gói ưu đãi:</b> 10 lần mua hàng (Lượt 1–4 & 6–9 giảm 5.000đ; Lượt 5 & 10 giảm 10.000đ).</p>
            <p>• <b>Đơn tối thiểu:</b> Từ \${aovMinFormatted} sau khi trừ các khuyến mãi khác.</p>
            <p>• <b>Quy tắc sử dụng:</b> Tối đa 1 lượt/ngày. Mua hôm nay, từ ngày mai bắt đầu dùng.</p>
            <p>• <b>Thời hạn:</b> Áp dụng đến hết ngày \${new Date(p.end_date).toLocaleDateString('vi-VN')}.</p>
          </div>

          <div class="pt-1">
            \${hasActiveCard 
              ? \`<button disabled class="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs cursor-not-allowed">
                  <i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> Đang Sử Dụng Thẻ (Còn \${10 - Number(currentCard.uses_count)} lượt)
                </button>\`
              : \`<button onclick="handleBuyCard(\${p.id})" class="w-full py-2.5 rounded-xl sakuko-primary-gradient text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-[0.98] transition flex items-center justify-center">
                  <i class="fa-solid fa-cart-shopping mr-1.5"></i> Mua Thẻ Ngay (\${cardPriceFormatted})
                </button>\`
            }
          </div>
        \`;
        container.appendChild(div);
      });
    }
`;

// Hook renderProgramsList into loadCustomerData
clientHtml = clientHtml.replace('renderCardAndVoucher(data);', 'renderCardAndVoucher(data);\n        renderProgramsList(data.programs || (activeProgram ? [activeProgram] : []), currentCard);');
clientHtml = clientHtml.replace("window.addEventListener('DOMContentLoaded'", renderCustomerProgsJs + "\n    window.addEventListener('DOMContentLoaded'");

fs.writeFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html', clientHtml);
console.log('index.html updated');

// ==========================================
// 2. UPDATE ADMIN (admin.html)
// ==========================================
let adminHtml = fs.readFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html', 'utf8');

// Add Customer Management Table to View Overview
const adminCustomerTableHtml = `
        <!-- BẢNG DANH SÁCH TOÀN BỘ KHÁCH HÀNG & THẺ (REALTIME DATABASE) -->
        <div class="card-clean p-5 rounded-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Danh Sách Khách Hàng & Thẻ Thành Viên (Realtime DB)</h3>
              <p class="text-xs text-slate-500">Toàn bộ tài khoản đã đăng ký, tình trạng mua thẻ và tiến độ sử dụng 10 lượt</p>
            </div>
            <button onclick="loadAllAdminData()" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center">
              <i class="fa-solid fa-rotate mr-1.5"></i> Làm mới danh sách
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 border-b border-slate-100">
                  <th class="pb-2.5">Mã KH</th>
                  <th class="pb-2.5">Số Điện Thoại</th>
                  <th class="pb-2.5">Ngày Đăng Ký</th>
                  <th class="pb-2.5">Trạng Thái Thẻ</th>
                  <th class="pb-2.5">Tiến Độ Sử Dụng</th>
                  <th class="pb-2.5">Cửa Hàng</th>
                  <th class="pb-2.5">Ngày Mua Thẻ</th>
                  <th class="pb-2.5">Hiệu Lực Dùng Từ</th>
                </tr>
              </thead>
              <tbody id="tableAllCustomersBody" class="divide-y divide-slate-100">
                <!-- Render JS -->
              </tbody>
            </table>
          </div>
        </div>
`;

if (!adminHtml.includes('id="tableAllCustomersBody"')) {
  adminHtml = adminHtml.replace('<!-- ============================================ -->\n      <!-- VIEW 2: PHỄU GIỮ CHÂN KHÁCH HÀNG', adminCustomerTableHtml + '\n      <!-- ============================================ -->\n      <!-- VIEW 2: PHỄU GIỮ CHÂN KHÁCH HÀNG');
}

// Add JS to render Customer Table in Admin
const adminCustomerTableJs = `
    function renderAllCustomers(customers) {
      const tbody = document.getElementById('tableAllCustomersBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-slate-400">Chưa có khách hàng nào trong hệ thống.</td></tr>';
        return;
      }

      customers.forEach(c => {
        const hasCard = !!c.card_id;
        const uses = hasCard ? Number(c.uses_count || 0) : 0;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = \`
          <td class="py-2.5 font-mono font-bold text-slate-400">#\${c.id}</td>
          <td class="py-2.5 font-mono font-black text-slate-900">\${c.phone}</td>
          <td class="py-2.5 text-slate-500 text-[11px]">\${new Date(c.created_at).toLocaleString('vi-VN')}</td>
          <td class="py-2.5">
            \${hasCard 
              ? \`<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Đã Mua Thẻ</span>\`
              : \`<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Chưa Mua Thẻ</span>\`
            }
          </td>
          <td class="py-2.5">
            \${hasCard
              ? \`<div class="flex items-center space-x-2">
                  <span class="font-bold text-amber-600">\${uses} / 10</span>
                  <div class="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div class="h-full bg-amber-400 rounded-full" style="width: \${(uses / 10) * 100}%"></div>
                  </div>
                </div>\`
              : '<span class="text-slate-400 text-[11px]">-</span>'
            }
          </td>
          <td class="py-2.5 font-bold text-slate-700">\${c.store_code || 'XT'}</td>
          <td class="py-2.5 text-slate-500 text-[11px]">\${c.purchased_at ? new Date(c.purchased_at).toLocaleDateString('vi-VN') : '-'}</td>
          <td class="py-2.5 text-slate-700 text-[11px] font-semibold">\${c.usable_from ? new Date(c.usable_from).toLocaleDateString('vi-VN') : '-'}</td>
        \`;
        tbody.appendChild(tr);
      });
    }
`;

adminHtml = adminHtml.replace('renderOverview(data);', 'renderOverview(data);\n        renderAllCustomers(data.customers);');
adminHtml = adminHtml.replace("window.addEventListener('DOMContentLoaded'", adminCustomerTableJs + "\n    window.addEventListener('DOMContentLoaded'");

fs.writeFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html', adminHtml);
console.log('admin.html updated');

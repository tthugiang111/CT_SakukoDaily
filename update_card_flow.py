import re

html_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Xóa bảng chi tiết 10 lượt "BẢNG CHI TIẾT 10 LƯỢT ƯU ĐÃI & ĐIỀU KIỆN ÁP DỤNG"
old_table_pattern = r'<!-- BẢNG CHI TIẾT 10 LƯỢT ƯU ĐÃI & ĐIỀU KIỆN ÁP DỤNG -->[\s\S]*?<!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->'
html = re.sub(old_table_pattern, '<!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->', html)

# 2. Xóa khối voucherSection cũ (voucher đơn lẻ phía dưới)
old_voucher_sec_pattern = r'<!-- KHỐI VOUCHER LƯỢT KẾ TIẾP ĐỂ THU NGÂN QUÉT TẠI QUẦY -->[\s\S]*?<!-- ============================================ -->\s*<!-- SCREEN 5: ĐỔI MÃ PIN QUÊN'
screen5_start = '<!-- ============================================ -->\n      <!-- SCREEN 5: ĐỔI MÃ PIN QUÊN'
html = re.sub(old_voucher_sec_pattern, screen5_start, html)

# 3. Thêm Modal Popup Barcode khi ấn vào lượt hợp lệ
voucher_modal_html = """
  <!-- MODAL CHI TIẾT VOUCHER BARCODE KHI ẤN VÀO LƯỢT HỢP LỆ -->
  <div id="voucherModal" class="hidden fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="sakuko-light-card max-w-sm w-full p-6 rounded-3xl bg-white shadow-2xl text-center space-y-4 border border-rose-200">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="text-left">
          <span id="voucherModalStepBadge" class="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">LƯỢT #1</span>
          <h3 id="voucherModalDiscountText" class="text-sm font-black text-slate-900 mt-1">Giảm 5.000đ (Đơn từ 20K)</h3>
        </div>
        <button onclick="closeVoucherModal()" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Khung Barcode & Thời hạn -->
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
          <span id="voucherModalDateStr">Ngày: --/--/----</span>
          <span id="voucherModalCountdown" class="text-rose-600 font-mono font-bold">Còn --h--m</span>
        </div>

        <div class="font-mono text-xl font-black text-slate-900 tracking-widest pt-1" id="voucherModalCodeText">DAILY5K-01</div>
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-center items-center shadow-inner">
          <svg id="voucherModalBarcodeSvg" class="w-full max-h-20"></svg>
        </div>
      </div>

      <!-- Thông tin xác thực chống gian lận -->
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-left space-y-1">
        <div class="flex items-center text-amber-800 text-xs font-bold">
          <i class="fa-solid fa-clock mr-1.5 text-amber-600"></i> Quy tắc áp dụng:
        </div>
        <p class="text-[11px] text-amber-900 font-medium">
          • Mỗi ngày chỉ dùng được <b>1 lần duy nhất</b> cho đơn hàng đầu tiên.<br/>
          • Đưa mã Barcode này cho thu ngân quét tại quầy khi thanh toán.
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <!-- Nút test quét voucher tại quầy -->
        <button onclick="simulateRedeemCurrent()"
          class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition flex items-center justify-center">
          <i class="fa-solid fa-qrcode mr-1.5 text-rose-500"></i> [Giả Lập Test] Thu Ngân Quét Áp Voucher
        </button>
        <button onclick="closeVoucherModal()" class="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm">
          Đóng
        </button>
      </div>
    </div>
  </div>
"""

if 'id="voucherModal"' not in html:
    html = html.replace('</body>', voucher_modal_html + '\n</body>')

# 4. Viết lại hàm render 10 ô tem và logic click
js_render_stamps = """
    let selectedStepForModal = null;

    function renderStampsGrid(card, usedToday) {
      const grid = document.getElementById('stampsGrid');
      if (!grid) return;
      grid.innerHTML = '';

      const usesCount = Number(card.uses_count || 0);
      const isWaitFirstDay = new Date() < new Date(card.usable_from);
      const activeStep = usesCount + 1; // Lượt kế tiếp cần dùng

      for (let i = 1; i <= 10; i++) {
        const isUsed = i <= usesCount;
        const isCurrentActive = (i === activeStep) && !isWaitFirstDay && !usedToday;
        const isBig = (i === 5 || i === 10);
        const discountLabel = isBig ? '10K' : '5K';

        const btn = document.createElement('button');
        btn.type = 'button';

        if (isUsed) {
          // Đã dùng: mờ, có dấu tick
          btn.className = 'h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs bg-black/40 text-white/50 border border-white/10 cursor-not-allowed opacity-60';
          btn.innerHTML = `
            <span class="line-through">#${i}</span>
            <span class="text-[9px]"><i class="fa-solid fa-check text-emerald-400"></i> Đã dùng</span>
          `;
          btn.onclick = () => alert(`Lượt #${i} đã được sử dụng!`);
        } else if (isCurrentActive) {
          // Lượt hôm nay ĐƯỢC PHÉP DÙNG: SÁNG RỰC LÊN, CLICK ĐƯỢC
          btn.className = 'h-14 rounded-2xl flex flex-col items-center justify-center font-black text-xs bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40 border-2 border-white scale-105 animate-pulse cursor-pointer';
          btn.innerHTML = `
            <span class="text-sm">#${i}</span>
            <span class="text-[10px] font-extrabold uppercase bg-rose-600 text-white px-1.5 py-0.2 rounded-full mt-0.5">Mở ${discountLabel}</span>
          `;
          btn.onclick = () => openVoucherModal(i, isBig ? 10000 : 5000);
        } else if (i === activeStep && usedToday) {
          // Đã dùng lượt hôm nay rồi, chờ ngày mai
          btn.className = 'h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs bg-white/15 text-white/70 border border-white/20 cursor-pointer';
          btn.innerHTML = `
            <span>#${i}</span>
            <span class="text-[9px] text-amber-200">Mai mở</span>
          `;
          btn.onclick = () => alert(`Hôm nay bạn đã dùng ưu đãi rồi! Lượt #${i} sẽ mở vào ngày mai.`);
        } else if (i === activeStep && isWaitFirstDay) {
          // Thẻ mới mua, mai mới bắt đầu lượt 1
          btn.className = 'h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs bg-white/15 text-white/70 border border-white/20 cursor-pointer';
          btn.innerHTML = `
            <span>#${i}</span>
            <span class="text-[9px] text-amber-200">Mai mở</span>
          `;
          btn.onclick = () => alert(`Thẻ mới mua hôm nay. Lượt #${i} sẽ bắt đầu có hiệu lực từ ngày mai!`);
        } else {
          // Các lượt tương lai chưa đến ngày
          btn.className = 'h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs bg-white/10 text-white/40 border border-white/10 cursor-not-allowed';
          btn.innerHTML = `
            <span>#${i}</span>
            <span class="text-[9px]">${discountLabel}</span>
          `;
          btn.onclick = () => alert(`Lượt #${i} chưa mở. Vui lòng hoàn thành các lượt trước theo thứ tự mỗi ngày 1 lượt!`);
        }

        grid.appendChild(btn);
      }
    }

    function openVoucherModal(step, discount) {
      selectedStepForModal = step;
      const isBig = (step === 5 || step === 10);
      const discountText = isBig ? 'Giảm 10.000đ (Đơn từ 20K)' : 'Giảm 5.000đ (Đơn từ 20K)';
      const fakeCode = isBig ? `DAILY10K-0${step}` : `DAILY5K-0${step}`;
      const fakeBarcode = `8938500${step}0005`;

      document.getElementById('voucherModalStepBadge').innerText = `LƯỢT #${step} (HÔM NAY)`;
      document.getElementById('voucherModalDiscountText').innerText = discountText;
      document.getElementById('voucherModalCodeText').innerText = fakeCode;

      // Tính ngày tháng năm và thời hạn còn lại trong ngày (đến 23:59:59 đêm nay)
      const now = new Date();
      const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const diffMs = midnight - now;
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

      document.getElementById('voucherModalDateStr').innerText = `Ngày: ${dateStr}`;
      document.getElementById('voucherModalCountdown').innerText = `Hạn: còn ${diffHours}h ${diffMinutes}m hôm nay`;

      try {
        JsBarcode('#voucherModalBarcodeSvg', fakeBarcode, {
          format: 'CODE128',
          lineColor: '#0f172a',
          width: 2,
          height: 50,
          displayValue: true,
          text: fakeBarcode
        });
      } catch (err) {
        console.error('Barcode render err:', err);
      }

      document.getElementById('voucherModal').classList.remove('hidden');
    }

    function closeVoucherModal() {
      document.getElementById('voucherModal').classList.add('hidden');
    }

    async function simulateRedeemCurrent() {
      if (!currentCard) return;
      try {
        const res = await fetch('/api/customer/redeem-voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: currentCard.id,
            orderNo: 'ORD_' + Math.floor(Math.random() * 899999 + 100000)
          })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message || 'Đã áp dụng voucher thành công!');
        closeVoucherModal();
        loadCustomerData();
      } catch (e) {
        alert('Lỗi áp dụng voucher');
      }
    }
"""

# Tìm hàm renderDashboard và thay thế đoạn vẽ grid cũ bằng renderStampsGrid
html = re.sub(r'const grid = document\.getElementById\(\'stampsGrid\'\);[\s\S]*?grid\.appendChild\(div\);\s*\}', 'renderStampsGrid(card, data.usedToday);', html)

# Thêm js_render_stamps vào trước DOMContentLoaded
html = html.replace("window.addEventListener('DOMContentLoaded'", js_render_stamps + "\n    window.addEventListener('DOMContentLoaded'")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated customer UI: stamps grid as primary controller with modal barcode & countdown")

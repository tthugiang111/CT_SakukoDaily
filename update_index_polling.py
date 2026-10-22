import re

file_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Thay thế modal mua thẻ:
# Bỏ nút tự kích hoạt của khách, thay bằng giao diện chờ quầy POS quét mã và thanh toán
# Có spinner hiệu ứng "Đang chờ thu ngân quét mã trên máy POS..."
# Kèm nút nhỏ "Giả lập thu ngân quét POS (Dành cho Test)" để kiểm thử nếu chưa gắn extension thật
old_modal_pattern = r'<!-- MODAL QUÉT MÃ MUA THẺ TẠI QUẦY THU NGÂN -->[\s\S]*?<!-- Ghi chú cho khách hàng -->[\s\S]*?</div>\s*</div>\s*</div>'

new_modal = """<!-- MODAL QUÉT MÃ MUA THẺ TẠI QUẦY THU NGÂN -->
  <div id="buyCardModal" class="hidden fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="sakuko-light-card max-w-sm w-full p-6 rounded-3xl bg-white shadow-2xl text-center space-y-4 border border-rose-200">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="text-left">
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-tight">Thanh Toán Mua Thẻ</h3>
          <span class="text-[11px] text-slate-500 font-medium">Sakuko Daily (10.000đ / 10 lượt)</span>
        </div>
        <button onclick="closeBuyModal()" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Khung Barcode -->
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <span class="text-[11px] font-bold text-slate-500 block">MÃ BARCODE MUA HÀNG:</span>
        <div class="font-mono text-xl font-black text-slate-900 tracking-widest" id="buyModalBarcodeText">2000000000018</div>
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-center items-center shadow-inner">
          <svg id="buyBarcodeSvg" class="w-full max-h-20"></svg>
        </div>
      </div>

      <!-- Ghi chú cho khách hàng -->
      <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1">
        <div class="flex items-center text-amber-800 text-xs font-bold">
          <i class="fa-solid fa-circle-exclamation mr-1.5 text-amber-600"></i> Lưu ý quan trọng:
        </div>
        <p class="text-[11px] text-amber-900 font-medium leading-relaxed">
          Khách hàng vui lòng cung cấp mã barcode cho thu ngân để thanh toán và kích hoạt thẻ này.
        </p>
      </div>

      <!-- Trạng thái chờ POS quét -->
      <div class="p-3 rounded-2xl bg-rose-50/60 border border-rose-100 flex items-center justify-center space-x-2.5 text-rose-700 text-xs font-semibold">
        <i class="fa-solid fa-circle-notch fa-spin text-sm text-rose-600"></i>
        <span>Đang chờ thu ngân thanh toán tại quầy...</span>
      </div>

      <div class="space-y-2 pt-1">
        <!-- Nút Test mô phỏng POS Extension bắn sự kiện -->
        <button onclick="simulatePosScanEvent()"
          class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition flex items-center justify-center">
          <i class="fa-solid fa-cash-register mr-1.5 text-slate-500"></i> [Giả Lập Test] Máy POS Quét & Thu Tiền
        </button>
        <button onclick="closeBuyModal()" class="w-full py-2 rounded-xl text-slate-400 hover:text-slate-600 font-semibold text-xs">
          Đóng cửa sổ
        </button>
      </div>
    </div>
  </div>"""

html = re.sub(old_modal_pattern, new_modal, html)

# Cập nhật polling JS để tự động kích hoạt khi POS gọi API
polling_js = """
    let buyPollTimer = null;

    function handleBuyCard() {
      if (!activeProgram) return alert('Chưa có chương trình nào đang mở!');
      const barcode = activeProgram.barcode || '2000000000018';
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

      // Tự động kiểm tra API mỗi 2.5 giây xem Extension POS đã thu tiền chưa
      if (buyPollTimer) clearInterval(buyPollTimer);
      buyPollTimer = setInterval(async () => {
        try {
          const res = await fetch('/api/customer/me');
          const data = await res.json();
          if (data.ok && data.currentCard) {
            clearInterval(buyPollTimer);
            closeBuyModal();
            alert('Máy POS đã xác nhận thanh toán! Thẻ Sakuko Daily của bạn đã được kích hoạt thành công.');
            renderDashboard(data);
          }
        } catch (e) {}
      }, 2500);
    }

    function closeBuyModal() {
      if (buyPollTimer) clearInterval(buyPollTimer);
      document.getElementById('buyCardModal').classList.add('hidden');
    }

    // Hàm giả lập POS Extension bắn sự kiện mua thẻ về server
    async function simulatePosScanEvent() {
      if (!currentCustomer || !currentCustomer.phone) return alert('Chưa có thông tin khách');
      try {
        const res = await fetch('/api/pos/card-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: currentCustomer.phone,
            storeCode: 'XT',
            orderNo: 'ORD_POS_' + Math.floor(Math.random() * 899999 + 100000),
            programId: activeProgram ? activeProgram.id : 1
          })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        // Sau khi POS ghi nhận thành công, polling sẽ tự động phát hiện và đóng modal
      } catch (e) {
        alert('Lỗi giả lập POS');
      }
    }
"""

# Thay thế hàm handleBuyCard cũ
html = re.sub(r'function handleBuyCard\(\) \{[\s\S]*?async function confirmActivateCard\(\) \{[\s\S]*?\}\s*\}', polling_js, html)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html with POS polling and simulation flow!")

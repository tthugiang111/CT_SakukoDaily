const fs = require('fs');
const filePath = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Kiểm tra và thêm buyCardModal nếu chưa có
if (!html.includes('id="buyCardModal"')) {
  const modalHtml = `
  <!-- MODAL QUÉT MÃ MUA THẺ TẠI QUẦY THU NGÂN -->
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
          Khách hàng vui lòng cung cấp mã barcode trên cho thu ngân để thanh toán và sử dụng thẻ này.
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <button onclick="confirmActivateCard()"
          class="w-full py-3 rounded-2xl sakuko-primary-gradient text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-[0.98] transition">
          <i class="fa-solid fa-check mr-1.5"></i> Thu Ngân Đã Quét & Kích Hoạt Thẻ
        </button>
        <button onclick="closeBuyModal()" class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs">
          Đóng
        </button>
      </div>
    </div>
  </div>
`;
  html = html.replace('</body>', modalHtml + '\n</body>');
}

// 2. Cập nhật hàm handleBuyCard, closeBuyModal, confirmActivateCard
const scriptBlock = `
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
    }

    function closeBuyModal() {
      document.getElementById('buyCardModal').classList.add('hidden');
    }

    async function confirmActivateCard() {
      try {
        const res = await fetch('/api/customer/buy-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programId: activeProgram.id, storeCode: 'XT' })
        });
        const data = await res.json();
        if (!data.ok) return alert(data.error);
        alert(data.message);
        closeBuyModal();
        loadCustomerData();
      } catch (e) {
        alert('Lỗi tạo thẻ!');
      }
    }
`;

// Thay thế đoạn code handleBuyCard cũ trong file
html = html.replace(/async function handleBuyCard\(\) \{[\s\S]*?loadCustomerData\(\);\s*\}\s*catch \(e\) \{\s*alert\('Lỗi tạo thẻ!'\);\s*\}\s*\}/, scriptBlock);

fs.writeFileSync(filePath, html);
console.log('index.html updated successfully with Barcode modal and note!');

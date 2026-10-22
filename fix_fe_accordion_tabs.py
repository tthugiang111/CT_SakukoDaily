import re

index_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Viết lại hàm renderProgramsList để làm dạng Accordion thu gọn
# Khi đã có thẻ active:
# - Accordion mặc định đóng. Khách ấn nút mới mở ra đọc thể lệ.
# - Tuyệt đối KHÔNG có nút mua thẻ nữa, thay vào đó hiển thị badge "Đang sử dụng thẻ này (còn X lượt)"
new_render_programs_js = """
    function switchCustTab(tabName) {
      ['home', 'history', 'wallet'].forEach(t => {
        const btn = document.getElementById('custTabBtn-' + t);
        const content = document.getElementById('custTabContent-' + t);
        if (btn) {
          if (t === tabName) {
            btn.className = 'flex-1 py-2 rounded-xl sakuko-tab-btn active bg-white text-rose-600 shadow-sm transition';
          } else {
            btn.className = 'flex-1 py-2 rounded-xl sakuko-tab-btn text-slate-600 hover:text-slate-900 transition';
          }
        }
        if (content) {
          if (t === tabName) content.classList.remove('hidden');
          else content.classList.add('hidden');
        }
      });

      if (tabName === 'history') loadHistoryData();
      if (tabName === 'wallet') loadWalletData();
    }

    async function loadHistoryData() {
      const container = document.getElementById('historyListContainer');
      if (!container) return;
      container.innerHTML = '<div class="text-center py-4 text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Đang tải lịch sử...</div>';
      try {
        const res = await fetch('/api/customer/redemption-history');
        const data = await res.json();
        if (!data.ok || !data.history || data.history.length === 0) {
          container.innerHTML = `
            <div class="text-center py-6 space-y-2">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                <i class="fa-solid fa-receipt"></i>
              </div>
              <p class="text-xs text-slate-500 font-medium">Bạn chưa sử dụng lượt ưu đãi nào.</p>
              <p class="text-[10px] text-slate-400">Khi thu ngân quét mã tại quầy, lịch sử áp dụng voucher sẽ hiển thị tại đây.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = '';
        data.history.forEach(item => {
          const usedDate = new Date(item.used_at);
          const dateStr = usedDate.toLocaleDateString('vi-VN');
          const timeStr = usedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const discountStr = Number(item.discount || 0).toLocaleString() + 'đ';

          const div = document.createElement('div');
          div.className = 'p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between';
          div.innerHTML = `
            <div class="space-y-0.5">
              <div class="flex items-center space-x-1.5">
                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Lượt #${item.step_number || item.use_step || 1}
                </span>
                <span class="text-xs font-bold text-slate-800">Giảm ${discountStr}</span>
              </div>
              <p class="text-[11px] text-slate-500">Mã đơn: <span class="font-mono font-bold text-slate-700">${item.order_no || 'POS-DIRECT'}</span></p>
              <p class="text-[10px] text-slate-400"><i class="fa-regular fa-clock mr-1"></i>${dateStr} lúc ${timeStr} · CH ${item.store_code || 'XT'}</p>
            </div>
            <div class="text-right">
              <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                <i class="fa-solid fa-check mr-0.5"></i> Thành công
              </span>
            </div>
          `;
          container.appendChild(div);
        });
      } catch (e) {
        container.innerHTML = '<p class="text-xs text-rose-500 text-center py-3">Lỗi tải lịch sử ưu đãi</p>';
      }
    }

    async function loadWalletData() {
      const container = document.getElementById('walletCardsContainer');
      if (!container) return;
      container.innerHTML = '<div class="text-center py-4 text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Đang tải ví thẻ...</div>';
      try {
        const res = await fetch('/api/customer/my-cards');
        const data = await res.json();
        if (!data.ok || !data.cards || data.cards.length === 0) {
          container.innerHTML = `
            <div class="text-center py-6 space-y-2">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                <i class="fa-solid fa-id-card"></i>
              </div>
              <p class="text-xs text-slate-500 font-medium">Bạn chưa mua thẻ ưu đãi nào.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = '';
        data.cards.forEach(card => {
          const uses = Number(card.uses_count || 0);
          const isActive = card.status === 'active';
          const isUsedUp = card.status === 'used_up' || uses >= 10;
          const statusBadge = isActive 
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Đang hoạt động</span>'
            : isUsedUp 
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">Đã dùng hết 10 lượt</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Hết hạn</span>';

          const div = document.createElement('div');
          div.className = 'p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg space-y-3';
          div.innerHTML = `
            <div class="flex justify-between items-start">
              <div>
                <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">Mã thẻ #${card.id}</span>
                <h4 class="text-sm font-bold text-white mt-1">${card.program_name || 'Thẻ Sakuko Daily'}</h4>
                <p class="text-[10px] text-slate-300">Cửa hàng đăng ký: ${card.store_code || 'XT'}</p>
              </div>
              <div>${statusBadge}</div>
            </div>

            <!-- Tiến độ -->
            <div class="bg-black/30 p-2.5 rounded-xl border border-white/10 space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-slate-300 text-[11px]">Tiến độ sử dụng</span>
                <span class="font-extrabold text-amber-300 text-[11px]">${uses} / 10 lượt</span>
              </div>
              <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-amber-400 rounded-full" style="width: ${(uses / 10) * 100}%"></div>
              </div>
            </div>

            <div class="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-white/10">
              <span>Mua ngày: ${card.purchased_at ? new Date(card.purchased_at).toLocaleDateString('vi-VN') : '-'}</span>
              <span>Dùng từ: ${card.usable_from ? new Date(card.usable_from).toLocaleDateString('vi-VN') : '-'}</span>
            </div>
          `;
          container.appendChild(div);
        });
      } catch (e) {
        container.innerHTML = '<p class="text-xs text-rose-500 text-center py-3">Lỗi tải ví thẻ</p>';
      }
    }

    function toggleProgramAccordion(id) {
      const body = document.getElementById('programDetail-' + id);
      const icon = document.getElementById('programIcon-' + id);
      if (!body) return;
      if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        if (icon) icon.className = 'fa-solid fa-chevron-up text-xs text-slate-400';
      } else {
        body.classList.add('hidden');
        if (icon) icon.className = 'fa-solid fa-chevron-down text-xs text-slate-400';
      }
    }

    function renderProgramsList(programs, currentCard) {
      const container = document.getElementById('customerProgramsList');
      if (!container) return;
      container.innerHTML = '';
      availablePrograms = programs || [];

      if (!programs || programs.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-2">Hiện chưa có chương trình nào mở bán.</p>';
        return;
      }

      const hasActiveCard = !!currentCard;

      programs.forEach(p => {
        const cardPriceFormatted = Number(p.card_price || 10000).toLocaleString() + 'đ';
        const aovMinFormatted = Number(p.aov_min || 20000).toLocaleString() + 'đ';
        const remainingUses = hasActiveCard ? (10 - Number(currentCard.uses_count || 0)) : 10;

        const div = document.createElement('div');
        div.className = 'rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden';
        div.innerHTML = `
          <!-- Header bấm để mở rộng / thu gọn -->
          <div onclick="toggleProgramAccordion(${p.id})" class="p-3.5 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition">
            <div class="space-y-0.5 pr-2">
              <div class="flex items-center space-x-2">
                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${hasActiveCard ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}">
                  ${hasActiveCard ? 'Đang Sử Dụng' : 'Đang Mở Bán'}
                </span>
                <span class="text-xs font-bold text-slate-900">${p.name}</span>
              </div>
              <p class="text-[11px] text-slate-500">${hasActiveCard ? 'Bấm để xem lại thể lệ chương trình' : 'Bấm để xem chi tiết thể lệ & mua thẻ'}</p>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-black text-rose-600 font-mono">${cardPriceFormatted}</span>
              <i id="programIcon-${p.id}" class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
            </div>
          </div>

          <!-- Nội dung thể lệ (Mặc định THU GỌN nếu đã có thẻ active) -->
          <div id="programDetail-${p.id}" class="hidden p-3.5 pt-0 space-y-3 border-t border-slate-200/60 bg-white">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1 mt-2.5">
              <div class="font-bold text-slate-800 text-xs mb-1 flex items-center">
                <i class="fa-solid fa-circle-info text-rose-500 mr-1.5"></i> Thể lệ chương trình:
              </div>
              <p>• <b>Gói ưu đãi:</b> 10 lần mua hàng (Lượt 1–4 & 6–9 giảm 5.000đ; Lượt 5 & 10 giảm 10.000đ).</p>
              <p>• <b>Đơn tối thiểu:</b> Từ ${aovMinFormatted} sau khi trừ các khuyến mãi khác.</p>
              <p>• <b>Quy tắc sử dụng:</b> Tối đa 1 lượt/ngày. Mua hôm nay, từ ngày mai bắt đầu dùng.</p>
              <p>• <b>Thời hạn:</b> Áp dụng đến hết ngày ${new Date(p.end_date).toLocaleDateString('vi-VN')}.</p>
            </div>

            <div>
              ${hasActiveCard 
                ? `<div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    <i class="fa-solid fa-circle-check mr-1.5 text-emerald-600"></i> Bạn đang sở hữu thẻ này (Còn ${remainingUses} lượt ưu đãi)
                  </div>`
                : `<button onclick="handleBuyCard(${p.id})" class="w-full py-2.5 rounded-xl sakuko-primary-gradient text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-[0.98] transition flex items-center justify-center">
                    <i class="fa-solid fa-cart-shopping mr-1.5"></i> Mua Thẻ Ngay (${cardPriceFormatted})
                  </button>`
              }
            </div>
          </div>
        `;
        container.appendChild(div);
      });

      // Banner Tháng 10 dạng thu gọn
      const octoberBanner = document.createElement('div');
      octoberBanner.className = 'p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-200/80 flex items-center justify-between';
      octoberBanner.innerHTML = `
        <div class="space-y-0.5">
          <div class="flex items-center space-x-1.5">
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              HOT · Tháng 10
            </span>
            <h4 class="font-bold text-slate-900 text-xs">Lễ Hội Mua Sắm Sakuko Daily</h4>
          </div>
          <p class="text-[10px] text-slate-500">Ưu đãi đồng loạt từng điểm bán</p>
        </div>
        <a href="https://sakukodaily.com.vn/blogs/news" target="_blank" rel="noopener noreferrer"
          class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-rose-600 font-bold text-[11px] border border-rose-200 shadow-sm transition flex items-center shrink-0">
          Xem Ngay <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
        </a>
      `;
      container.appendChild(octoberBanner);
    }
"""

# Thay thế hàm renderProgramsList cũ bằng new_render_programs_js
html = re.sub(r'function renderProgramsList[\s\S]*?container\.appendChild\(octoberBanner\);\s*\}', new_render_programs_js, html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html: accordion programs & tab navigation handlers added!")

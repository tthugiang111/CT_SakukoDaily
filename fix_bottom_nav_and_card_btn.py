import re

index_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Xóa thanh điều hướng tab ở trên đỉnh
html = re.sub(r'<!-- THANH ĐIỀU HƯỚNG TABS CHO KHÁCH HÀNG -->[\s\S]*?</div>\s*</div>\s*<div id="custTabContent-home"', '<div id="custTabContent-home"', html)

# 2. Thêm thanh điều hướng Bottom Navigation Bar cố định ở dưới đáy (Mobile chuẩn app)
bottom_nav_html = """
    <!-- BOTTOM NAVIGATION BAR (CỐ ĐỊNH DƯỚI ĐÁY CHO MOBILE) -->
    <div id="customerBottomNav" class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 shadow-lg">
      <div class="max-w-md mx-auto flex items-center justify-around">
        <button id="custTabBtn-home" onclick="switchCustTab('home')" class="flex flex-col items-center py-1 px-3 text-rose-600 font-bold transition">
          <i class="fa-solid fa-ticket text-lg"></i>
          <span class="text-[10px] mt-0.5">10 Lượt</span>
        </button>
        <button id="custTabBtn-history" onclick="switchCustTab('history')" class="flex flex-col items-center py-1 px-3 text-slate-400 font-semibold hover:text-slate-700 transition">
          <i class="fa-solid fa-clock-rotate-left text-lg"></i>
          <span class="text-[10px] mt-0.5">Lịch Sử</span>
        </button>
        <button id="custTabBtn-wallet" onclick="switchCustTab('wallet')" class="flex flex-col items-center py-1 px-3 text-slate-400 font-semibold hover:text-slate-700 transition">
          <i class="fa-solid fa-wallet text-lg"></i>
          <span class="text-[10px] mt-0.5">Ví Thẻ</span>
        </button>
      </div>
    </div>
"""

# Thêm padding-bottom cho container chính để không bị thanh Bottom Bar che nội dung
html = html.replace('id="screenCustomerHome" class="hidden space-y-4">', 'id="screenCustomerHome" class="hidden space-y-4 pb-20">')

if 'id="customerBottomNav"' not in html:
    html = html.replace('</body>', bottom_nav_html + '\n</body>')

# 3. Cập nhật hàm switchCustTab cho Bottom Navigation
new_switch_tab_js = """
    function switchCustTab(tabName) {
      ['home', 'history', 'wallet'].forEach(t => {
        const btn = document.getElementById('custTabBtn-' + t);
        const content = document.getElementById('custTabContent-' + t);
        if (btn) {
          if (t === tabName) {
            btn.className = 'flex flex-col items-center py-1 px-3 text-rose-600 font-bold transition';
          } else {
            btn.className = 'flex flex-col items-center py-1 px-3 text-slate-400 font-semibold hover:text-slate-700 transition';
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
"""

html = re.sub(r'function switchCustTab\(tabName\) \{[\s\S]*?if \(tabName === \'wallet\'\) loadWalletData\(\);\s*\}', new_switch_tab_js.strip(), html)

# 4. Kiểm tra và sửa triệt để nút Mua Thẻ trong renderProgramsList
# Khi khách đã có thẻ (currentCard != null) -> Tuyệt đối ẩn nút mua thẻ, thay bằng box trạng thái đã mua
fix_render_prog_card = """
    function renderProgramsList(programs, cardObj) {
      const container = document.getElementById('customerProgramsList');
      if (!container) return;
      container.innerHTML = '';
      availablePrograms = programs || [];

      if (!programs || programs.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-2">Hiện chưa có chương trình nào mở bán.</p>';
        return;
      }

      // Kiểm tra chắc chắn khách đang có thẻ active
      const hasActiveCard = !!(cardObj || currentCard);
      const activeCardData = cardObj || currentCard;

      programs.forEach(p => {
        const cardPriceFormatted = Number(p.card_price || 10000).toLocaleString() + 'đ';
        const aovMinFormatted = Number(p.aov_min || 20000).toLocaleString() + 'đ';
        const remainingUses = hasActiveCard ? (10 - Number(activeCardData.uses_count || 0)) : 10;

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

          <!-- Thể lệ -->
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
                ? `<div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center shadow-sm">
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

      // Banner Tháng 10
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

html = re.sub(r'function renderProgramsList[\s\S]*?container\.appendChild\(octoberBanner\);\s*\}', fix_render_prog_card.strip(), html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Applied: bottom tab bar & removed buy button when customer has active card!")

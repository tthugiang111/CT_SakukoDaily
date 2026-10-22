import re

# 1. FIX ADMIN.HTML: Thêm modal / overlay chặn truy cập nếu chưa đăng nhập Lark
admin_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/admin.html'
with open(admin_path, 'r', encoding='utf-8') as f:
    admin_html = f.read()

# Chặn toàn bộ nội dung admin bằng overlay đăng nhập Lark nếu chưa có cookie / session
lark_modal = """
  <!-- LARK AUTH OVERLAY: BẮT BUỘC ĐĂNG NHẬP LARK MỚI THẤY GIAO DIỆN -->
  <div id="larkAuthOverlay" class="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
    <div class="card-clean max-w-md w-full p-8 rounded-3xl bg-white shadow-2xl text-center space-y-6 border border-slate-200">
      <div class="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl shadow-sm">
        <i class="fa-solid fa-shield-halved"></i>
      </div>
      <div class="space-y-2">
        <h2 class="text-xl font-black text-slate-900 tracking-tight">Cổng Quản Trị Hệ Thống Thẻ NBT</h2>
        <p class="text-xs text-slate-500 leading-relaxed">
          Khu vực bảo mật nội bộ Sakuko. Chỉ tài khoản quản trị được phân quyền (Admin HO / Quản lý) mới có quyền truy cập.
        </p>
      </div>
      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-1">
        <div class="font-bold text-slate-800 flex items-center">
          <i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i> Xác thực tài khoản doanh nghiệp:
        </div>
        <p>• Bắt buộc đăng nhập tài khoản Lark Suite chính thức.</p>
        <p>• Hệ thống đối soát quyền hạn tự động qua Open ID.</p>
      </div>
      <a href="/api/admin/lark/login"
        class="w-full py-3.5 rounded-2xl bg-[#00D6B9] hover:bg-[#00c2a7] text-slate-900 font-black text-sm shadow-lg shadow-teal-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2">
        <i class="fa-solid fa-arrow-right-to-bracket text-base"></i>
        <span>Đăng Nhập Bằng Lark Suite</span>
      </a>
      <div class="text-[11px] text-slate-400">
        Phiên bản 2.4 · Sakuko Vietnam Retail Management
      </div>
    </div>
  </div>
"""

# Chèn overlay vào đầu thẻ <body>
if 'id="larkAuthOverlay"' not in admin_html:
    admin_html = admin_html.replace('<body class="bg-slate-50 text-slate-800 antialiased font-sans">',
                                    '<body class="bg-slate-50 text-slate-800 antialiased font-sans">\n' + lark_modal)

# Sửa hàm checkAuth trong admin.html để overlay hiển thị chuẩn
admin_html = re.sub(
    r'function showAuthOverlay\(\) \{[\s\S]*?\}',
    '''function showAuthOverlay() {
      const overlay = document.getElementById('larkAuthOverlay');
      if (overlay) overlay.classList.remove('hidden');
      document.getElementById('loggedOutSection')?.classList.remove('hidden');
      document.getElementById('loggedInSection')?.classList.add('hidden');
    }''',
    admin_html
)

with open(admin_path, 'w', encoding='utf-8') as f:
    f.write(admin_html)

print("Admin auth overlay added successfully!")

# 2. FIX INDEX.HTML:
# - Xóa khối voucherSection (ưu đãi lượt kế tiếp)
# - Xóa khối noCardSection (Kích hoạt thẻ Sakuko Daily cũ bên dưới)
# - Thêm CTKM Ưu Đãi Tháng 10 + link xem chi tiết sang https://sakukodaily.com.vn/blogs/news
index_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    index_html = f.read()

# Xóa voucherSection
index_html = re.sub(r'<!-- KHỐI VOUCHER LƯỢT KẾ TIẾP ĐỂ THU NGÂN QUÉT TẠI QUẦY -->[\s\S]*?<!-- ============================================ -->\s*<!-- SCREEN 5:',
                   '<!-- ============================================ -->\n      <!-- SCREEN 5:', index_html)

# Xóa noCardSection
index_html = re.sub(r'<!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->[\s\S]*?<!-- ============================================ -->',
                   '<!-- ============================================ -->', index_html)

# Cập nhật hàm renderCardAndVoucher để không đụng tới voucherSection / noCardSection đã xóa
index_html = re.sub(
    r'function renderCardAndVoucher\(data\) \{[\s\S]*?renderStampsGrid\(card, data\.usedToday\);',
    '''function renderCardAndVoucher(data) {
      const cardSec = document.getElementById('cardSection');
      if (!data.currentCard) {
        if (cardSec) cardSec.classList.add('hidden');
        return;
      }

      if (cardSec) cardSec.classList.remove('hidden');
      const card = data.currentCard;
      document.getElementById('cardProgramName').innerText = card.program_name || 'Thẻ Sakuko Daily';
      document.getElementById('cardProgressText').innerText = `${card.uses_count} / 10 lượt`;
      document.getElementById('cardProgressBar').style.width = `${(card.uses_count / 10) * 100}%`;

      renderStampsGrid(card, data.usedToday);''',
    index_html
)

# Bổ sung CTKM Tháng 10 vào danh sách chương trình trong renderProgramsList
october_promo_js = """
      // Thêm banner CTKM Ưu Đãi Tháng 10 theo yêu cầu
      const octoberBanner = document.createElement('div');
      octoberBanner.className = 'p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-200/80 space-y-3';
      octoberBanner.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              HOT · Ưu Đãi Tháng 10
            </span>
            <h4 class="font-bold text-slate-900 text-sm mt-1">Lễ Hội Mua Sắm Sakuko Daily - Tháng 10 Rực Rỡ</h4>
            <p class="text-[11px] text-slate-600 mt-0.5">Hàng ngàn deal sốc, giảm giá đồng loạt tại tất cả điểm bán trên toàn chuỗi.</p>
          </div>
          <span class="text-xs font-black text-rose-600 bg-white px-2 py-1 rounded-lg border border-rose-200 shadow-sm">Tháng 10</span>
        </div>

        <div class="p-3 bg-white/90 rounded-xl border border-amber-100 text-[11px] text-slate-600 space-y-1">
          <p>• Áp dụng đồng thời cùng Thẻ Tiết Kiệm NBT 10 lượt.</p>
          <p>• Ưu đãi riêng biệt cho từng điểm bán (Xuân Thủy, Kim Mã, Thái Hà,...).</p>
        </div>

        <a href="https://sakukodaily.com.vn/blogs/news" target="_blank" rel="noopener noreferrer"
          class="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 shadow-sm transition flex items-center justify-center">
          <i class="fa-solid fa-arrow-up-right-from-square mr-1.5 text-rose-500"></i> Xem Chi Tiết CTKM Từng Điểm Bán
        </a>
      `;
      container.appendChild(octoberBanner);
"""

index_html = re.sub(
    r'programs\.forEach\(p => \{[\s\S]*?container\.appendChild\(div\);\s*\}\);',
    lambda m: m.group(0) + '\n' + october_promo_js,
    index_html
)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_html)

print("Index UI updated: removed old voucher box & bottom box, added October promo with link!")

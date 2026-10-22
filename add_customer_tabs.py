import re

# 1. Bổ sung API trả về danh sách thẻ đã mua & lịch sử dùng ưu đãi cho khách
server_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js'
with open(server_path, 'r', encoding='utf-8') as f:
    server_code = f.read()

customer_cards_api = """
// API lấy toàn bộ thẻ của khách hàng (active, used_up, expired)
app.get('/api/customer/my-cards', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const client = await pool.connect();
    try {
      const cardsRes = await client.query(`
        SELECT c.*, p.name as program_name, p.end_date, p.card_price, p.item_code
        FROM cards c
        JOIN programs p ON c.program_id = p.id
        WHERE c.customer_id = $1
        ORDER BY c.id DESC
      `, [custId]);
      return res.json({ ok: true, cards: cardsRes.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh sách thẻ' });
  }
});

// API lấy lịch sử áp dụng voucher của khách hàng
app.get('/api/customer/redemption-history', customerAuth, async (req, res) => {
  try {
    const custId = req.customer.id;
    const client = await pool.connect();
    try {
      const historyRes = await client.query(`
        SELECT r.*, c.store_code, p.name as program_name
        FROM redemptions r
        JOIN cards c ON r.card_id = c.id
        JOIN programs p ON c.program_id = p.id
        WHERE c.customer_id = $1
        ORDER BY r.used_at DESC
      `, [custId]);
      return res.json({ ok: true, history: historyRes.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải lịch sử ưu đãi' });
  }
});
"""

if '/api/customer/my-cards' not in server_code:
    server_code = server_code.replace("app.get('/api/customer/me',", customer_cards_api + "\napp.get('/api/customer/me',")
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(server_code)
    print("Added /api/customer/my-cards & /api/customer/redemption-history to server.js")

# 2. Sửa index.html:
# - Tạo hệ thống 3 Tab cho Khách:
#   + Tab 1: Thẻ & Ưu Đãi (Màn hình 10 lượt hiện tại + Accordion thu gọn danh sách chương trình)
#   + Tab 2: Lịch Sử Đơn Hàng & Ưu Đãi (Ngày tháng năm giờ, mã đơn, mức giảm, điểm bán)
#   + Tab 3: Ví Thẻ Của Tôi (Quản lý các thẻ NBT đã mua, đang dùng, đã dùng hết)
# - Thu gọn danh sách chương trình thành Accordion (Mặc định đóng lại nếu đã có thẻ active, bấm vào mới bung thể lệ và nút mua)
# - Nếu đã có thẻ active: Ẩn nút "Mua thẻ ngay", hiện badge "Đang sử dụng thẻ này (còn X lượt)"
index_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    index_html = f.read()

# Thêm Navigation Tabs phía trên
tab_nav_html = """
        <!-- THANH ĐIỀU HƯỚNG TABS CHO KHÁCH HÀNG -->
        <div class="flex items-center justify-around bg-slate-200/80 p-1 rounded-2xl text-xs font-bold text-slate-600 shadow-inner">
          <button id="custTabBtn-home" onclick="switchCustTab('home')" class="flex-1 py-2 rounded-xl sakuko-tab-btn active bg-white text-rose-600 shadow-sm transition">
            <i class="fa-solid fa-ticket mr-1"></i> 10 Lượt
          </button>
          <button id="custTabBtn-history" onclick="switchCustTab('history')" class="flex-1 py-2 rounded-xl sakuko-tab-btn text-slate-600 hover:text-slate-900 transition">
            <i class="fa-solid fa-clock-rotate-left mr-1"></i> Lịch Sử
          </button>
          <button id="custTabBtn-wallet" onclick="switchCustTab('wallet')" class="flex-1 py-2 rounded-xl sakuko-tab-btn text-slate-600 hover:text-slate-900 transition">
            <i class="fa-solid fa-wallet mr-1"></i> Ví Thẻ
          </button>
        </div>
"""

# Chèn tab navigation vào đầu screenCustomerHome
if 'id="custTabBtn-home"' not in index_html:
    index_html = index_html.replace(
        '<div id="screenCustomerHome" class="hidden space-y-4">',
        '<div id="screenCustomerHome" class="hidden space-y-4">\n' + tab_nav_html + '\n        <div id="custTabContent-home" class="space-y-4">'
    )

# Thêm các tab contents: history & wallet
tabs_content_html = """
        </div> <!-- End custTabContent-home -->

        <!-- TAB 2: LỊCH SỬ ÁP DỤNG ƯU ĐÃI & ĐƠN HÀNG -->
        <div id="custTabContent-history" class="hidden space-y-4">
          <div class="sakuko-light-card p-5 rounded-3xl space-y-3.5 border border-slate-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="flex items-center space-x-2">
                <div class="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">
                  <i class="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <h3 class="text-xs font-black uppercase text-slate-900 tracking-tight">Lịch Sử Sử Dụng Ưu Đãi</h3>
                  <span class="text-[10px] text-slate-500 font-medium">Chi tiết ngày giờ áp dụng voucher tại quầy</span>
                </div>
              </div>
            </div>
            <div id="historyListContainer" class="space-y-2.5">
              <!-- Render JS -->
            </div>
          </div>
        </div>

        <!-- TAB 3: VÍ THẺ CỦA TÔI (QUẢN LÝ CÁC THẺ ĐÃ MUA) -->
        <div id="custTabContent-wallet" class="hidden space-y-4">
          <div class="sakuko-light-card p-5 rounded-3xl space-y-3.5 border border-slate-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="flex items-center space-x-2">
                <div class="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">
                  <i class="fa-solid fa-wallet"></i>
                </div>
                <div>
                  <h3 class="text-xs font-black uppercase text-slate-900 tracking-tight">Ví Thẻ Sakuko Daily</h3>
                  <span class="text-[10px] text-slate-500 font-medium">Toàn bộ thẻ ảo đã kích hoạt theo SĐT</span>
                </div>
              </div>
            </div>
            <div id="walletCardsContainer" class="space-y-3">
              <!-- Render JS -->
            </div>
          </div>
        </div>
"""

if 'id="custTabContent-history"' not in index_html:
    index_html = index_html.replace('<!-- MODAL CHI TIẾT VOUCHER BARCODE', tabs_content_html + '\n  <!-- MODAL CHI TIẾT VOUCHER BARCODE')

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_html)

print("Added tabs UI to index.html successfully")

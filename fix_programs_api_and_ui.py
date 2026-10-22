import re

# 1. Bổ sung trường programs vào response của /api/customer/me trong server.js
server_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js'
with open(server_path, 'r', encoding='utf-8') as f:
    server_code = f.read()

# Đảm bảo trả về mảng allPrograms trong /api/customer/me
old_me_return = """return res.json({
        ok: true,
        customer: custRes.rows[0],
        activeProgram,
        currentCard,
        usedToday,
        nextVoucher
      });"""

new_me_return = """const allProgsRes = await client.query("SELECT * FROM programs WHERE status = 'active' ORDER BY id DESC;");
      return res.json({
        ok: true,
        customer: custRes.rows[0],
        activeProgram,
        programs: allProgsRes.rows,
        currentCard,
        usedToday,
        nextVoucher
      });"""

if 'allProgsRes' not in server_code:
    server_code = server_code.replace(old_me_return, new_me_return)
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(server_code)
    print("Updated /api/customer/me to return programs list!")

# 2. Cập nhật index.html để:
# - Đưa danh sách chương trình ưu đãi hiển thị đầy đủ ngay cả khi render ban đầu
# - Nếu khách đã có thẻ (currentCard != null): TUYỆT ĐỐI KHÔNG HIỂN THỊ NÚT MUA THẺ NÀO
index_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    index_html = f.read()

# Sửa hàm loadCustomerData để truyền thẳng data.programs vào renderProgramsList
index_html = re.sub(
    r'renderProgramsList\(data\.programs[\s\S]*?\);',
    'renderProgramsList(data.programs || (data.activeProgram ? [data.activeProgram] : []), data.currentCard);',
    index_html
)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_html)

print("Updated index.html: hooked programs array cleanly!")

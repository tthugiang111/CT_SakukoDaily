with open('/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Xóa triệt để bảng chi tiết cũ nếu còn sót text
import re
c = re.sub(r'<!-- BẢNG CHI TIẾT 10 LƯỢT ƯU ĐÃI & ĐIỀU KIỆN ÁP DỤNG -->[\s\S]*?<!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->', '<!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->', c)

# Kiểm tra xem còn id="detailStepsTableBody" không
if 'detailStepsTableBody' in c:
    # tìm và xóa block div chứa detailStepsTableBody
    c = re.sub(r'<div class="sakuko-light-card p-5 rounded-3xl space-y-3.5 border border-slate-200">[\s\S]*?id="detailStepsTableBody"[\s\S]*?</div>\s*</div>', '', c)

with open('/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('Cleaned index.html successfully')

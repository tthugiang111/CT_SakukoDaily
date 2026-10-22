import re

file_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Bảng chi tiết 10 lượt ưu đãi và điều kiện áp dụng
detail_table_html = """
        <!-- BẢNG CHI TIẾT 10 LƯỢT ƯU ĐÃI & ĐIỀU KIỆN ÁP DỤNG -->
        <div class="sakuko-light-card p-5 rounded-3xl space-y-3.5 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div class="flex items-center space-x-2">
              <div class="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
                <i class="fa-solid fa-list-check"></i>
              </div>
              <h3 class="text-xs font-bold text-slate-900 uppercase tracking-tight">Chi Tiết Lộ Trình 10 Lượt Ưu Đãi</h3>
            </div>
            <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Tổng giảm 60.000đ</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 border-b border-slate-100 text-[11px]">
                  <th class="pb-2 font-semibold">Lượt</th>
                  <th class="pb-2 font-semibold">Mức Giảm</th>
                  <th class="pb-2 font-semibold">Đơn Tối Thiểu</th>
                  <th class="pb-2 font-semibold text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody id="detailStepsTableBody" class="divide-y divide-slate-100 text-[11px]">
                <!-- Render bằng JS theo tiến độ thực tế của khách -->
              </tbody>
            </table>
          </div>

          <!-- Điều kiện tóm tắt -->
          <div class="p-3 bg-slate-50 rounded-2xl text-[10px] text-slate-500 space-y-1 border border-slate-100">
            <div class="font-bold text-slate-700 flex items-center">
              <i class="fa-solid fa-circle-info mr-1.5 text-rose-500"></i> Điều kiện sử dụng:
            </div>
            <p>• Tối đa 1 lượt/ngày. Đơn từ 20.000đ sau khi trừ các khuyến mại khác.</p>
            <p>• Mua thẻ hôm nay, từ ngày mai mới bắt đầu được dùng lượt 1.</p>
            <p>• Dùng hết 10 lượt mới được mua thẻ mới nếu chương trình còn mở.</p>
          </div>
        </div>
"""

# Chèn bảng này ngay sau stampsGrid / cardSection
if 'id="detailStepsTableBody"' not in html:
    html = html.replace('</div>\n\n        <!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->', '</div>\n' + detail_table_html + '\n        <!-- TRƯỜNG HỢP CHƯA CÓ THẺ HOẶC HẾT LƯỢT -->')

# Bổ sung JS render bảng chi tiết theo currentCard
render_table_js = """
      // Render bảng chi tiết 10 lượt
      const tableBody = document.getElementById('detailStepsTableBody');
      if (tableBody) {
        tableBody.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
          const isDone = i <= card.uses_count;
          const isCurrent = (i === Number(card.uses_count) + 1);
          const isBig = (i === 5 || i === 10);
          const discountStr = isBig ? 'Giảm 10.000đ' : 'Giảm 5.000đ';
          
          let statusBadge = '';
          if (isDone) {
            statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Đã dùng</span>';
          } else if (isCurrent) {
            statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 animate-pulse">Lượt tiếp theo</span>';
          } else {
            statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400 bg-slate-100">Chưa mở</span>';
          }

          const tr = document.createElement('tr');
          tr.className = isCurrent ? 'bg-rose-50/50 font-bold' : 'hover:bg-slate-50';
          tr.innerHTML = `
            <td class="py-2 font-mono ${isBig ? 'text-rose-600 font-bold' : 'text-slate-800'}">Lượt #${i}</td>
            <td class="py-2 font-bold ${isBig ? 'text-rose-600' : 'text-slate-900'}">${discountStr}</td>
            <td class="py-2 text-slate-500">Từ 20.000đ</td>
            <td class="py-2 text-right">${statusBadge}</td>
          `;
          tableBody.appendChild(tr);
        }
      }
"""

if 'detailStepsTableBody' in html and 'const tableBody = document.getElementById(\'detailStepsTableBody\');' not in html:
    html = html.replace('grid.appendChild(div);\n      }', 'grid.appendChild(div);\n      }\n' + render_table_js)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Added detailed table to client view successfully")

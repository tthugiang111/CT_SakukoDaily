const fs = require('fs');

// ==========================================
// 1. SỬA SERVER.JS: XÓA DIRECT-LOGIN, BỔ SUNG RECENT CUSTOMERS VÀO DETAILED-REPORTS
// ==========================================
let serverCode = fs.readFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/server.js', 'utf8');

// Bỏ direct-login để bắt buộc qua Lark OAuth
serverCode = serverCode.replace(/\/\/ Route đăng nhập nhanh dành riêng cho chị Trần Thị Thu Giang[\s\S]*?return res\.redirect\('\/admin\.html'\);\s*\}\);/, '');

// Đảm bảo /api/admin/detailed-reports trả về danh sách toàn bộ khách hàng & thẻ
const oldDetailedReturn = `return res.json({
        ok: true,
        funnel: funnelRes.rows,
        cardStats: cardStatsRes.rows,
        finance: financeRes.rows[0],
        dormantCards: dormantRes.rows,
        violations: violationsRes.rows,
        posDevices: posRes.rows,
        programs: programsRes.rows,
        stores: storesRes.rows
      });`;

const newDetailedReturn = `const customersListRes = await client.query(\`
        SELECT 
          c.id, c.phone, c.status as cust_status, c.created_at,
          cd.id as card_id, cd.status as card_status, cd.uses_count, 
          cd.purchased_at, cd.usable_from, COALESCE(cd.store_code, 'XT') as store_code,
          p.name as program_name
        FROM customers c
        LEFT JOIN cards cd ON c.id = cd.customer_id
        LEFT JOIN programs p ON cd.program_id = p.id
        ORDER BY c.id DESC;
      \`);

      return res.json({
        ok: true,
        funnel: funnelRes.rows,
        cardStats: cardStatsRes.rows,
        finance: financeRes.rows[0],
        dormantCards: dormantRes.rows,
        violations: violationsRes.rows,
        posDevices: posRes.rows,
        programs: programsRes.rows,
        stores: storesRes.rows,
        customers: customersListRes.rows
      });`;

serverCode = serverCode.replace(oldDetailedReturn, newDetailedReturn);
fs.writeFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/server.js', serverCode);
console.log('server.js updated');

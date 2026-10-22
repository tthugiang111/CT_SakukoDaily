const fs = require('fs');

const indexHtml = fs.readFileSync('/home/node/.openclaw/workspace/projects/WebTheNBT/public/index.html', 'utf8');

console.log('Has detailStepsTableBody:', indexHtml.includes('detailStepsTableBody'));
console.log('Has voucherModal:', indexHtml.includes('voucherModal'));
console.log('Has stampsGrid:', indexHtml.includes('stampsGrid'));

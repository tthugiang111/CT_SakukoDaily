const fs = require('fs');

// 1. Đọc LARK_APP_SECRET từ cham-diem
const chamDiemEnv = fs.readFileSync('/home/node/.openclaw/workspace/projects/ChamDiemNhanSu_ST/cham-diem/backend/.env', 'utf8');
const secretMatch = chamDiemEnv.match(/^LARK_APP_SECRET=(.*)$/m);
const larkSecret = secretMatch ? secretMatch[1].trim() : '';

// 2. Cập nhật .env của WebTheNBT
const nbtEnvPath = '/home/node/.openclaw/workspace/projects/WebTheNBT/.env';
let nbtEnv = fs.existsSync(nbtEnvPath) ? fs.readFileSync(nbtEnvPath, 'utf8') : '';

const larkConfig = `
LARK_APP_ID=cli_aaf7321fa3f8ded1
LARK_APP_SECRET=${larkSecret}
LARK_DOMAIN=https://open.larksuite.com
LARK_REDIRECT_URI=https://terminology-bye-clay-gay.trycloudflare.com/api/admin/lark/callback
`;

if (!nbtEnv.includes('LARK_APP_ID')) {
  nbtEnv += '\n' + larkConfig;
  fs.writeFileSync(nbtEnvPath, nbtEnv);
}

console.log('Updated .env for WebTheNBT with Lark OAuth config');

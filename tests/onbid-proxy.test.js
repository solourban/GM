const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'src', 'server.js');
const server = fs.readFileSync(SERVER_PATH, 'utf8');

function fail(message) {
  console.error(`Onbid proxy guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

requireIncludes(server, "app.get('/api/onbid/items'", 'Onbid items proxy route');
requireIncludes(server, 'OnbidRlstListSrvc/getRlstCltrList', 'Onbid real estate list upstream call in server');
requireIncludes(server, 'process.env.ONBID_API_KEY', 'Onbid server-side environment variable usage');
requireIncludes(server, 'hasOnbid', 'Onbid config status flag');

console.log('Onbid proxy guard passed.');

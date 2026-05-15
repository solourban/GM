const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TARGET_EXTENSIONS = new Set(['.js', '.html', '.css']);

const FORBIDDEN_PATTERNS = [
  { name: 'OpenAI style API key', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Kakao REST authorization header', pattern: /KakaoAK\s+[A-Za-z0-9._-]+/ },
  { name: 'Direct data.go.kr serviceKey query', pattern: /[?&]serviceKey=/i },
  { name: 'Kakao REST env name in public asset', pattern: /KAKAO_REST_API_KEY/ },
  { name: 'Kakao local env name in public asset', pattern: /KAKAO_LOCAL_API_KEY/ },
  { name: 'MOLIT env name in public asset', pattern: /MOLIT_API_KEY/ },
  { name: 'data.go.kr env name in public asset', pattern: /DATA_GO_KR_KEY/ },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile()) return [];
    return TARGET_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

const failures = [];
for (const file of walk(PUBLIC_DIR)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN_PATTERNS) {
    const match = content.match(rule.pattern);
    if (match) {
      failures.push(`${relative(file)}: ${rule.name}`);
    }
  }
}

if (failures.length) {
  console.error('Public asset secret exposure guard failed:');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Public asset secret exposure guard passed. Checked ${walk(PUBLIC_DIR).length} files.`);

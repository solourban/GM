const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TARGET_EXTENSIONS = new Set(['.js', '.html', '.css']);

const FORBIDDEN_PATTERNS = [
  { name: 'OpenAI style API key', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Kakao REST authorization token', pattern: /KakaoAK\s+[A-Za-z0-9._-]{20,}/ },
  { name: 'data.go.kr encoded service key', pattern: /serviceKey=([A-Za-z0-9%+/=_-]{30,})/i },
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

function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

const files = walk(PUBLIC_DIR);
const failures = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN_PATTERNS) {
    const match = rule.pattern.exec(content);
    if (match) failures.push(`${relative(file)}:${lineNumber(content, match.index)} ${rule.name}`);
  }
}

if (failures.length) {
  console.error('Public asset secret exposure guard failed:');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Public asset secret exposure guard passed. Checked ${files.length} files.`);

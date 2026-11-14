// 빌드 스크립트: src/ → dist/
// 1) 이미지 등 파일 내용으로 해시를 만들어 파일명에 붙임 (logo.png → logo.a1b2c3d4.png)
// 2) CSS 안의 이미지 경로를 해시 이름으로 바꾼 뒤, CSS 자체도 해시
// 3) HTML 안의 경로를 해시 이름으로 바꿈 (HTML = 최신 파일을 가리키는 "포인터")
// 4) 원래 이름 → 해시 이름 표를 dist/manifest.json 으로 저장
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const HASH_LEN = 8;

// src 안의 모든 파일 목록 (src 기준 상대경로, 슬래시 구분)
function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.name.startsWith('.')) return [];
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);

function hashedName(rel, buf) {
  const ext = path.posix.extname(rel);
  return `${rel.slice(0, -ext.length)}.${hashOf(buf)}${ext}`;
}

function write(rel, content) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
}

// 파일(fromRel) 안의 src="", href="", url() 경로를 manifest 대로 교체
function rewriteRefs(text, fromRel, manifest) {
  const fromDir = path.posix.dirname(fromRel);
  const swap = (ref) => {
    if (/^(https?:|data:|#|\/\/|mailto:)/.test(ref)) return ref;
    const [clean, suffix = ''] = ref.split(/(?=[?#])/);
    const key = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(fromDir, clean));
    if (!manifest[key]) return ref;
    const target = clean.startsWith('/') ? '/' + manifest[key] : path.posix.relative(fromDir, manifest[key]);
    return target + suffix;
  };
  return text
    .replace(/(\s(?:src|href)=["'])([^"']+)(["'])/g, (_, a, ref, b) => a + swap(ref) + b)
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_, q, ref) => `url(${q}${swap(ref)}${q})`);
}

// ---------- 실행 ----------
fs.rmSync(DIST, { recursive: true, force: true });
const files = listFiles(SRC);
const manifest = {};

// 1) HTML/CSS 가 아닌 파일 (이미지, 폰트, js 등): 그대로 해시
for (const rel of files.filter((f) => !/\.(html|css)$/.test(f))) {
  const buf = fs.readFileSync(path.join(SRC, rel));
  manifest[rel] = hashedName(rel, buf);
  write(manifest[rel], buf);
}

// 2) CSS: 안의 이미지 경로를 먼저 바꾸고 → 바뀐 내용으로 해시
for (const rel of files.filter((f) => f.endsWith('.css'))) {
  const css = rewriteRefs(fs.readFileSync(path.join(SRC, rel), 'utf8'), rel, manifest);
  manifest[rel] = hashedName(rel, Buffer.from(css));
  write(manifest[rel], css);
}

// 3) HTML: 해시 안 붙임 (항상 같은 주소 = 포인터), 안의 경로만 교체
for (const rel of files.filter((f) => f.endsWith('.html'))) {
  write(rel, rewriteRefs(fs.readFileSync(path.join(SRC, rel), 'utf8'), rel, manifest));
}

// 4) manifest 저장
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

console.log('✅ 빌드 완료 → dist/');
for (const [from, to] of Object.entries(manifest)) console.log(`   ${from.padEnd(18)} → ${to}`);

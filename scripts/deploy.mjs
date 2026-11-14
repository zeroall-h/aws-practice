// 배포 스크립트: 현재 git 브랜치를 보고 어디로 배포할지 결정
//   main    → 운영(production)
//   develop → 개발(development)
// 사용법: npm run deploy            (실제 배포)
//         npm run deploy -- --dry   (실제로 올리지 않고 무엇을 할지만 출력)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DRY = process.argv.includes('--dry');
const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
};

// 1) 브랜치 확인
let branch;
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
} catch {
  console.error('❌ git 저장소가 아니에요. 먼저 git init 을 해주세요 (README 참고).');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'deploy.config.json'), 'utf8'));
const target = config[branch];
if (!target) {
  console.error(`❌ "${branch}" 브랜치는 배포 대상이 아니에요. main 또는 develop 에서 실행하세요.`);
  process.exit(1);
}
console.log(`🚀 브랜치: ${branch} → ${target.name} (s3://${target.bucket})${DRY ? '  [DRY RUN]' : ''}`);

// 2) 빌드
run('node scripts/build.mjs');

const dry = DRY ? ' --dryrun' : '';
const s3 = `s3://${target.bucket}`;

// 3) 해시 붙은 파일들: 1년 캐시 (이름이 바뀌면 다른 파일이므로 안전)
run(`aws s3 sync dist ${s3} --exclude "*.html" --exclude "manifest.json" ` +
    `--cache-control "public,max-age=31536000,immutable"${dry}`);

// 4) 포인터 파일들(html, manifest): 캐시 금지 → 항상 최신을 가리키게
run(`aws s3 cp dist ${s3} --recursive --exclude "*" --include "*.html" --include "manifest.json" ` +
    `--cache-control "no-cache"${dry}`);

// 5) CloudFront 를 쓰는 경우: 포인터 파일만 캐시 비우기
if (target.cloudfrontDistributionId) {
  const inv = `aws cloudfront create-invalidation --distribution-id ${target.cloudfrontDistributionId} ` +
              `--paths "/index.html" "/manifest.json" "/"`;
  DRY ? console.log(`\n(dry) ${inv}`) : run(inv);
}

console.log(`\n✅ ${target.name} 배포 완료${DRY ? ' (DRY RUN — 실제로 올라가진 않았어요)' : ''}`);
if (target.url) console.log(`   👉 ${target.url}`);

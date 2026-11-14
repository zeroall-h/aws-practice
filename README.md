# moum-practice — 해시 + 포인터 + 브랜치별 배포 연습

## 이 프로젝트가 하는 일

```
src/ 에서 html, css, img 수정
        │
        ▼  npm run build
dist/
 ├── index.html               ← 포인터: 이름이 안 바뀜, 안의 경로만 최신 해시로 교체
 ├── manifest.json            ← 포인터 표: 원래 이름 → 해시 이름
 ├── css/style.66d0202d.css   ← 해시 붙음
 └── img/logo.72561691.png    ← 해시 붙음 (내용이 바뀐 파일만 해시가 바뀜)
        │
        ▼  npm run deploy
main 브랜치    → 운영 버킷 (amzn-rabbit)
develop 브랜치 → 개발 버킷 (amzn-rabbit-dev)
그 외 브랜치    → 배포 거부
```

**해시 규칙**
- 이미지 하나를 고치면 그 이미지의 해시만 바뀝니다.
- CSS 안에서 쓰는 이미지가 바뀌면, CSS 내용(경로)도 바뀌므로 CSS 해시도 같이 바뀝니다.
- index.html은 해시를 붙이지 않아요. 항상 같은 주소로 접속해야 하기 때문입니다.

**캐시 규칙** (deploy가 자동으로 설정)
| 파일 | 캐시 | 이유 |
|---|---|---|
| 해시 붙은 파일 | 1년 | 내용이 바뀌면 이름도 바뀌니까 오래 캐시해도 안전 |
| index.html, manifest.json | 캐시 안 함 | 포인터는 항상 최신이어야 함 |

## 처음 한 번만 하는 준비

1. **설치**: Node.js(LTS), Git, AWS CLI v2
   - 터미널에서 `node -v`, `git --version`, `aws --version`이 모두 나오면 OK
2. **AWS CLI 로그인 연결**: `aws configure` (IAM 사용자 액세스 키 필요 — 같이 진행 예정)
3. **개발용 버킷 만들기**: 오늘 amzn-rabbit에 했던 4단계를 `amzn-rabbit-dev`라는 이름으로 한 번 더
   (정적 웹 사이트 호스팅 → 퍼블릭 액세스 차단 해제 → 버킷 정책)
4. **git 저장소 만들기** (VS Code 터미널에서, 이 폴더 안에서):
   ```bash
   git init -b main
   git add -A
   git commit -m "first"
   git branch develop
   ```

## 매일 쓰는 명령어

```bash
npm run build             # dist/ 만들기 (배포 없이 결과만 확인)
npm run deploy -- --dry   # 실제로 올리지 않고, 무엇을 할지만 보여줌
npm run deploy            # 현재 브랜치에 맞는 서버로 배포
```

브랜치 바꾸기:
```bash
git checkout develop      # 개발 서버로 배포하고 싶을 때
git checkout main         # 운영 서버로 배포하고 싶을 때
```

## 설정 파일: deploy.config.json
브랜치별 버킷 이름, CloudFront ID, 사이트 주소가 들어 있어요.
CloudFront를 붙이면 `cloudfrontDistributionId`에 ID를 넣으세요. 그러면 배포할 때 포인터 파일 캐시를 자동으로 비웁니다.

## 참고
- 예전 해시 파일은 S3에서 지우지 않아요. 아직 옛 index.html을 보고 있는 사용자가 깨지지 않게 하려는 거라 정상입니다.
- 회사 moum의 실제 구조와 도구는 다를 수 있어요. 이건 같은 원리를 직접 짜 본 연습용입니다.

# 배포 가이드

## Preview 배포

Preview는 Production Worker/D1과 분리한다. Wrangler 환경별 설정에서 별도 D1 binding을 사용할 수 있으므로, Preview용 D1을 별도로 생성하고 그 ID를 GitHub Actions secret으로 주입한다.

현재 Preview workflow는 자동 실행하지 않고 `workflow_dispatch`로 수동 실행한다. 인증 정보와 Preview 리소스가 준비된 뒤 GitHub Actions에서 실행한다.

### 필요한 GitHub Actions Secrets

- `CLOUDFLARE_API_TOKEN`: Worker 배포 권한을 가진 Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
- `PREVIEW_D1_DATABASE_ID`: Preview 전용 D1 database ID
- `PREVIEW_APP_BASE_URL`: Preview Worker의 HTTPS 기본 URL
- `PREVIEW_KAKAO_REDIRECT_URI`: Kakao Developers에 등록할 Preview callback URL

`CLOUDFLARE_API_TOKEN`은 저장소에 직접 기록하지 않는다. Cloudflare는 CI/CD에서 API token과 account ID를 사용하도록 안내하고 있으며, token은 가능한 최소 권한으로 제한하는 것을 권장한다.

### Preview D1 준비

로컬에서 Wrangler 로그인 후 Preview 전용 D1을 생성한다.

```bash
npx wrangler d1 create kakao-account-db-preview
```

출력된 database ID를 `PREVIEW_D1_DATABASE_ID` secret에 등록한다. Production D1 ID를 Preview에 재사용하지 않는다.

### Preview Worker URL

Preview Worker는 `kakao-account-api-preview` 이름으로 배포된다. `PREVIEW_APP_BASE_URL`에는 실제 배포 URL을 입력하고, `PREVIEW_KAKAO_REDIRECT_URI`에는 그 URL의 `/auth/kakao/callback` 경로를 입력한다.

Kakao Developers에서도 동일한 callback URL을 허용된 Redirect URI로 등록해야 한다.

### 실행

GitHub의 Actions에서 `Preview Deploy` workflow를 수동 실행한다.

workflow는 다음 순서로 동작한다.

1. dependencies 설치
2. lint
3. typecheck
4. test
5. Preview secret 존재 여부 검증
6. Preview Wrangler 설정 파일 생성
7. Preview D1 migration 적용
8. Preview Worker 배포

Preview용 Kakao REST API key/client secret은 아직 Worker secret 자동 주입 대상에 포함하지 않는다. 따라서 `/health` 등 공개 endpoint 배포 검증을 먼저 수행하고, Kakao OAuth를 Preview에서 실제 검증할 때 별도 secret 배포 절차를 추가한다.

## Production 배포

Production 자동 배포는 Preview 검증과 별도로 구성한다. Production D1 migration은 배포와 분리해 승인 가능한 절차로 운영하고, 실제 Production secret과 redirect URI를 확인한 뒤 활성화한다.

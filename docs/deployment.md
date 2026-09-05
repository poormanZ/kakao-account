# 배포 가이드

## Preview 배포

Preview는 Production Worker/D1과 분리한다. Preview용 D1을 별도로 생성하고 그 ID를 GitHub Actions secret으로 주입한다.

현재 Preview workflow는 자동 실행하지 않고 `workflow_dispatch`로 수동 실행한다.

### 필요한 GitHub Actions Secrets

- `CLOUDFLARE_API_TOKEN`: Worker/D1 배포에 필요한 Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
- `PREVIEW_D1_DATABASE_ID`: Preview 전용 D1 database ID

`CLOUDFLARE_API_TOKEN`은 저장소에 직접 기록하지 않는다. CI/CD에서는 가능한 최소 권한의 token을 사용한다.

Preview Worker URL과 Kakao callback URL은 더 이상 GitHub Secret으로 미리 입력하지 않는다. 첫 번째 bootstrap 배포에서 Wrangler가 발급한 `workers.dev` HTTPS URL을 자동으로 찾아 최종 설정에 반영한다.

### Preview D1 준비

로컬에서 Wrangler 로그인 후 Preview 전용 D1을 생성한다.

```bash
npx wrangler d1 create kakao-account-db-preview
```

출력된 database ID를 `PREVIEW_D1_DATABASE_ID` secret에 등록한다. Production D1 ID를 Preview에 재사용하지 않는다.

### Preview Worker URL

Preview Worker는 `kakao-account-api-preview` 이름으로 배포된다.

URL을 미리 알 필요가 없도록 workflow가 다음 순서로 처리한다.

1. OAuth callback URL에 임시 placeholder를 넣은 bootstrap 배포
2. Wrangler 출력에서 실제 `workers.dev` HTTPS URL 탐색
3. 탐색한 URL을 `APP_BASE_URL`로 설정
4. `${APP_BASE_URL}/auth/kakao/callback`을 `KAKAO_REDIRECT_URI`로 설정
5. Preview D1 migration 적용
6. 실제 URL을 포함한 설정으로 최종 Worker 재배포

따라서 Preview workflow를 처음 실행한 뒤 GitHub Actions 로그에서 `Preview Worker URL`을 확인할 수 있다.

> 이 방식은 `workers.dev` URL을 자동으로 발견하는 것을 전제로 한다. Cloudflare 계정에서 `workers.dev`가 비활성화되어 있거나 Preview에 custom domain만 사용할 경우에는 별도의 URL 입력 방식이 필요하다.

### Kakao Developers 설정

첫 Preview 배포가 성공하면 Actions 로그의 실제 HTTPS 주소를 확인한다.

예:

```text
https://kakao-account-api-preview.<account-subdomain>.workers.dev
```

Kakao Developers의 Redirect URI에는 다음 주소를 등록한다.

```text
https://kakao-account-api-preview.<account-subdomain>.workers.dev/auth/kakao/callback
```

Kakao OAuth 실제 테스트 전에는 Preview Worker에 사용할 Kakao REST API key/client secret을 별도 secret 배포 절차로 추가해야 한다. 현재 workflow는 `/health` 등 공개 endpoint 배포 검증을 우선한다.

### 실행

GitHub의 Actions에서 `Preview Deploy` workflow를 수동 실행한다.

workflow는 다음 순서로 동작한다.

1. dependencies 설치
2. lint
3. typecheck
4. test
5. Cloudflare/Preview D1 secret 검증
6. bootstrap Wrangler 설정 생성
7. Preview Worker bootstrap 배포 및 HTTPS URL 탐색
8. 실제 URL을 포함한 최종 Wrangler 설정 생성
9. Preview D1 migration 적용
10. 최종 Preview Worker 배포

## Production 배포

Production 자동 배포는 Preview 검증과 별도로 구성한다. Production D1 migration은 배포와 분리해 승인 가능한 절차로 운영하고, 실제 Production secret과 redirect URI를 확인한 뒤 활성화한다.

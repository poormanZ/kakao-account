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

Kakao OAuth 실제 테스트 전에는 Preview Worker에 사용할 Kakao REST API key/client secret을 별도 secret 배포 절차로 추가해야 한다. 현재 Preview workflow는 `/health` 등 공개 endpoint 배포 검증을 우선한다.

### Preview URL 자동 구성

Preview workflow는 다음 순서로 동작한다.

1. OAuth callback URL에 임시 placeholder를 넣은 bootstrap 배포
2. Wrangler 출력에서 실제 `workers.dev` HTTPS URL 탐색
3. 탐색한 URL을 `APP_BASE_URL`로 설정
4. `${APP_BASE_URL}/auth/kakao/callback`을 `KAKAO_REDIRECT_URI`로 설정
5. Preview D1 migration 적용
6. 실제 URL을 포함한 설정으로 최종 Worker 재배포

따라서 Preview workflow를 처음 실행한 뒤 GitHub Actions 로그에서 `Preview Worker URL`을 확인할 수 있다.

> 이 방식은 `workers.dev` URL을 자동으로 발견하는 것을 전제로 한다. Cloudflare 계정에서 `workers.dev`가 비활성화되어 있거나 Preview에 custom domain만 사용할 경우에는 별도의 URL 입력 방식이 필요하다.

## Production 배포

Production 배포도 현재는 `workflow_dispatch`로 수동 실행한다. Preview가 정상 배포된 뒤 Production 환경의 secret과 Kakao Redirect URI를 확인하고 실행한다.

### 필요한 GitHub Actions Secrets

Production workflow는 GitHub의 `production` Environment를 사용한다.

- `CLOUDFLARE_API_TOKEN`: Cloudflare Worker/D1 배포용 API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
- `PRODUCTION_D1_DATABASE_ID`: Production D1 database ID
- `PRODUCTION_KAKAO_REST_API_KEY`: Kakao Developers의 Production REST API key
- `PRODUCTION_KAKAO_CLIENT_SECRET`: Kakao Developers의 Production client secret

Cloudflare 공식 문서에서도 CI/CD에서는 API token과 account ID를 GitHub secret으로 저장하고, 저장소에 직접 기록하지 않도록 권장한다. citeturn0search2

Kakao 키와 client secret 역시 저장소나 Wrangler 설정 파일에 기록하지 않고 Worker secret으로 전달한다. Cloudflare는 `wrangler deploy --secrets-file`을 통한 CI/CD secret 업로드를 지원한다. citeturn0search1turn0search3

### Production D1 준비

Production D1은 Preview와 분리한다.

```bash
npx wrangler d1 create kakao-account-db
```

이미 생성한 Production D1의 ID를 `PRODUCTION_D1_DATABASE_ID`에 등록한다. Production workflow는 배포 직전에 이 값이 존재하는지 검증한다.

### Production Worker URL

Production Worker 이름은 `kakao-account-api`로 고정한다. workflow의 첫 bootstrap 배포에서 실제 `workers.dev` HTTPS URL을 확인하고, 그 URL을 최종 `APP_BASE_URL`과 Kakao callback URL에 반영한다.

예:

```text
https://kakao-account-api.<account-subdomain>.workers.dev
```

Kakao Developers에는 다음 Redirect URI를 등록한다.

```text
https://kakao-account-api.<account-subdomain>.workers.dev/auth/kakao/callback
```

실제 account subdomain은 Production workflow 실행 로그의 `Production Worker URL`을 기준으로 사용한다.

### Production 배포 순서

1. GitHub `production` Environment에 필요한 5개 secret을 등록한다.
2. Kakao Developers에 Production Redirect URI를 등록한다.
3. GitHub Actions의 `Production Deploy`를 수동 실행한다.
4. lint / typecheck / test를 통과시킨다.
5. Cloudflare 및 Production secret을 검증한다.
6. Production Worker를 placeholder URL로 bootstrap 배포한다.
7. 실제 `workers.dev` URL을 탐색한다.
8. Production D1 migration을 적용한다.
9. 실제 URL과 Kakao secrets를 포함해 Production Worker를 최종 배포한다.
10. `/health` smoke test로 최종 배포를 확인한다.

Production D1 migration은 workflow에 포함하되 `workflow_dispatch`로만 실행하여 의도하지 않은 main push가 Production DB를 변경하지 않도록 한다.

### Secret 처리 원칙

Production workflow는 secret 값을 로그에 출력하지 않는다. CI runner에서 임시 JSON 파일을 생성해 Wrangler의 `--secrets-file`로 전달하고 workflow 종료 시 파일을 삭제한다.

Cloudflare의 `wrangler secret put`은 secret을 저장하면서 즉시 Worker 새 버전을 배포할 수 있으며, CI/CD에서는 secret 파일을 이용해 코드와 함께 배포하는 방법도 제공한다. citeturn0search0turn0search1

### 현재 Production 체크리스트

- [ ] GitHub `production` Environment 생성/승인 정책 확인
- [ ] Production 5개 secret 등록
- [ ] Production workflow 최초 실행
- [ ] 실제 Production Worker URL 확인
- [ ] Kakao Redirect URI 등록/확인
- [ ] `/health` smoke test 성공
- [ ] Kakao 로그인 실제 흐름 검증

### 실행

GitHub의 Actions에서 `Production Deploy` workflow를 수동 실행한다.

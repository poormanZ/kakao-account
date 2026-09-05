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

Production 배포는 현재 `workflow_dispatch`로 수동 실행한다. Production 배포 전에는 GitHub `production` Environment의 secret과 Kakao Redirect URI를 확인한다.

### 필요한 GitHub Actions Secrets

Production workflow는 GitHub의 `production` Environment를 사용한다.

- `CLOUDFLARE_API_TOKEN`: Cloudflare Worker/D1 배포용 API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
- `PRODUCTION_D1_DATABASE_ID`: Production D1 database ID
- `PRODUCTION_KAKAO_REST_API_KEY`: Kakao Developers의 Production REST API key
- `PRODUCTION_KAKAO_CLIENT_SECRET`: Kakao Developers의 Production client secret

Cloudflare 공식 문서에서도 CI/CD에서는 API token과 account ID를 GitHub secret으로 저장하고, 저장소에 직접 기록하지 않도록 권장한다.

Kakao 키와 client secret 역시 저장소나 Wrangler 설정 파일에 기록하지 않고 Worker secret으로 전달한다. Production workflow는 `wrangler deploy --secrets-file`을 사용한다.

### Production D1

Production D1은 Preview와 분리한다.

현재 Production D1 database 이름은 `kakao-account-db`이며, workflow에는 해당 database ID를 `PRODUCTION_D1_DATABASE_ID` secret으로 전달한다.

### Production Worker

Production Worker 이름은 `kakao-account-api`로 고정한다.

실제 Production Worker URL:

```text
https://kakao-account-api.darkq4.workers.dev
```

Kakao Developers에 등록해야 하는 Production Redirect URI:

```text
https://kakao-account-api.darkq4.workers.dev/auth/kakao/callback
```

### Production 배포 순서

1. GitHub `production` Environment에 필요한 5개 secret을 등록한다.
2. Production Worker를 placeholder URL로 bootstrap 배포한다.
3. 실제 `workers.dev` URL을 탐색한다.
4. Production D1 migration을 적용한다.
5. 실제 URL과 Kakao secrets를 포함해 Production Worker를 최종 배포한다.
6. `/health` smoke test로 최종 배포를 확인한다.
7. Kakao Developers에 Production Redirect URI를 등록한다.
8. `/auth/kakao`에서 실제 OAuth 로그인 흐름을 검증한다.

Production 배포는 `workflow_dispatch`로만 실행하여 일반적인 `main` push가 Production DB를 변경하지 않도록 한다.

### Secret 처리 원칙

Production workflow는 secret 값을 로그에 출력하지 않는다. CI runner에서 임시 JSON 파일을 생성해 Wrangler의 `--secrets-file`로 전달하고 workflow 종료 시 파일을 삭제한다.

## 운영 로그

Worker는 운영 오류를 구조화된 JSON 한 줄 로그로 기록한다. 로그에는 `request_id`, route, method, 이벤트명, 오류 타입 등 장애 분석에 필요한 최소 정보만 포함한다.

오류 객체의 실제 message는 로그에 기록하지 않는다. 따라서 OAuth authorization code, Kakao access token, client secret, Cookie 값 등의 민감정보가 예외 메시지를 통해 로그로 유출되는 것을 방지한다.

주요 이벤트 예:

```text
kakao.request_failed
kakao.authentication_exception
auth.session_lookup_failed
settings.list_failed
settings.get_failed
settings.put_failed
settings.delete_failed
auth.logout_failed
sessions.cleanup_failed
```

Kakao upstream 실패는 HTTP status와 실패 단계만 기록하며, upstream response body는 기록하지 않는다.

## 세션 정리

Production/Preview Worker에는 시간당 한 번 실행되는 Cron Trigger가 설정되어 있다.

```text
0 * * * *
```

Cron 실행 시 D1의 `sessions` 테이블에서 `expires_at <= CURRENT_TIMESTAMP`인 세션을 삭제한다. 요청 처리 중 만료 세션을 발견했을 때도 해당 세션은 즉시 삭제한다.

## 2026-09-05 Production 배포 검증 결과

GitHub Actions run `33980601195`에서 Production 배포 전체 흐름을 성공적으로 검증했다.

- Checkout: `09e3891481dfae88a3254a1645253ba05a404c88`
- lint: 성공
- typecheck: 성공
- test: 15/15 성공
- Bootstrap Worker: 성공
- D1 migration: 성공, 적용할 migration 없음 확인
- 최종 Worker 배포: 성공
- `/health`: 성공
- Production Worker Version ID: `4dd46bbc-5e90-43dd-921a-80ddda57499a`

Health 응답:

```json
{"status":"ok","service":"kakao-account-api"}
```

## Production OAuth 실제 검증

Production Worker에서 Kakao 로그인을 실제 수행하여 다음 흐름을 확인했다.

```text
Kakao 로그인
→ OAuth callback
→ authorization code 교환
→ Kakao 사용자 조회
→ D1 내부 사용자 생성/조회
→ service session 발급
→ /api/me 인증 확인
```

검증 결과 `/api/me`에서 다음과 같이 정상 인증된 내부 사용자가 반환되었다.

```json
{"authenticated":true,"user":{"id":1,"nickname":null,"profile_image_url":null}}
```

## 현재 Production 체크리스트

- [x] GitHub `production` Environment 및 secret 확인
- [x] Production workflow 실행
- [x] 실제 Production Worker URL 확인
- [x] Kakao Redirect URI 등록/확인
- [x] `/health` smoke test 성공
- [x] Kakao 로그인 실제 흐름 검증
- [x] `/api/me` 실제 세션 검증
- [x] 시간당 세션 정리 Cron 설정
- [x] 구조화 운영 로그 구현 및 테스트

### 실행

GitHub의 Actions에서 `Production Deploy` workflow를 수동 실행한다.

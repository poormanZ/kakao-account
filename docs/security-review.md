# 보안 점검 기록

## 2026-09-06 점검

### 인증/세션
- [x] OAuth `state` 생성 및 callback 검증
- [x] 세션 ID는 랜덤 값으로 생성
- [x] D1에는 세션 원문이 아닌 SHA-256 해시 저장
- [x] 세션 만료 시 DB 세션 삭제 및 쿠키 제거
- [x] 로그아웃 시 서버 세션 삭제 및 쿠키 제거
- [x] 인증 쿠키 `HttpOnly; SameSite=Lax` 적용
- [x] HTTPS 요청에서 인증/상태 쿠키에 `Secure` 적용

### 민감정보 노출
- [x] Kakao access/refresh token을 D1에 저장하지 않음
- [x] OAuth access token을 응답 JSON에 포함하지 않음
- [x] 애플리케이션 코드에 인증정보를 `console.log`하는 코드가 없음
- [x] 테스트에서 외부 Kakao access token이 호출 기록에 노출되지 않는 것을 검증

### HTTP 응답 보안
- [x] `Cache-Control: no-store`
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: no-referrer`
- [x] `Permissions-Policy`로 카메라/마이크/위치 기능 제한
- [x] HTTPS 응답에 HSTS 적용

## Rate Limiting 검토

Cloudflare Workers의 Rate Limiting API를 사용하면 Worker 코드 내부에서 경로별/고객별 제한을 적용할 수 있다. D1에 요청 카운터를 직접 기록하는 방식은 인증 API마다 추가 쓰기를 발생시키므로 기본 구현으로 채택하지 않는다.

1차 운영 기준은 다음과 같다.

- `/auth/kakao`: IP 기준 로그인 시작 요청 제한
- `/auth/kakao/callback`: IP 기준 callback 요청 제한
- `/auth/logout`: 과도한 반복 요청 제한
- `/api/*`: 인증 사용자 또는 IP 기준 일반 API 제한
- 제한 초과 시 `429 Too Many Requests` 반환
- Rate Limiting은 정확한 과금/회계 용도가 아닌 방어 목적의 완화 장치로 취급
- 실제 제한값은 Preview 검증 후 Production 환경에서 확정

### 현재 상태
- [x] Rate Limiting 도입 방식 검토
- [ ] Cloudflare Rate Limiting binding을 실제 환경에 연결
- [ ] Production별 제한값 확정
- [ ] `429` 응답 테스트

참고: Cloudflare Workers Rate Limiting API는 Wrangler 4.36.0 이상을 요구하며, eventual consistency를 갖는 방어용 rate limiter다.

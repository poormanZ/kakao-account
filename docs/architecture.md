# 시스템 설계

## 1. 목표

웹 사용자가 카카오 로그인을 통해 서비스 계정을 생성하거나 기존 계정으로 로그인하고, 서비스 내부 데이터는 자체 사용자 ID를 기준으로 저장한다. 초기 운영비는 가능한 한 무료 구간 안에서 유지하며, 특정 공급자에 종속되지 않도록 인증과 서비스 계정 도메인을 분리한다.

## 2. 아키텍처

```text
Browser
  │
  ├─ GET /auth/kakao
  │       │
  │       └─ Kakao Authorization Server
  │
  └─ GET /auth/kakao/callback?code=...
              │
              ▼
       Cloudflare Worker
          │       │
          │       └─ Kakao User API
          │
          └─────── D1
                    │
                    ├─ users
                    └─ sessions
```

### 책임 분리
- Browser: 로그인 시작, 서비스 UI, HttpOnly 세션 쿠키 보관.
- Kakao: 사용자 인증 및 OAuth 동의/인가 처리.
- Worker: OAuth callback 처리, state 검증, Kakao token 교환, 사용자 조회/생성, 세션 발급, 서비스 API 제공.
- D1: 서비스 사용자/세션/서비스 데이터 저장.

## 3. 인증 흐름

1. 사용자가 `/auth/kakao`를 요청한다.
2. 서버가 일회성 OAuth `state`를 생성하고 안전한 저장소/세션과 연결한다.
3. 카카오 인가 엔드포인트로 리다이렉트한다.
4. 카카오가 `redirect_uri`로 `code`와 `state`를 반환한다.
5. Worker가 `state`를 검증한 후 code를 토큰 엔드포인트로 교환한다.
6. Access Token으로 카카오 사용자 정보를 조회한다.
7. `kakao_user_id`로 내부 `users`를 조회하고 없으면 생성한다.
8. 내부 세션을 생성하고 HttpOnly/Secure/SameSite 쿠키를 발급한다.
9. 이후 서비스 API는 카카오 토큰이 아니라 내부 세션으로 사용자를 식별한다.

## 4. 세션 정책

- 브라우저에는 내부 세션 ID 또는 서명된 세션 토큰만 전달한다.
- 세션 쿠키는 `HttpOnly`, `Secure`, 적절한 `SameSite` 정책을 사용한다.
- 세션 만료 시간을 명시하고 로그아웃 시 폐기한다.
- 세션 ID는 추측하기 어려운 암호학적 난수로 생성한다.
- 운영 환경에서만 production secret을 사용한다.

## 5. 오류 처리

- 사용자가 카카오 로그인을 취소한 경우 서비스 로그인 화면으로 안전하게 돌아간다.
- `state`가 일치하지 않으면 인증을 중단한다.
- token/user API 오류는 내부 상세정보를 노출하지 않고 사용자에게 일반 오류를 반환한다.
- 이미 존재하는 `kakao_user_id`에 대해 중복 사용자 생성을 허용하지 않는다.

## 6. 무료 운영 전략

Cloudflare Workers Free와 D1 Free를 우선 사용한다. 현재 Cloudflare 문서 기준 Workers Free는 하루 100,000 요청, D1 Free는 하루 500만 rows read/10만 rows written 및 총 5GB 저장 한도를 제공한다. 한도 초과 시 무료 플랜에서는 해당 작업이 실패할 수 있으므로 사용량 모니터링을 포함한다.

무료 한도는 영구적인 성능 보장이 아니라 초기 개발/소규모 서비스 운영을 위한 범위로 취급한다.

## 7. 향후 확장

- Google/Apple 등 추가 OAuth provider
- 이메일/비밀번호가 필요할 경우 별도 인증 도메인 추가
- 사용자 프로필 및 설정
- 서비스별 사용자 데이터 테이블
- rate limiting 및 abuse 방어
- 감사 로그와 운영 지표

# 카카오 로그인 설계

## 공식 OAuth 흐름

카카오 로그인 REST API 기준으로 PC/모바일 웹에 적합한 Authorization Code 흐름을 사용한다. 카카오 공식 문서 기준 인가 코드 요청 → 토큰 요청 → 사용자 정보 조회 순서로 처리한다.

### 엔드포인트

- Authorization: `https://kauth.kakao.com/oauth/authorize`
- Token: `https://kauth.kakao.com/oauth/token`
- User info: `https://kapi.kakao.com/v2/user/me`

## Redirect URI

환경별로 분리한다.

```text
local:      http://localhost:8787/auth/kakao/callback
preview:    https://<preview-domain>/auth/kakao/callback
production: https://<production-domain>/auth/kakao/callback
```

실제 URI는 Kakao Developers에 등록된 값과 완전히 일치해야 한다.

## 현재 구현 범위

### `/auth/kakao`

1. 32바이트 난수 기반 `state` 생성
2. `HttpOnly`, `SameSite=Lax`, 10분 만료 쿠키에 state 저장
3. 카카오 인가 엔드포인트로 302 redirect
4. REST API Key는 Worker 환경변수/secret에서만 읽음

### `/auth/kakao/callback`

1. `code`, `state` 입력 검증
2. state cookie와 callback state 비교
3. authorization code를 access token으로 교환
4. access token으로 `/v2/user/me` 호출
5. 사용자 ID 형식을 검증
6. OAuth state cookie 폐기
7. 현재 단계에서는 서비스 세션을 발급하지 않고 인증 성공 여부만 반환

서비스 계정 생성 및 세션 발급은 Phase 3에서 구현한다.

## OAuth state

`state`는 CSRF 방지를 위한 일회성 값으로 사용한다.

- 로그인 시작 시 충분히 긴 난수 생성
- HttpOnly cookie와 연결
- callback에서 동일성 검증
- 성공/실패 후 폐기
- 10분 후 자동 만료

## 동의항목

초기 버전에서는 서비스에 꼭 필요한 항목만 요청한다. 현재 OAuth 요청에는 추가 scope를 지정하지 않고 카카오 사용자 식별자 확인에 필요한 최소 정보만 사용한다.

닉네임/프로필 이미지는 실제 UI 요구사항이 생겼을 때 필요한 동의항목을 추가한다. 이메일 등 개인정보는 필요성과 카카오의 동의항목 정책을 확인한 후 추가한다.

## 계정 매핑

```text
Kakao user id
      │
      ▼
users.kakao_user_id (UNIQUE)
      │
      ▼
users.id
      │
      ▼
서비스 내부 데이터
```

카카오 사용자 ID를 서비스의 외부 노출용 ID로 사용하지 않는다.

## 로그아웃

서비스 로그아웃은 우선 내부 세션을 폐기한다. 카카오 계정 자체 로그아웃과 서비스 로그아웃을 구분한다. 카카오 연결 해제는 회원 탈퇴와 같은 별도 기능으로 취급한다.

## 보안 체크리스트

- [x] `state` 검증
- [ ] HTTPS production callback
- [x] Secret을 환경변수/secret store로 관리
- [ ] HttpOnly/Secure/SameSite 서비스 세션 쿠키
- [x] OAuth callback의 입력값 검증
- [x] Kakao token API 응답 검증
- [x] 사용자 정보 API 실패 처리
- [ ] 중복 계정 방지
- [x] 로그에 access token/secret 미출력
- [ ] 로그인/콜백 rate limiting 검토

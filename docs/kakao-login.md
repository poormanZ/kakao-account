# 카카오 로그인 설계

## 공식 OAuth 흐름

카카오 로그인 REST API 기준으로 PC/모바일 웹에 적합한 Authorization Code 흐름을 사용한다.

### 엔드포인트

- Authorization: `https://kauth.kakao.com/oauth/authorize`
- Token: `https://kauth.kakao.com/oauth/token`
- User info: `https://kapi.kakao.com/v2/user/me`

실제 구현에서는 공식 문서의 최신 요청 파라미터와 응답 스키마를 다시 확인한다.

## Redirect URI

환경별로 분리한다.

```text
local:      http://localhost:8787/auth/kakao/callback
preview:    https://<preview-domain>/auth/kakao/callback
production: https://<production-domain>/auth/kakao/callback
```

실제 URI는 Kakao Developers에 등록된 값과 완전히 일치해야 한다.

## OAuth state

`state`는 CSRF 방지를 위한 일회성 값으로 사용한다.

- 로그인 시작 시 충분히 긴 난수 생성
- 브라우저 세션과 연결
- callback에서 동일성 검증
- 성공/실패 후 폐기
- 재사용 방지

## 동의항목

초기 버전에서는 서비스에 꼭 필요한 항목만 요청한다.

최소 요구사항은 카카오 사용자 식별자이며, 닉네임/프로필 이미지는 실제 UI 요구사항이 있을 때만 활성화한다. 이메일 등 개인정보는 필요성과 카카오의 동의항목 정책을 확인한 후 추가한다.

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

- [ ] `state` 검증
- [ ] HTTPS production callback
- [ ] Secret을 환경변수/secret store로 관리
- [ ] HttpOnly/Secure/SameSite 세션 쿠키
- [ ] OAuth callback의 입력값 검증
- [ ] Kakao token API 응답 검증
- [ ] 사용자 정보 API 실패 처리
- [ ] 중복 계정 방지
- [ ] 로그에 access token/secret 미출력
- [ ] 로그인/콜백 rate limiting 검토

# Account API 서비스 연동 명세

## 1. 문서 목적

이 문서는 `kakao-account`를 다른 웹 서비스에서 계정 플랫폼으로 연동하기 위한 현재 API 명세다.

계정 플랫폼의 책임은 다음과 같다.

- 카카오 OAuth 인증
- 내부 사용자 ID 발급 및 관리
- 브라우저 세션 관리
- 공통 프로필(닉네임, 프로필 이미지) 관리
- 공통 사용자 설정 관리
- 계정 삭제

서비스별 도메인 데이터는 이 API가 직접 저장하지 않는다. 연동 서비스는 계정 플랫폼이 발급한 내부 `user.id`를 서비스의 사용자 연결 키로 사용한다.

> 현재 인증 방식은 브라우저의 HttpOnly 세션 쿠키를 기준으로 한다. 카카오 Access Token을 서비스에 전달하거나 서비스 DB에 저장하지 않는다.

## 2. 기본 정보

### Base URL

운영 환경의 Base URL은 배포 환경에 따라 결정한다.

```text
https://<account-worker-host>
```

예시 운영 Worker:

```text
https://kakao-account-api.darkq4.workers.dev
```

### 공통 응답 규칙

- JSON API는 `Content-Type: application/json`을 사용한다.
- 인증이 필요한 API는 현재 브라우저의 계정 세션 쿠키를 사용한다.
- API 응답은 `Cache-Control: no-store`를 적용한다.
- 인증 실패는 `401 Unauthorized`를 사용한다.
- 서버/외부 인증 서비스 장애는 일반화된 `503` 또는 OAuth 처리의 경우 `502`로 반환한다.
- 현재 API는 사용자 입력을 SQL 파라미터 바인딩으로 처리한다.

## 3. 사용자 식별 규칙

서비스에서 사용할 안정적인 사용자 식별자는 다음 값이다.

```json
{
  "id": 1
}
```

`id`는 Account D1의 `users.id`이며 서비스 내부 연동 키로 사용한다.

다음 값은 서비스의 사용자 식별자로 사용하지 않는다.

- `kakao_user_id`
- Kakao Access Token
- 브라우저 세션 ID

서비스 DB에서는 다음과 같이 연결하는 것을 권장한다.

```text
service_users
-------------
id
account_user_id  -> kakao-account users.id
...
```

서비스별 사용자 테이블의 `account_user_id`에는 Account API의 `user.id`를 저장한다.

## 4. 인증 흐름

### 4.1 카카오 로그인 시작

```http
GET /auth/kakao
```

동작:

1. 서버가 일회성 OAuth `state`를 생성한다.
2. `state`를 HttpOnly 쿠키로 저장한다.
3. 카카오 인가 페이지로 `302` 리다이렉트한다.

서비스는 일반적으로 이 URL을 로그인 버튼의 이동 대상으로 사용한다.

### 4.2 OAuth callback

```http
GET /auth/kakao/callback?code={code}&state={state}
```

이 엔드포인트는 서비스가 직접 호출하는 API가 아니라 Kakao OAuth redirect URI다.

서버는 다음을 처리한다.

1. `state` 검증
2. authorization code를 Kakao token endpoint에서 교환
3. Kakao 사용자 정보 조회
4. 내부 `users` 생성 또는 기존 사용자 조회
5. 내부 세션 생성
6. HttpOnly 세션 쿠키 발급
7. 계정 페이지로 리다이렉트

서비스는 Kakao authorization code나 Access Token을 직접 처리하지 않는다.

### 4.3 세션

현재 브라우저 세션 쿠키 이름은 다음과 같다.

```text
kakao_account_session
```

세션은 서버 측 `sessions` 테이블에 저장되며, 브라우저에는 원본 세션 ID가 HttpOnly 쿠키로 전달된다. 서버 DB에는 세션 ID의 SHA-256 해시가 저장된다.

운영 환경에서는 `Secure`, `HttpOnly`, `SameSite=Lax`가 적용된다.

세션 TTL은 현재 **30일**이다.

## 5. 현재 사용자 조회

### `GET /api/me`

로그인한 사용자의 기본 계정 정보를 조회한다.

#### 요청

```http
GET /api/me
Cookie: kakao_account_session=<session>
```

#### 성공 `200`

```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "nickname": "홍길동",
    "profile_image_url": null
  }
}
```

#### 인증 실패 `401`

```json
{
  "error": "Unauthorized"
}
```

만료되었거나 유효하지 않은 세션이면 서버가 세션 쿠키를 정리할 수 있다.

## 6. 닉네임

### `PUT /api/profile/nickname`

로그인한 사용자의 닉네임을 변경한다.

#### 요청

```http
PUT /api/profile/nickname
Content-Type: application/json
Cookie: kakao_account_session=<session>

{
  "nickname": "새닉네임"
}
```

#### 검증 규칙

- 문자열이어야 한다.
- 앞뒤 공백은 제거된다.
- 길이는 **2~20자**다.
- 제어 문자는 허용하지 않는다.
- 닉네임은 전체 계정에서 고유해야 한다.

#### 성공 `200`

```json
{
  "nickname": "새닉네임"
}
```

#### 인증 실패 `401`

```json
{
  "error": "Unauthorized"
}
```

#### 잘못된 닉네임 `400`

```json
{
  "error": "Nickname must be 2-20 characters"
}
```

#### 중복 닉네임 `409`

```json
{
  "error": "Nickname already in use"
}
```

중복 검사는 애플리케이션 단계와 D1의 partial unique index를 함께 사용해 동시 요청에서도 중복 저장을 방지한다.

## 7. 사용자 설정 API

서비스 공통 설정을 저장해야 하는 경우 사용할 수 있다.

> 서비스 고유의 대량/도메인 데이터는 `user_settings`에 넣지 말고 서비스 DB에서 관리한다.

### 전체 설정 조회

```http
GET /api/settings
```

#### 성공 `200`

```json
{
  "settings": {
    "theme": "dark",
    "language": "ko"
  }
}
```

### 단일 설정 조회

```http
GET /api/settings/{key}
```

#### 성공 `200`

```json
{
  "key": "theme",
  "value": "dark"
}
```

설정이 없으면 `404`:

```json
{
  "error": "Setting not found"
}
```

### 설정 저장

```http
PUT /api/settings/{key}
Content-Type: application/json

{
  "value": "dark"
}
```

설정 키 규칙:

- 최대 100자
- 영문 대소문자, 숫자, `.`, `_`, `-`만 허용

설정 값은 최대 10,000자다.

#### 성공 `200`

```json
{
  "key": "theme",
  "value": "dark"
}
```

### 설정 삭제

```http
DELETE /api/settings/{key}
```

성공 시 `204 No Content`를 반환한다.

## 8. 로그아웃

### `POST /auth/logout`

현재 세션을 서버에서 폐기하고 브라우저 세션 쿠키를 제거한다.

#### 요청

```http
POST /auth/logout
Cookie: kakao_account_session=<session>
```

#### 성공 `200`

```json
{
  "logged_out": true
}
```

로그인하지 않은 상태에서 호출해도 로그아웃 완료 응답을 반환하는 형태로 사용할 수 있다.

## 9. 계정 삭제

### `DELETE /api/account`

현재 로그인한 계정과 Account D1의 계정 데이터를 삭제한다.

#### 요청

```http
DELETE /api/account
Content-Type: application/json
Cookie: kakao_account_session=<session>

{
  "confirmation": "DELETE"
}
```

삭제 대상:

- `user_settings`
- `sessions`
- `users`

#### 성공 `200`

```json
{
  "deleted": true
}
```

성공하면 현재 세션 쿠키도 제거된다.

#### 확인 문자열 누락/오류 `400`

```json
{
  "error": "Account deletion requires confirmation"
}
```

> 서비스 DB의 사용자 데이터는 Account API가 임의로 삭제하지 않는다. 서비스는 계정 삭제 정책에 따라 자체 데이터를 삭제하거나 별도의 삭제 연동을 구현해야 한다.

## 10. 상태 확인

### `GET /health`

Worker의 기본 상태를 확인한다.

#### 성공 `200`

```json
{
  "status": "ok",
  "service": "kakao-account-api"
}
```

인증이 필요하지 않다.

## 11. HTTP 상태 코드 요약

| 상태 | 의미 |
|---|---|
| `200` | 요청 성공 |
| `204` | 요청 성공, 응답 본문 없음 |
| `302` | Kakao 로그인 또는 로그인 완료 후 리다이렉트 |
| `400` | 요청 형식/입력값 오류 |
| `401` | 로그인 세션 없음 또는 유효하지 않음 |
| `404` | 요청한 리소스/설정 없음 |
| `409` | 닉네임 중복 등 현재 상태와 충돌 |
| `502` | Kakao 인증 API 처리 실패 |
| `503` | 내부 인증/계정 서비스 일시적 장애 |

## 12. 서비스 연동 권장 구조

```text
[사용자 브라우저]
       │
       │ GET /auth/kakao
       ▼
[Kakao Account Worker]
       │
       ├── Kakao OAuth
       ├── Account D1
       │     ├── users
       │     ├── sessions
       │     └── user_settings
       │
       │ GET /api/me
       ▼
[연동 서비스]
       │
       └── service DB
             └── account_user_id = users.id
```

### 권장 원칙

1. 로그인은 Account API에서 담당한다.
2. 서비스는 Kakao OAuth를 직접 구현하지 않는다.
3. 서비스 데이터에는 `users.id`를 `account_user_id`로 저장한다.
4. `kakao_user_id`를 서비스 DB의 식별자로 사용하지 않는다.
5. Kakao Access Token을 서비스에 전달하거나 저장하지 않는다.
6. 닉네임/프로필 정보가 필요하면 `/api/me`를 사용한다.
7. 서비스 고유 데이터는 서비스 DB에 저장한다.
8. 계정 삭제 시 서비스 데이터 삭제 정책을 별도로 정의한다.

## 13. 현재 웹 계정 페이지

Account Worker의 `/`는 기본 계정 관리 UI를 제공한다.

비로그인 상태:

- 카카오 로그인 버튼

로그인 상태:

- 프로필/닉네임 표시
- 닉네임 변경
- 중복 닉네임 오류 표시
- 로그아웃

서비스 자체 UI를 만들 때는 이 페이지를 그대로 사용할 수도 있고, 동일 세션을 사용하는 별도 서비스 UI를 구성할 수도 있다.

## 14. 향후 확장 시 주의사항

현재 API는 브라우저 기반 단일 계정 플랫폼 MVP에 맞춰져 있다. 외부 서비스가 서버-서버 방식으로 계정을 조회해야 하는 요구가 생기면 현재 브라우저 세션 API를 그대로 공유하지 말고 별도의 서비스 인증 방식을 설계한다.

향후 고려 대상:

- 서비스별 API Client 인증
- CORS 허용 출처 관리
- CSRF 방어 강화
- rate limiting
- 서비스별 권한/role API
- 계정 삭제 이벤트 또는 callback
- 추가 OAuth provider
- API 버전 정책(`/api/v1/...` 등)

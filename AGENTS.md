# kakao-account 개발 지침

## 프로젝트 목적
카카오 계정으로 사용자를 인증하고, 서비스 내부의 사용자 계정 및 사용자 데이터를 안전하게 관리하는 서버리스 웹 서비스 기반을 구축한다.

## 기본 원칙
- 모든 개발은 `main`의 최신 커밋을 기준으로 시작한다.
- 작업 시작 전 원격 `main`의 최신 SHA를 확인하고, 실제 반영 직전에도 최신 SHA를 다시 확인한다.
- 최신 `main`이 작업 기준과 달라졌다면 변경사항을 먼저 동기화한 뒤 작업한다.
- 비밀값(REST API Key, Client Secret, 세션 서명 키 등)을 저장소에 커밋하지 않는다.
- 카카오 Access Token을 장기 사용자 인증 정보처럼 DB에 저장하지 않는다. 서비스 세션과 외부 OAuth 인증을 분리한다.
- 카카오 고유 사용자 ID는 외부 식별자로만 사용하고, 서비스 내부에서는 자체 `users.id`를 기준 식별자로 사용한다.
- 문서와 구현이 충돌하면 구현보다 설계 의도를 먼저 검토하고 문서를 갱신한다.
- 최소 권한, 입력 검증, CSRF/세션 보호, 에러 정보 노출 방지를 기본 보안 요구사항으로 적용한다.

## 권장 기술 스택
- Source: GitHub
- Runtime/API: Cloudflare Workers
- Database: Cloudflare D1(SQLite)
- Authentication provider: Kakao Login REST API
- CI/CD: GitHub Actions

## 개발 단계
1. 설계 문서 확정
2. Cloudflare Worker/D1 기본 프로젝트 생성
3. Kakao Developers 앱 및 Redirect URI 설정
4. OAuth 인가 코드 → 토큰 → 사용자 정보 흐름 구현
5. 사용자 생성/조회 및 서비스 세션 구현
6. `/api/me`, 로그아웃 등 인증 API 구현
7. DB 마이그레이션 및 테스트
8. GitHub Actions 배포 자동화
9. 운영 보안/관측성/비용 한도 점검

## 테스트 원칙
- 인증 성공/취소/실패/재로그인/로그아웃을 검증한다.
- 동일한 카카오 사용자에 대해 중복 계정이 생성되지 않아야 한다.
- 잘못된 OAuth state 및 만료/유효하지 않은 세션을 거부한다.
- 로컬/Preview/Production 환경의 비밀값과 Redirect URI를 분리한다.

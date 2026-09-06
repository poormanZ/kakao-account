# kakao-account

카카오 로그인을 기반으로 서비스 계정을 생성하고 사용자 정보를 저장하기 위한 서버리스 계정 플랫폼.

## 목표

- 카카오 OAuth 로그인
- 서비스 내부 사용자 계정 관리
- 사용자 세션 관리
- 사용자별 데이터 저장
- 가능한 무료 구간을 활용한 초기 운영

## 기본 기술 스택

- GitHub / GitHub Actions
- Cloudflare Workers
- Cloudflare D1
- Kakao Login REST API

## 문서

- [개발 지침](AGENTS.md)
- [시스템 설계](docs/architecture.md)
- [데이터베이스 설계](docs/database.md)
- [카카오 로그인 설계](docs/kakao-login.md)
- [서비스 연동 API](docs/api.md)
- [미니게임 포털 기획](docs/portal-plan.md)
- [IRO (이로) 게임 개발 기획](docs/iro-plan.md)
- [서비스별 데이터 모델](docs/service-data.md)
- [로드맵](docs/roadmap.md)

## 로컬 시작

1. `wrangler.toml.example`을 기준으로 Worker 설정을 준비한다.
2. Cloudflare D1을 생성하고 `database_id`를 환경별 설정에 입력한다.
3. `.dev.vars.example`을 `.dev.vars`로 복사하고 Kakao REST API Key/Client Secret을 입력한다.
4. `npm install` 후 `npm run dev`로 Worker를 실행한다.
5. `GET /health`로 기본 상태를 확인한다.

실제 비밀값은 Git에 커밋하지 않는다. 운영 환경의 비밀값은 Cloudflare secret으로 관리한다.

## 현재 상태

Account API 및 기본 웹 계정 페이지 구현이 완료되었으며, 미니게임 포털과 Click Rush/Reaction Test 기반이 구축되어 있다. 다음 게임은 3×3 카드 보드 생존 전략 게임 **IRO (이로)**이며 상세 개발 기획은 `docs/iro-plan.md`에 정의한다.

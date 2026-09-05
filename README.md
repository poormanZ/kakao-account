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
- [로드맵](docs/roadmap.md)

## 현재 상태

Phase 0 설계 완료. 다음 단계는 Cloudflare Worker와 D1 기반 프로젝트 초기화다.

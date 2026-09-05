# 개발 로드맵

## Phase 0 — 설계
- [x] 프로젝트 목적/범위 정의
- [x] 시스템 아키텍처 정의
- [x] DB 모델 정의
- [x] 카카오 OAuth 흐름 정의
- [x] 보안 원칙 정의

## Phase 1 — 기반 구축
- [x] Worker 프로젝트 초기화
- [x] TypeScript/런타임 기본 설정
- [x] D1 database 생성 및 binding
- [x] 환경별 변수/secret 전략 구성
- [x] 기본 health endpoint

## Phase 2 — Kakao OAuth
- [x] `/auth/kakao` 구현
- [x] OAuth state 생성/검증
- [x] `/auth/kakao/callback` 구현
- [x] authorization code → access token 교환
- [x] Kakao 사용자 정보 조회
- [x] Production 실제 Kakao 로그인 검증

## Phase 3 — 계정/세션
- [x] users migration
- [x] 신규 사용자 생성
- [x] 기존 사용자 로그인
- [x] sessions migration
- [x] 내부 세션 발급/검증/만료
- [x] `/api/me`
- [x] `/auth/logout`

## Phase 4 — 사용자 데이터
- [x] user_settings migration
- [x] 사용자 설정 CRUD
- [ ] 서비스별 데이터 모델 확정
- [x] 권한 검증 공통 모듈

## Phase 5 — 테스트/보안
- [x] OAuth 정상 흐름 테스트
- [x] 취소/실패 흐름 테스트
- [x] state 변조 테스트
- [x] 중복 사용자 테스트
- [x] 세션 만료/로그아웃 테스트
- [x] 민감정보 로그 노출 점검
- [x] rate limiting 검토
- [x] 보안 응답 헤더 및 Secure/HttpOnly 쿠키 점검
- [x] GitHub Actions typecheck/test 통과

## Phase 6 — CI/CD
- [x] GitHub Actions lint/test
- [x] Preview 배포
- [x] Production 배포
- [x] D1 migration 자동화 정책 확정
- [x] 배포 전 secret/환경 확인

## Phase 7 — 운영
- [ ] Worker/D1 사용량 모니터링
- [ ] 오류 로깅/알림
- [x] 세션 정리 작업 — 만료 세션 hourly Cron + D1 cleanup
- [ ] 개인정보 보관/삭제 정책
- [ ] 무료 한도 초과 대응 계획

## 완료 기준
각 Phase는 구현뿐 아니라 관련 테스트와 문서가 함께 갱신되고, `main`에서 정상 동작을 확인한 뒤 완료로 표시한다.

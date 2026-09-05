# 운영 모니터링 및 무료 한도 대응

## 목적

이 프로젝트는 Cloudflare Workers + D1을 사용하므로 애플리케이션 로그와 Cloudflare 제공 사용량 지표를 함께 확인한다.

## 모니터링 대상

### Worker

Cloudflare Dashboard → Workers & Pages → `kakao-account-api`에서 다음 항목을 확인한다.

- 요청 수
- 성공/오류 요청
- invocation status
- CPU time
- Observability 이벤트/로그

특히 다음 오류를 우선 확인한다.

- `1101` — Worker JavaScript 예외
- `1102` — CPU/리소스 제한 초과
- `1027` — Workers Free 일일 요청 한도 초과

현재 Workers Free 일일 요청 한도는 100,000회이며 UTC 자정에 초기화된다.

### D1

Cloudflare Dashboard → D1 → `kakao-account-db` → Metrics에서 다음 항목을 확인한다.

- read queries
- write queries
- rows read
- rows written
- query latency
- database size

D1 사용량은 계정 Billing → Billable Usage에서도 확인할 수 있다.

## 현재 Free 한도 기준

| 항목 | Workers Free 기준 | 운영 대응 |
|---|---:|---|
| Worker 요청 | 100,000 / 일 | 70% 이상 추세 확인, 90% 이상 즉시 원인 분석 |
| D1 rows read | 5,000,000 / 일 | 70% 이상 쿼리 최적화 검토, 90% 이상 즉시 대응 |
| D1 rows written | 100,000 / 일 | 70% 이상 쓰기량 분석, 90% 이상 즉시 대응 |
| D1 저장소 | 5 GB | 증가 추세 확인, 불필요 데이터 삭제 정책 점검 |

D1 Free 일일 rows read/write 한도는 2026-09-01부터 실제 초과 시 요청이 실패하도록 적용되므로, 한도에 도달한 뒤 대응하는 방식이 아니라 사전 모니터링을 기본으로 한다.

## 알림 정책

Cloudflare Billing의 usage notification에서 D1 `Rows Read`와 `Rows Written` 알림을 활성화한다.

Workers는 Observability에서 오류율과 invocation status를 확인한다. 애플리케이션 오류는 구조화 JSON 로그의 `event`, `request_id`, `route`, `method`, `error_type`을 기준으로 원인을 추적한다.

## 무료 한도 초과 대응

1. **Worker 요청 한도**
   - `1027` 발생 여부 확인
   - 비정상 트래픽 또는 자동화 요청 증가 여부 확인
   - 필요 시 Rate Limiting/WAF 검토
   - 서비스가 지속적으로 100,000 requests/day를 초과하면 Workers Paid 전환 검토

2. **D1 rows read/write 한도**
   - 가장 많은 rows read/write를 발생시키는 쿼리 확인
   - 인덱스 사용 여부 및 `EXPLAIN QUERY PLAN` 검토
   - 불필요한 full table scan 제거
   - 쓰기 빈도가 높은 작업의 중복 호출 제거
   - 지속적인 사용량 증가가 확인되면 Workers Paid 전환 검토

3. **D1 한도 초과 시 서비스 응답**
   - D1 오류를 일반적인 500 응답으로 숨기지 않고 서버 로그에 기록
   - 사용자에게는 내부 DB 오류나 Cloudflare 상세 메시지를 노출하지 않음
   - 일시적인 한도 초과는 UTC 자정 초기화까지 제한될 수 있음을 운영상 인지
   - 반복 초과 시 쿼리 최적화 후 유료 플랜 전환 여부 결정

## 점검 주기

- 일일: Worker 요청량, 오류율, D1 rows read/write 확인
- 주간: 상위 D1 쿼리와 저장소 증가량 검토
- 배포 직후: `/health`, `/api/me`, OAuth 흐름 및 Worker 오류 확인
- 장애 발생 시: Observability 이벤트 → request ID → 구조화 로그 → D1 query metrics 순서로 추적

## 참고

- Cloudflare Workers Metrics & Analytics: https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1 Metrics & Analytics: https://developers.cloudflare.com/d1/observability/metrics-analytics/
- Cloudflare D1 Billing: https://developers.cloudflare.com/d1/observability/billing/
- Cloudflare D1 Free Tier Limit Enforcement: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

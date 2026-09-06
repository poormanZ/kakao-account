# Reaction Test 설계 문서

## 1. 개요

Reaction Test는 화면 신호에 대한 사용자의 순수 반응속도를 측정하는 5라운드 미니게임이다.

- 게임 slug: `reaction`
- 목표: 성공 라운드의 평균 반응 시간(ms)을 최소화
- 1회 플레이: 5라운드
- 랭킹: 낮은 평균 ms가 높은 순위
- 비로그인: 플레이 및 전체 랭킹 조회 가능
- 로그인: 기록 저장, 최고 기록, 내 랭킹 조회 가능

## 2. Click Rush와의 차이

| 항목 | Click Rush | Reaction Test |
|---|---|---|
| 핵심 능력 | 반복 클릭 속도/지구력 | 순간 반응속도 |
| 플레이 방식 | 20/40/60초 동안 타겟 반복 클릭 | 5번의 신호에 1회씩 반응 |
| 랭킹 방향 | 높은 점수 우선 | 낮은 평균 ms 우선 |
| 실패 | miss | false start / timeout |

## 3. 라운드 상태 머신

```text
IDLE → READY → WAIT → GO! → PLAYER_CLICK → ROUND_RESULT
             │
             └──── click → FALSE_START → ROUND_RESULT

ROUND_RESULT → 다음 라운드
5라운드 완료 → FINAL_RESULT
```

### 상태 규칙

- `IDLE`: 초기 화면
- `READY`: 시작 안내 및 라운드 준비
- `WAIT`: 무작위 대기. 이때 클릭하면 false start
- `GO!`: 반응 측정 시작
- `PLAYER_CLICK`: 클릭 시 `performance.now()` 차이로 반응 시간 계산
- `ROUND_RESULT`: 해당 라운드 결과 표시
- `FINAL_RESULT`: 5라운드 종합 결과

## 4. 타이밍 규칙

- 대기 시간: `1500~4000ms` 범위에서 무작위 선택
- GO 이후 응답 제한: `1500ms`
- 실제 반응 시간은 브라우저 `performance.now()` 기반
- UI 타이머 렌더링과 실제 측정용 시간을 분리한다.
- 랜덤 대기값은 플레이 시작 전에 미리 노출하지 않는다.

## 5. 실패 및 결과 계산

라운드 결과는 다음 중 하나다.

1. 성공: 반응 시간 기록
2. false start: WAIT 중 클릭
3. timeout: GO 후 1500ms 동안 미응답

성공 라운드만 평균 계산에 사용한다. 실패 라운드에 임의의 패널티 시간을 넣지 않는다.

랭킹 저장 조건은 성공 라운드 `3회 이상`이다. 3회 미만 성공한 플레이는 결과 화면에 통계를 표시하지만 랭킹에는 저장하지 않는다.

서버는 클라이언트가 보낸 `average_ms`를 신뢰하지 않고 `reaction_times`로 다시 계산한다.

## 6. 성능 등급

| 평균 반응 시간 | 등급 |
|---:|---|
| `< 200ms` | PERFECT |
| `200~249ms` | EXCELLENT |
| `250~299ms` | GREAT |
| `300~399ms` | GOOD |
| `400ms+` | SLOW |

## 7. API

### 점수 제출

`POST /api/games/reaction/scores`

```json
{
  "round_count": 5,
  "successful_rounds": 4,
  "reaction_times": [238, 251, 219, 264],
  "false_starts": 1,
  "timeouts": 0
}
```

서버가 성공 라운드 수, 평균, 최고 기록을 계산한다.

### 최고 기록

`GET /api/games/reaction/best`

로그인 사용자의 최저 평균 반응 시간을 반환한다.

### 내 랭킹

`GET /api/games/reaction/my-rank`

로그인 사용자의 최고 기록 기준 순위를 반환한다.

### 전체 랭킹

`GET /api/games/reaction/ranking`

상위 100명을 반환한다.

정렬 기준:
1. `average_ms ASC`
2. `created_at ASC`

사용자별로 가장 낮은 평균 기록 1개만 랭킹에 사용한다.

## 8. 데이터 모델

Reaction Test는 Click Rush와 랭킹 방향 및 측정 데이터가 다르므로 별도 테이블을 사용한다.

예정 테이블: `reaction_test_scores`

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
account_user_id INTEGER NOT NULL
average_ms INTEGER NOT NULL
best_ms INTEGER NOT NULL
successful_rounds INTEGER NOT NULL
false_starts INTEGER NOT NULL
timeouts INTEGER NOT NULL
round_times_json TEXT NOT NULL
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
```

`account_user_id`는 Account D1의 `users.id`를 참조하는 논리적 연결이며 Account 사용자 테이블을 Game D1에 복제하지 않는다.

## 9. 서버 검증

MVP 서버는 다음을 검증한다.

- `round_count === 5`
- 모든 카운터가 정수이며 음수가 아님
- `successful_rounds + false_starts + timeouts === 5`
- `reaction_times.length === successful_rounds`
- 각 반응 시간이 정수이며 합리적인 범위 내에 있음
- `successful_rounds >= 3`
- 평균과 최고 기록은 서버에서 재계산
- 클라이언트의 `average_ms` 등 파생 값은 무시

브라우저에서 측정한 반응 시간은 사용자가 조작할 수 있으므로 이 검증만으로 완전한 부정행위를 방지할 수 없다. 경쟁성이 높아질 경우 서버 세션 챌린지와 라운드별 이벤트 검증을 추가한다.

## 10. UI

기존 포털의 Linux/CLI 스타일을 유지한다.

게임 화면 핵심 요소:

- 현재 라운드: `1 / 5`
- 현재 상태: `READY`, `WAIT`, `GO!`, `RESULT`
- 큰 중앙 반응 영역
- 마지막 반응 시간
- 최종 평균 / 최고 반응 시간
- 성능 등급
- 다시 플레이
- 랭킹 보기

`GO!`는 상태 변화가 즉시 인식되도록 화면의 주요 시각적 신호로 사용한다.

## 11. 테스트 계획

### 단위 테스트

- 정상 성공 라운드 계산
- false start 처리
- timeout 처리
- 5라운드 완료
- 성공 라운드 3회 미만 제출 거부
- 잘못된 배열 길이 거부
- 음수/비정상 반응 시간 거부
- 서버 평균 재계산
- 사용자별 최저 평균 랭킹
- 동점 시 먼저 기록한 사용자 우선

### 브라우저 검증

1. `/games/reaction` 접근
2. 5라운드 정상 플레이
3. WAIT 중 조기 클릭
4. GO 후 timeout
5. 3회 이상 성공 결과 저장
6. 비로그인 결과 확인
7. 로그인 후 기록 제출
8. `/games/reaction/ranking`에서 순위 확인
9. `/games/reaction/best`와 `/games/reaction/my-rank` 확인
10. 모바일 폭에서 UI가 잘리지 않는지 확인

## 12. 구현 순서

1. `reaction-test-plan.md` 확정
2. Game D1 `reaction_test_scores` migration
3. 서버 검증/점수 계산 모듈
4. Reaction Test 게임 UI
5. 점수 제출 API
6. best/my-rank API
7. ranking API/page
8. 포털 카탈로그 `coming_soon → active`
9. 전체 테스트 및 Production 검증

# 미니게임 포털 기획

## 1. 목적

`kakao-account`를 공통 계정 플랫폼으로 사용하여 여러 미니게임을 한 곳에서 탐색하고 실행하며, 게임별 랭킹을 확인하는 미니게임 포털을 구축한다.

핵심 책임은 다음처럼 분리한다.

- Account: 카카오 로그인, 세션, 공통 프로필, 사용자 식별
- Portal: 홈, 사용자 상태, 게임 목록, 게임/랭킹 진입
- Game: 게임 규칙, 점수 계산, 플레이 기록, 랭킹 데이터

## 2. 첫 화면

포털 첫 화면은 공통 상단바와 게임 카드 목록으로 구성한다. 비로그인 사용자는 게임 탐색이 가능하고, 로그인 사용자는 자신의 계정 상태와 게임 기록을 이용한다.

### 상단바
- 비로그인: 서비스 로고/홈, 카카오 로그인
- 로그인: 닉네임, 프로필 이미지, 내 정보, 로그아웃
- 상단바는 게임/랭킹 화면에서도 유지한다.

### 게임 카드
- 게임명
- 짧은 설명
- 아이콘/썸네일
- 로그인 사용자의 최고 점수
- PLAY
- RANKING

## 3. 사용자 정책

비로그인 사용자도 게임 목록과 전체 랭킹 조회는 가능하게 한다.

로그인이 필요한 기능:
- 점수 제출
- 개인 최고 기록 저장
- 내 랭킹 확인
- 계정 기반 게임 진행 저장

사용자 식별자는 항상 `kakao-account users.id`를 사용한다.

```text
account_user_id = kakao-account users.id
```

Kakao Access Token과 `kakao_user_id`는 게임 서비스에 전달하거나 식별자로 사용하지 않는다.

## 4. URL 구조

```text
/games/{game-slug}
/games/{game-slug}/ranking
```

Click Rush:
```text
/games/click-rush
/games/click-rush/ranking
```

Reaction Test:
```text
/games/reaction
/games/reaction/ranking
```

## 5. 게임 화면

공통 상단바 아래에 게임별 콘텐츠를 배치한다. 포털 공통 UI와 게임 UI를 분리하여 새 게임 추가 시 기존 계정/포털 코드를 최소한으로 수정한다.

## 6. 첫 번째 미니게임 — Click Rush

### 플레이 흐름
1. `20초 / 40초 / 60초` 중 플레이 시간을 선택한다.
2. 게임 시작 후 제한 시간이 감소한다.
3. 게임 영역 안에 타겟이 나타난다.
4. 타겟 클릭 시 점수를 얻고 타겟 위치가 변경된다.
5. 빈 곳 클릭은 빗나간 클릭으로 처리한다.
6. 시간이 0이 되면 자동 종료하고 결과를 표시한다.

### 게임 HUD
- 남은 시간
- 현재 점수
- 현재 콤보
- 최고 콤보

### 점수 규칙
- 타겟 적중: `+10점`
- 연속 적중 5회: `+10점` 보너스
- 연속 적중 10회: `+20점` 보너스
- 연속 적중 20회: `+40점` 보너스
- 빗나간 클릭: `-2점`
- 최저 점수: `0점`
- 빗나간 클릭 시 콤보 초기화
- 타겟은 플레이 시간이 지날수록 조금씩 작아짐

### 서버 검증용 제출 데이터

클라이언트가 최종 `score`를 보내지 않고, 서버가 아래 플레이 지표로 점수를 재계산한다.

```text
 duration_seconds
 clicks
 misses
 max_combo
 combo5_count
 combo10_count
 combo20_count
```

서버는 허용 duration, 음수 값, 클릭 속도 상한, 콤보 카운트 범위 등을 검증한다.

## 7. 랭킹 화면

Click Rush 랭킹은 `duration`별로 독립 관리한다.

```text
click-rush / 20s
click-rush / 40s
click-rush / 60s
```

현재 API:
- `GET /api/games/click-rush/ranking?duration=20|40|60`
- `GET /api/games/click-rush/my-rank?duration=20|40|60`
- `GET /api/games/click-rush/best?duration=20|40|60`
- `POST /api/games/click-rush/scores`

랭킹은 사용자별 해당 시간대 최고 점수를 기준으로 상위 100명을 반환한다. 동점은 먼저 기록한 사용자를 우선한다.

## 8. 두 번째 미니게임 — Reaction Test

### 목표

5라운드 동안 화면의 `GO!` 신호에 최대한 빠르게 반응한다. 최종 성능은 **성공 라운드의 평균 반응 시간(ms)** 으로 평가하며, 평균이 낮을수록 높은 순위다.

Click Rush가 제한 시간 동안 반복 클릭하는 **속도/지구력 게임**이라면, Reaction Test는 한 번의 신호에 얼마나 빠르게 반응하는지를 측정하는 **순수 반응속도 게임**으로 차별화한다.

### 기본 규칙
- 한 게임은 총 `5라운드`다.
- 각 라운드 시작 후 `1.5~4.0초`의 예측하기 어려운 대기 시간이 지난다.
- 대기 중에는 `WAIT` 상태를 표시한다.
- 신호가 나오면 `GO!` 상태로 전환한다.
- 사용자는 가능한 한 빠르게 게임 영역을 클릭한다.
- 클릭 순간의 `performance.now()` 기준 경과 시간을 해당 라운드 반응 시간으로 기록한다.
- `GO!` 이후 `1.5초` 안에 클릭하지 않으면 timeout으로 처리한다.
- `WAIT` 중 클릭하면 false start로 처리하고 해당 라운드는 실패한다.
- 라운드 종료 후 결과를 짧게 표시하고 다음 라운드로 진행한다.

### 라운드 상태

```text
IDLE
  ↓
READY
  ↓
WAIT ──(클릭)──→ FALSE_START
  ↓
GO!
  ↓
PLAYER_CLICK ──→ ROUND_RESULT
  ↓
ROUND_RESULT ──→ 다음 라운드
  ↓
5라운드 완료
  ↓
FINAL_RESULT
```

### 결과 정책

각 라운드는 다음 세 종류 중 하나다.

- 성공: 실제 반응 시간(ms) 기록
- false start: 대기 중 조기 클릭
- timeout: GO 이후 제한 시간 내 미응답

최종 평균은 **성공한 라운드의 반응 시간만** 사용한다. 실패 라운드에 임의의 반응 시간을 부여하지 않는다.

랭킹 제출은 최소 `3회 성공`을 요구한다. 3회 미만 성공한 플레이는 결과 화면에서 통계는 보여주되 랭킹 기록으로 저장하지 않는다.

### 성능 등급

| 평균 반응 시간 | 등급 |
|---:|---|
| `< 200ms` | PERFECT |
| `200~249ms` | EXCELLENT |
| `250~299ms` | GREAT |
| `300~399ms` | GOOD |
| `400ms+` | SLOW |

### 결과 화면

- 총 라운드: `5`
- 성공 라운드 수
- false start 수
- timeout 수
- 평균 반응 시간
- 최고 반응 시간
- 성능 등급
- 다시 플레이
- 랭킹 보기

### 서버 제출 데이터

클라이언트는 최종 평균을 직접 신뢰하지 않고 라운드 원시 지표를 제출한다.

```text
round_count
successful_rounds
reaction_times
false_starts
timeouts
```

서버가 `reaction_times`의 유효 범위와 개수, 성공/실패 라운드 합계, 최소 성공 라운드 수를 검증하고 평균을 재계산한다. 클라이언트가 전송한 `average_ms`는 저장/랭킹 계산의 기준으로 사용하지 않는다.

MVP의 반응 시간 자체는 브라우저에서 측정되므로 완전한 부정행위 방지는 불가능하다. 따라서 MVP에서는 비정상 값/구조를 차단하고, 이후 경쟁성이 높아지면 서버 발급 세션 챌린지와 이벤트 검증을 추가한다.

### Reaction Test 데이터 모델

Click Rush는 점수가 높을수록 좋은 기존 `game_scores` 구조를 사용하지만, Reaction Test는 **평균 ms가 낮을수록 좋은 역순 랭킹**이므로 별도 게임 테이블을 사용한다.

예정 테이블: `reaction_test_scores`

```text
id
account_user_id
average_ms
best_ms
successful_rounds
false_starts
timeouts
round_times_json
created_at
```

- `account_user_id`: Account D1 `users.id`
- `average_ms`: 서버에서 성공 라운드 시간으로 계산한 평균
- `best_ms`: 성공 라운드 중 최저 반응 시간
- `round_times_json`: 감사/통계 목적의 라운드별 성공 반응 시간

### Reaction Test 랭킹

API:
- `GET /api/games/reaction/ranking`
- `GET /api/games/reaction/my-rank`
- `GET /api/games/reaction/best`
- `POST /api/games/reaction/scores`

랭킹은 사용자별 **최저 평균 반응 시간**을 기준으로 상위 100명을 반환한다. 동률이면 먼저 기록한 사용자를 우선한다.

### 보안 검증

서버는 최소한 다음을 검증한다.

- `round_count === 5`
- 성공/false start/timeout 합계가 5인지 확인
- `reaction_times` 개수가 성공 라운드 수와 일치하는지 확인
- 반응 시간은 정수이며 합리적인 최소/최대 범위인지 확인
- 성공 라운드가 3회 이상인지 확인
- `average_ms`는 클라이언트 값을 사용하지 않고 서버에서 계산
- 음수/비정상적으로 큰 값/구조가 다른 payload 거부

## 9. 점수 보안

```text
Browser → Game Server → 입력 검증/점수 재계산 → Game DB → Ranking
```

클라이언트가 임의의 최종 점수를 제출해도 서버에서 무시한다. MVP에서는 플레이 지표 기반 검증을 적용하고, 경쟁성이 높은 게임부터 세션/속도/플레이 이벤트 검증을 강화한다.

## 10. 데이터 소유권

Account와 Game 데이터는 별도의 D1 database binding으로 운영한다.

Account DB:
- users
- sessions
- user_settings

Game DB:
- game_scores
- legacy_game_scores (이전 데이터 보존용)
- 플레이 기록
- 최고 점수
- 랭킹
- 게임별 진행 데이터
- reaction_test_scores

게임 DB는 `account_user_id`를 계정 플랫폼의 `users.id`와 연결한다. Game DB에는 Account 테이블이나 Kakao 토큰을 복제하지 않는다.

기존 MVP의 `migrations/0003_game_scores.sql`, `0004_click_rush_combo_counts.sql`은 기존 Account D1에 적용되었던 legacy schema다. 신규 런타임은 `migrations-game/`의 전용 마이그레이션과 `GAME_DB` binding을 사용한다.

### Legacy 데이터 이전 정책 — 완료

기존 Account D1 `game_scores`의 Game D1 이전 및 검증을 완료했으며, Production Account D1의 legacy 테이블도 제거했다.

- 모든 legacy 기록은 Game D1 `legacy_game_scores`에 원본 `id`를 기준으로 보존하도록 구성했다.
- 기존 60초 Click Rush 기록은 현재 활성 `game_scores`에도 `legacy_source_id`를 연결하여 이전하도록 구성했다.
- 기존 180초/300초 기록은 현재 게임 규칙에 존재하지 않으므로 활성 랭킹에는 넣지 않고 `legacy_game_scores`에만 보존하도록 구성했다.
- 이전 스크립트는 `source_id`/`legacy_source_id` 기준으로 중복 생성하지 않도록 구현했다.
- Production 검증 결과 legacy Account D1 `game_scores` 행은 `0건`이었다.
- Production Game D1 마이그레이션 검증 결과 보존/활성 이전 대상은 `0/0`으로 확인되었다.
- `Legacy Game Data Migration` workflow에서 `cleanup_legacy=true`로 실행하여 Account D1의 legacy `game_scores` 테이블 삭제를 완료했다.
- 이후 런타임은 Account D1의 legacy `game_scores`에 의존하지 않으며 Game D1만 사용한다.

## 11. 게임 카탈로그

초기에는 정적 TypeScript 데이터로 관리한다.

최소 필드:
```text
slug
name
description
icon/thumbnail
status
sort_order
ranking_enabled
```

상태: `active`, `maintenance`, `coming_soon`

Reaction Test는 기획/구현 완료 후 `coming_soon`에서 `active`로 전환한다.

## 12. UI/UX

데스크톱은 3~4열 게임 카드, 모바일은 1~2열 카드와 세로형 게임 영역을 사용한다. 랭킹 표는 모바일에서 핵심 컬럼 중심으로 축약한다.

Reaction Test는 기존 Linux/CLI 느낌을 유지하되 상태 변화가 명확하게 보이도록 `READY`, `WAIT`, `GO!`, `RESULT`를 크게 표시한다.

## 13. MVP 단계

### Phase A — 포털
- [x] 공통 상단바
- [x] 로그인/로그아웃 상태 표시
- [x] 게임 카드 목록
- [x] PLAY 이동
- [x] RANKING 이동
- [x] 반응형 레이아웃

### Phase B — 첫 게임
- [x] 첫 미니게임 구현 — Click Rush
- [x] Click Rush 점수 스키마
- [x] Click Rush 서버 점수 검증
- [x] 점수 저장 API
- [x] 개인 최고 점수 API
- [x] 전체 랭킹 API/페이지
- [x] Game DB binding 분리 구현
- [x] 실제 카카오 로그인 사용자 통합 테스트 및 Production 검증
- [x] 기존 Account D1의 legacy game_scores 데이터 이전 검증
- [x] 이전 검증 후 Account D1 legacy game_scores 제거

### Phase C — 두 번째 게임
- [x] Reaction Test 게임 규칙 기획
- [x] Reaction Test 전용 데이터 모델 기획
- [ ] Reaction Test 구현
- [ ] Reaction Test 점수 저장 API
- [ ] Reaction Test 개인 최고 기록 API
- [ ] Reaction Test 랭킹 API/페이지
- [ ] Reaction Test 포털 활성화

### Phase D — 확장
- [ ] 카탈로그 관리
- [ ] 기간/시즌 랭킹
- [ ] 서버 점수 검증 강화
- [ ] 부정행위 모니터링

## 14. 최종 기획 원칙

1. **Account** — 누가 플레이하는가?
2. **Portal** — 어떤 게임을 선택하는가?
3. **Game** — 어떻게 플레이하고 어떤 점수를 얻는가?

게임 수가 늘어나도 계정 시스템을 다시 만들지 않고, 각 게임의 랭킹/데이터 정책을 독립적으로 운영한다.

## 15. 다음 구현 순서

1. ~~포털 홈~~
2. ~~공통 상단바~~
3. ~~게임 카탈로그~~
4. ~~Click Rush 구현~~
5. ~~Click Rush 점수 스키마~~
6. ~~점수 저장 API 및 서버 검증~~
7. ~~랭킹 API/페이지~~
8. ~~Game D1 binding 분리 구현~~
9. ~~실제 카카오 로그인 사용자 통합 테스트~~
10. ~~Legacy Account D1 데이터를 Game D1로 이전 및 검증~~
11. ~~Account D1 legacy 테이블 제거~~
12. ~~두 번째 게임 기획~~
13. Reaction Test 구현
14. Reaction Test 점수 저장 API
15. Reaction Test 개인 최고 기록 API
16. Reaction Test 랭킹 API/페이지
17. 포털 카탈로그 활성화 및 통합 검증

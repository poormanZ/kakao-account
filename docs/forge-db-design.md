# Forge 데이터베이스 설계

## 목적

Forge는 로그인한 서비스 사용자(`users.id`)를 기준으로 게임 상태를 한 개의 D1 aggregate row에 저장한다.

## 데이터베이스 경계

```text
Account D1 (kakao-account-db)
┌──────────────┐
│ users        │
│ id (PK)      │◄─────────────── logical user id ───────────────┐
└──────┬───────┘                                                  │
       │                                                          │
       │ 1:N                                                      │
┌──────▼───────┐                                                  │
│ sessions     │                                                  │
│ user_id      │                                                  │
└──────────────┘                                                  │
                                                                  │
Game D1 (kakao-account-game-db)                                   │
┌──────────────────────────────┐                                  │
│ forge_game_states            │                                  │
│ account_user_id (PK)        │◄─────────────────────────────────┘
│ gold                         │
│ current_weapon_json          │
│ shop_weapons_json            │
│ skills_json                  │
│ version                      │
│ last_action_id               │
│ last_action_result_json      │
│ updated_at                   │
└──────────────────────────────┘

legacy: forge_action_logs
└─ 과거 idempotency 기록 보존용. 신규 액션의 정합성 경로에는 사용하지 않음.
```

## 핵심 규칙

1. Account D1과 Game D1은 물리적으로 분리되어 있으므로 cross-database foreign key를 만들지 않는다.
2. `account_user_id`는 Account D1의 `users.id`를 논리적으로 참조한다.
3. Forge 게임의 상태는 `forge_game_states` 한 행을 aggregate root로 취급한다.
4. 상태 변경과 마지막 처리 action의 idempotency 정보를 같은 UPDATE로 저장한다.
5. `version` 조건부 UPDATE로 동시 요청을 차단한다.
6. 동일 `actionId`가 재전송되면 저장된 `last_action_result_json`을 반환한다.
7. 이전 version의 action이 다시 오면 409로 거부한다.
8. 신규 Forge 액션은 `forge_action_logs`의 조회/삽입 성공 여부에 의존하지 않는다.
9. RNG와 골드/무기/스킬 변경은 서버에서 계산한다.

## 액션 처리 흐름

```text
POST action
   │
   ▼
Auth users.id 확인
   │
   ▼
Game D1 Primary에서 forge_game_states 조회
   │
   ├─ 같은 actionId + 결과 존재 ──► 저장된 결과 반환
   │
   ├─ version 불일치 ────────────► 409
   │
   ▼
서버에서 게임 규칙 계산
   │
   ▼
조건부 UPDATE
WHERE account_user_id = ? AND version = ?
   │
   ├─ changes != 1 ──────────────► 409
   │
   ▼
200 + 새 상태 + lastAction
```

## 기존 `forge_action_logs` 처리

초기 구현에서는 상태 UPDATE와 action log INSERT를 하나의 batch에 묶었다. 이 구조는 이론적으로 원자적이지만, 게임 상태와 idempotency가 서로 다른 테이블의 성공에 의존한다는 단점이 있었다.

현재 구현에서는 `forge_game_states`에 마지막 action 정보를 함께 저장한다. 기존 `forge_action_logs`는 과거 데이터 보존을 위해 삭제하지 않는다.

## 마이그레이션

`0008_forge_session_idempotency.sql`이 기존 `forge_game_states`에 다음 컬럼을 추가한다.

- `last_action_id TEXT`
- `last_action_result_json TEXT`

배포 시 Game D1에도 `migrations-game`을 반드시 적용한다.

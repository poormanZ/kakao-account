# 데이터베이스 설계

초기 구현은 Cloudflare D1(SQLite)을 사용한다. 서비스 내부 식별자는 `users.id`이며 카카오의 사용자 ID는 `kakao_user_id`에 저장한다.

## users

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | INTEGER | PK | 서비스 내부 사용자 ID |
| kakao_user_id | TEXT | UNIQUE NOT NULL | 카카오 사용자 식별자 |
| nickname | TEXT | NULL | 현재 서비스에서 사용하는 표시 이름 |
| profile_image_url | TEXT | NULL | 카카오 프로필 이미지 URL |
| created_at | TEXT | NOT NULL | 생성 시각(UTC ISO-8601) |
| updated_at | TEXT | NOT NULL | 수정 시각(UTC ISO-8601) |

## sessions

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | TEXT | PK | 암호학적으로 생성한 세션 ID의 해시 또는 직접 세션 ID |
| user_id | INTEGER | FK NOT NULL | users.id |
| expires_at | TEXT | NOT NULL | 만료 시각 |
| created_at | TEXT | NOT NULL | 생성 시각 |
| last_seen_at | TEXT | NOT NULL | 마지막 사용 시각 |

운영 시 세션 ID 원문을 DB에 보관하는 대신 해시를 저장하는 방식을 우선 검토한다.

## user_settings

초기 구현 이후 사용자별 설정이 필요할 때 추가한다.

| 컬럼 | 타입 | 제약 |
|---|---|---|
| user_id | INTEGER | PK/FK |
| setting_key | TEXT | PK |
| setting_value | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

## 인덱스

- `users.kakao_user_id`는 UNIQUE 제약으로 조회를 지원한다.
- `sessions.user_id` 인덱스를 생성한다.
- `sessions.expires_at` 인덱스를 생성해 만료 세션 정리를 지원한다.

## 데이터 보안

- 카카오 Access Token, Refresh Token, Client Secret은 일반 사용자 데이터 테이블에 저장하지 않는다.
- 필요성이 확인되기 전까지 카카오 이메일 등 추가 개인정보를 저장하지 않는다.
- 저장 데이터는 서비스에 필요한 최소 항목만 유지한다.
- 모든 시간은 UTC로 저장하고 표시 시 클라이언트/서비스 타임존으로 변환한다.

## 초기 SQL 개념

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kakao_user_id TEXT NOT NULL UNIQUE,
  nickname TEXT,
  profile_image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

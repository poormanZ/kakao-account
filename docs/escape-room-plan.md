# Escape Room 미니게임

## 1. 목표

미니게임 포털에 단서 기반 방탈출 게임을 추가한다. 첫 퍼즐은 숨겨진 주제 `PRIME`을 찾아내는 구조로 시작하며, 브라우저 소스코드만 확인해도 정답 문자열이 직접 노출되지 않도록 정답 검증은 Cloudflare Worker에서 수행한다.

## 2. 포털 진입

```text
/escape-room
```

포털 홈(`/`)에 `ESCAPE ROOM` 카드를 노출한다.

## 3. STEP 1 퍼즐

단서 문장:

> Open our archive, confirm performance.

각 단어에는 서로 다른 색상이 적용된다.

- Open → RED
- our → BLUE
- archive → GREEN
- confirm → YELLOW
- performance → PURPLE

`SETTING`을 누르면 `MODEL PERFORMANCE` 그래프가 열린다. 같은 색으로 강조된 값은 다음과 같다.

- RED → 2
- BLUE → 3
- GREEN → 5
- YELLOW → 7
- PURPLE → 11

플레이어는 색을 연결해 `2, 3, 5, 7, 11`을 얻고, 이 수열이 소수(`PRIME`)임을 인식한다. 이후 각 숫자를 대응하는 단어의 문자 위치로 사용한다.

```text
Open[2]        → P
our[3]         → R
archive[5]     → I
confirm[7]     → M
performance[11]→ E
```

최종 키는 `PRIME`이다.

## 4. 힌트

순차적으로 공개한다.

1. `Some colors appear twice.`
2. `Follow the colors.`
3. `Numbers can point to letters.`
4. `Count from the beginning.`

## 5. 정답 검증

클라이언트 JavaScript에는 `PRIME`을 정답으로 비교하는 로직을 넣지 않는다.

```text
Browser
  │
  │ POST /api/games/escape-room/answer
  │ { answer }
  ▼
Cloudflare Worker
  │
  │ compare with ESCAPE_PRIME_KEY secret
  ▼
ACCESS GRANTED / ACCESS DENIED
```

`ESCAPE_PRIME_KEY`는 Cloudflare Worker Secret으로 저장한다. 저장소의 소스 코드, HTML, JavaScript, 문서에는 실제 Secret 값을 기록하지 않는다.

## 6. 보안 범위

이 구조의 목적은 소스코드에서 정답을 즉시 읽는 것을 방지하는 것이다. 퍼즐 자체는 의도적으로 플레이어가 화면을 관찰하고 논리적으로 풀 수 있어야 한다.

완전한 치팅 방지를 목표로 하지 않으며, 향후 다단계 게임 진행이 추가되면 서버 발급 퍼즐 세션과 진행 상태를 추가한다.

## 7. 향후 확장

- STEP 2 이상 추가
- 서버 검증 기반 단계 해금
- 계정별 클리어 기록
- 소요 시간 기록
- 힌트 사용 횟수 기록
- 전체 Escape Room 랭킹

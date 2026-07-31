# OTT 다모아 MVP 기획서

- 버전: v0.6
- 작성일: 2026-07-30
- 문서 상태: 현재 구현 정합화안 · 3일 백엔드 스프린트 기준
- 기준 문서: `ott-damoa-mvp-v0.5(기술스택 반영).md`
- 적용 우선순위: 이 문서 > `docs/ARCHITECTURE.md`·`docs/TEAM-OWNERSHIP.md` > v0.5

---

## 0. v0.6 개정 목적

v0.5는 로그인, 회원가입, 사용자 프로필과 참여 이력을 전제로 작성되었다.
`urizo-main`을 만드는 과정에서 3일 Demo의 범위와 실행 안정성을 위해 다음
후속 결정을 확정했다.

1. 로그인·회원가입·사용자 계정·프로필·인증 세션을 사용하지 않는다.
2. 찜·봤어요와 MY 기능을 사용하지 않는다.
3. 관심 없음 상태는 프론트엔드 `sessionStorage`에서만 관리한다.
4. 백엔드 DB에는 비식별 추천 Run과 Trace만 저장한다.
5. 기본 Demo는 계정, DB, pgvector, OpenAI 자격 증명 없이 실행할 수 있어야 한다.
6. 현재 구현된 fixture catalog, local search, deterministic selector, memory store를
   기본 경로로 유지한다.
7. Supabase DB를 선택한 경우에도 Run과 Trace 이외의 사용자·참여·카탈로그
   데이터를 저장하지 않는다.

v0.6은 위 결정을 반영해 v0.5의 제품 범위와 기술 범위를 재정의한다.

### 0.1 주요 변경

| 항목 | v0.5 | v0.6 |
|---|---|---|
| 서비스 진입 | Kakao·Google 로그인 | 즉시 CHOICE 진입 |
| OTT 정보 | 사용자 프로필에 저장 | CHOICE의 요청 단위 선택값 |
| 연령 정보 | 생년월일·세션에서 계산 | 익명 안전 기본값과 동반자 조건으로 처리 |
| 개인 취향 | 프로필 선호·비선호 장르 | 현재 CHOICE 입력만 사용 |
| 찜·봤어요 | 백엔드 이벤트와 MY에 저장 | 제거 |
| 관심 없음 | 백엔드 영구 저장 | 브라우저 탭의 `sessionStorage` |
| 카탈로그 저장 | PostgreSQL catalog tables | 소스에 포함된 정적 fixture |
| 의미 검색 | pgvector | 현재 local semantic search |
| 최종 선택 | OpenAI LLM | selector contract, deterministic 기본, OpenAI 선택형 |
| DB 저장 | 사용자·카탈로그·추천·참여 | 익명 Run·Trace만 |

---

## 1. 서비스 정의

### 1.1 한 줄 정의

로그인 없이 현재 OTT·기분·동반자·시청 가능 시간을 입력하면 지금 볼 작품
5편을 추천하고, 정책 계층이 조건 위반과 실행 예산 초과를 차단하며 그 과정을
Trace로 공개하는 콘텐츠 추천 Demo다.

### 1.2 해결하려는 문제

- 여러 OTT를 번갈아 탐색하는 선택 피로
- 지금 기분과 남은 시간에 맞지 않는 일반 인기 순위
- 함께 보는 사람에게 부적합한 추천
- 실제 국내 OTT에서 찾을 수 없는 추천
- AI가 조건을 임의로 완화하거나 안전 규칙을 어기는 문제
- 추천 결과만 있고 판단 과정을 알 수 없는 블랙박스 문제

### 1.3 핵심 가치

> 검색하지 말고 1분 안에 지금 볼 작품을 결정한다.
>
> AI와 추천 파이프라인이 무엇을 했고 어떤 정책이 작동했는지 확인할 수 있다.

### 1.4 MVP 검증 가설

1. 많은 목록보다 5편으로 압축된 결과가 결정을 돕는다.
2. 요청 시점의 OTT·기분·시간·동반자를 반영하면 추천 적합도가 높아진다.
3. TOP1 이유를 최대 3개로 제한하면 빠르게 판단할 수 있다.
4. 정책 Trace를 공개하면 결과만 제공하는 추천보다 신뢰도가 높아진다.
5. 조건을 몰래 바꾸지 않고 승인받으면 부분 결과에 대한 수용도가 높아진다.

---

## 2. MVP 범위

### 2.1 포함

- 로그인 없는 익명 진입
- CHOICE 요청 단위 OTT 선택
- 누구와 보는지 1개 선택
- 분위기 8종 복수 선택
- 시청 가능 시간 선택
- 제작 국가 선택
- 상대가 피하는 장르 1개
- 자연어 원문 검색
- 정적 fixture catalog와 사전 검수된 분위기 태그
- 국내 OTT 제공 여부와 watch URL
- 필수 필터 → local semantic search → hybrid score → diversity penalty
- TOP1 + 후보 4편
- TOP1 추천 이유 최대 3개
- deterministic selector 기본 경로
- 설정으로 선택 가능한 OpenAI structured selector
- 예산 상한과 deterministic rule-based fallback
- 응답 직전 최종 정책 재검사
- 30분에서 45분으로 넓히는 1회 승인 게이트
- 현재 결과와 기존 노출 작품을 제외하는 안전한 즉시 교체
- 공개 가능한 추천 실행 Trace
- 결과 화면의 접힌 과정 타임라인
- OTT 직접 링크 → OTT 검색 → OTT 홈 3단계 이동
- 익명 Run·Trace의 memory 및 Prisma repository 계약
- Demo 데이터 초기화와 adapter health

### 2.2 제외

- Kakao·Google 로그인
- 회원가입·약관 동의·만 14세 가입 확인
- 사용자 계정·닉네임·생년월일
- 사용자 프로필·온보딩·구독 OTT 영구 저장
- 인증 세션·쿠키 기반 사용자 식별
- 선호·비선호 장르 프로필
- 찜·찜 해제
- 봤어요·시청 이력
- MY 화면과 개인 추천 이력 목록
- 백엔드 관심 없음 이벤트·상태·만료 정책
- 사용자 행동 분석용 engagement table
- 사용자 취향 임베딩
- catalog·genre·provider·embedding의 런타임 DB 저장
- pgvector 검색
- Redis와 추천 결과 캐시
- 자연어 LLM 구조화
- 조건 완화 다단계
- 작품 상세 페이지·공유·좋아요·관리자 화면
- agent loop, LangGraph, MCP, ReAct
- TMDB 자동 주기 배치

---

## 3. 익명 사용자 흐름

```text
서비스 진입
→ CHOICE 화면
→ 이번 요청에서 사용할 OTT 선택
→ 동반자·기분·시간·제작 국가·자연어 입력
→ 추천 요청
   ├─ 정상: TOP1 + 후보 4편
   ├─ 후보 부족: 30분 → 45분 승인 대기
   │   ├─ 승인: 시간 조건만 변경해 1회 재실행
   │   └─ 거절: 현재 안전한 부분 결과 반환
   ├─ 예산 초과: rule-based fallback + 고지
   └─ 정책 위반: 응답 직전 제거 + Trace
→ 추천 이유와 과정 타임라인 확인
→ 관심 없음
   ├─ 프론트 sessionStorage에 contentId 저장
   └─ 일반 교체 API 호출
→ OTT 직접 링크·검색 페이지·홈으로 이동
```

로그인·가입·프로필·MY 화면을 이 흐름에 넣지 않는다.

---

## 4. CHOICE

모든 값은 사용자 계정이 아닌 현재 추천 요청에만 적용한다.

사용자가 값을 고르지 않았을 때의 중립 기본값:

- OTT: 지원하는 국내 OTT 전체
- 동반자: `ANY`
- 분위기: 빈 배열
- 시간: `null`
- 제작 국가: `ANY`
- 원하는 장르·상대 제외 장르: 빈 배열
- 자연어: 빈 문자열

현재 코드의 `ALONE`, `따뜻한`, `120분` 기본값은 사용자가 선택하지 않은
조건을 암묵적으로 적용하므로 제거한다.

### 4.1 이번에 볼 수 있는 OTT

- Netflix
- TVING
- Disney+
- WAVVE
- WATCHA
- Coupang Play

복수 선택할 수 있다. 아무것도 선택하지 않으면 국내에서 확인된 모든 지원
OTT를 대상으로 한다. 이 값은 사용자 프로필로 저장하지 않는다.

현재 `RecommendationChoice`에는 OTT 필드가 없으므로 `selectedProviders`를
추가해야 한다.

### 4.2 누구와 보나요?

- 혼자
- 연인
- 친구
- 가족
- 아이와 함께
- 상관없음

연인 또는 친구 선택 시 상대가 피하는 장르 1개를 선택할 수 있다.

### 4.3 지금 기분

| 화면 라벨 | 내부값 |
|---|---|
| 즐겁게 웃고 싶어요 | 밝은 |
| 위로받고 싶어요 | 따뜻한 |
| 감성에 젖고 싶어요 | 감성적인 |
| 어둡고 진한 게 좋아요 | 어두운 |
| 긴장감을 느끼고 싶어요 | 긴장감 있는 |
| 편안하게 보고 싶어요 | 잔잔한 |
| 생각할 거리가 있으면 좋겠어요 | 생각할 거리가 있는 |
| 자극적인 게 당겨요 | 자극적인 |

복수 선택할 수 있다.

### 4.4 볼 수 있는 시간

- 30분 이내
- 1시간 이내
- 2시간 이내
- 3시간 이내
- 상관없음

영화는 전체 러닝타임, 시리즈는 회차 기준 시간을 사용한다.

### 4.5 제작 국가

- `KR`: 한국 작품
- `NON_KR`: 해외 작품
- `ANY`: 상관없음

`originCountries` 또는 `productionCountries`에 `KR`이 하나라도 있으면 한국
작품으로 판단한다.

### 4.6 자연어 입력

- 선택 입력
- 최대 140자
- 구조화하지 않고 검색 쿼리에 원문 그대로 사용
- 자연어에서 연령·시간·OTT 같은 필수 필터 값을 추론하지 않음
- Trace와 DB에 원문을 저장하지 않음
- 결과 이유에 원문을 그대로 복제하지 않음

자연어는 현재 요청을 처리하는 동안에만 메모리에 존재한다.

승인·교체 재실행을 위해 원문 대신 local search가 만든 비문자형 query vector와
입력 fingerprint를 Run에 저장한다. query vector에는 원문 token이나
`matchedTerms`를 포함하지 않는다. 승인·교체는 저장된 vector와 정제된 구조화
CHOICE를 재사용하며 자연어 원문을 요구하지 않는다.

### 4.7 요청 예시

```json
{
  "choice": {
    "selectedProviders": ["NETFLIX", "TVING"],
    "companions": ["PARTNER"],
    "moods": ["긴장감 있는"],
    "desiredGenres": [],
    "companionAvoidGenres": ["공포"],
    "maxRuntimeMinutes": 120,
    "originPreference": "ANY",
    "naturalLanguage": "비 오는 날 몰입해서 볼 작품",
    "explicitlyRequestedGenres": []
  }
}
```

`scenario`는 Demo Lab과 자동 테스트에서만 사용할 수 있다. 운영 API에서는
클라이언트가 `policy_block`이나 `budget_fallback`을 강제할 수 없게 한다.

---

## 5. 익명 안전 정책

생년월일과 인증 세션이 없으므로 사용자 연령을 추정하지 않는다.

### 5.1 기본 안전선

- `18` 및 `UNKNOWN` 등급은 익명 MVP 결과에서 항상 제외한다.
- `WITH_CHILDREN` 선택 시 `ALL`, `7`, `12`만 허용한다.
- 연령 등급을 자연어 또는 LLM으로 판정하지 않는다.
- 안전선은 검색 전 필터와 응답 직전 정책 검사에서 두 번 적용한다.

이는 계정 기반 연령 정책을 제거하면서 안전 규칙을 약화하지 않기 위한
보수적인 MVP 결정이다.

### 5.2 해제 불가 필터

- 익명 연령 안전선 위반
- 국내 시청 가능한 OTT 없음
- 선택한 시간 초과
- 선택 OTT가 있는데 해당 OTT에서 제공되지 않음
- 선택 제작 국가 불일치

### 5.3 요청 단위 기본 제외

- 상대가 피하는 장르

해당 장르를 사용자가 현재 요청에서 명시적으로 원하는 경우에만 해제할 수
있다. 시스템이 추측해 해제하지 않는다.

찜·봤어요·프로필 비선호·백엔드 관심 없음은 검사하지 않는다.

---

## 6. 카탈로그와 OTT 링크

### 6.1 Runtime 데이터

- 기본 Runtime은 `src/demo/fixtures/catalog.ts`의 정적 fixture를 사용한다.
- 작품에는 검색과 필터에 필요한 모든 필드를 포함한다.
- 분위기 태그는 요청 시 생성하지 않고 사전에 검수해 fixture에 포함한다.
- 기본 Demo 실행은 TMDB·OpenAI·Supabase 자격 증명을 요구하지 않는다.

### 6.2 목표 데이터

- 현재 fixture에는 29편이 확인된다.
- 3일 MVP 완료 조건은 300편 수집이 아니라 모든 대표 시나리오에서 안전한
  TOP5와 최소 1개의 교체 후보를 제공하는 것이다.
- 300편은 fixture 생성 파이프라인을 별도로 진행할 때의 후속 확장 목표다.
- TMDB에서 데이터를 가져오는 개발용 스크립트를 만들 경우 출력물을 fixture로
  고정하며 Runtime에서 TMDB를 호출하지 않는다.
- 현재 저장소에는 TMDB ingestion script가 없으므로 신규 생성 여부는 Day 1에
  확정한다.

### 6.3 OTT 이동

| 상태 | 이동 | 문구 |
|---|---|---|
| 검증된 직접 링크 | 작품 페이지 | 바로 보기 |
| 검색 URL 템플릿 확인 | 제목이 포함된 검색 페이지 | OTT에서 찾기 |
| 검색 URL 미확인 | OTT 홈 | OTT에서 찾기 |

링크 상태와 버튼 문구가 일치해야 한다.

현재 `ProviderAvailability`에는 `watchUrl`만 있고 모든 fixture URL이 검색
페이지로 만들어진다. v0.6에서는 다음 link type을 추가한다.

- `DIRECT`
- `SEARCH`
- `HOME`

검증되지 않은 URL을 `DIRECT`로 표시하지 않는다.

---

## 7. 추천 로직

### 7.1 실행 순서

```text
RecommendationRequest 정규화
→ 익명 필수 필터
→ local semantic search
→ hybrid score
→ collection diversity penalty
→ 상위 후보
→ selector
→ 응답 직전 동일 정책 재검사
→ 최대 5편 반환
→ Run과 Trace 저장
```

### 7.2 Local semantic search

- 자연어가 있으면 원문과 CHOICE 조건을 검색 쿼리로 조합한다. 현재
  `buildSearchQuery()`는 자연어가 있으면 CHOICE를 버리고 원문만 반환하므로
  수정이 필요하다.
- 자연어가 없으면 동반자·분위기·장르 조건으로 문장을 조립한다.
- 현재 `semantic.ts`의 token/hash vector와 cosine similarity를 유지한다.
- 최대 검색 후보 수는 30편이다.
- 같은 fixture와 입력은 같은 후보 순서를 반환해야 한다.
- pgvector와 embedding table은 v0.6 MVP에서 사용하지 않는다.
- 검색 시 원문과 token은 휘발성으로 사용하고, 연속 실행에는 비문자형 query
  vector만 저장한다.

### 7.3 Hybrid score

기존 `src/config/recommendation.ts`의 가중치를 유지한다.

| 요소 | 자연어 있음 | 없음 |
|---|---:|---:|
| 의미 유사도 | 0.30 | 0.15 |
| 분위기 | 0.22 | 0.29 |
| 장르 | 0.20 | 0.26 |
| 시간 | 0.13 | 0.15 |
| 작품 품질 | 0.10 | 0.10 |
| 동반자 | 0.05 | 0.05 |

- 모든 항목은 0~1로 정규화한다.
- 작품 품질은 `평점 × log1p(평가 수)`를 사용한다.
- Match Percent는 최종 점수에서 0~100 정수로 계산한다.
- 가중치는 설정 파일에 두고 계산 코드에 하드코딩하지 않는다.
- 프로필 선호 장르는 사용하지 않는다.
- `desiredGenres`가 비어 있으면 genre 요소를 점수 합산에서 제외하고 나머지
  요소의 가중치를 비율대로 재정규화한다. 사용자가 고르지 않은 장르를
  기본값으로 만들지 않는다.

### 7.4 다양성

- 같은 `collectionId`의 두 번째 작품부터 반복 횟수당 0.12를 감점한다.
- 다른 점수가 충분히 높으면 완전히 제외하지 않는다.
- 같은 작품 ID를 중복 반환하지 않는다.

### 7.5 Selector

#### 기본

- `DeterministicSelectorAdapter`
- 점수와 한글 제목 순서로 안정적으로 정렬
- 자격 증명 없는 Demo의 필수 경로

#### OpenAI 선택형

- 상위 후보 풀에 포함된 ID만 선택할 수 있다.
- 구조화된 JSON으로 최대 5개 ID와 TOP1 이유를 받는다.
- temperature 0을 사용한다.
- 후보 밖 ID, 중복 ID, 잘못된 JSON은 거부한다.
- 오류·예산 초과 시 deterministic selector로 전환하고 고지한다.
- 구체적인 생성 모델명은 환경 설정으로 관리하며 Day 1 확정이 필요하다.

### 7.6 추천 이유

- TOP1에 최대 3개
- 실제 계산과 필터에 반영한 조건만 사용
- 선택한 분위기는 화면 라벨 또는 검증된 내부 태그에 대응
- 실제 provider, runtime, genre, mood, quality 데이터만 사용
- 사용자가 말하지 않은 감정이나 상황을 만들어내지 않음
- 자연어 원문과 개인 식별 가능 문장을 DB·Trace에 복제하지 않음

---

## 8. Policy Layer

Policy Layer는 추천 Pipeline 바깥에서 실행을 감시하고 결과를 재검사한다.

### 8.1 예산

| 항목 | 상한 | 초과 시 |
|---|---:|---|
| 생성 모델 호출 | 3회 | 실행 중단 후 deterministic fallback |
| 검색·외부 도구 호출 | 2회 | 동일 |
| 누적 토큰 | 8,000 | 동일 |
| 총 실행 시간 | 25초 | 동일 |

기본 local/deterministic 경로에서도 같은 BudgetCounter 계약을 통과한다.

### 8.2 Fallback

- 필수 필터를 먼저 적용한다.
- 분위기·장르·동반자·품질·시간의 고정 점수만 사용한다.
- 최대 5편을 반환한다.
- 결과에 `fallbackUsed: true`를 포함한다.
- Trace에 fallback 이유와 예산 snapshot을 기록한다.
- 화면에서 `응답 시간을 지키기 위해 기본 추천으로 보여드려요`를 고지한다.

### 8.3 응답 직전 강제 검사

- 익명 연령 안전선
- 국내 OTT 제공 여부
- 선택 OTT
- 승인된 범위 안의 runtime
- 제작 국가
- 후보 풀에 실제로 존재하는 작품 ID
- 현재 Run에 이미 노출된 작품과 교체 제외 ID

위반 작품은 제거하고 정책 차단 Trace를 남긴다. 조건을 임의로 풀어 5편을
채우지 않는다.

### 8.4 승인 게이트

v0.6에서는 한 번의 runtime 완화만 허용한다.

```text
30분 이내 후보가 5편 미만
→ 45분까지 넓힐지 질문
   ├─ 승인: runtime만 45분으로 변경하고 1회 재실행
   └─ 거절: 현재 안전한 부분 결과로 완료
```

- 제작 국가와 분위기의 추가 완화는 하지 않는다.
- 승인 전 조건을 변경하지 않는다.
- 이미 완료된 Run을 다시 승인할 수 없다.

### 8.5 안전한 교체

- 완료된 Run에서 현재 노출 중인 contentId만 교체할 수 있다.
- 현재 표시 작품 전체와 과거 교체된 작품을 후보에서 제외한다.
- 원래 필수 조건과 승인된 runtime을 유지한다.
- 안전한 후보가 없으면 400 오류를 반환한다.
- 관심 없음 상태나 engagement event를 백엔드에 저장하지 않는다.
- Run에는 교체 이력만 실행 기록으로 남기고 Trace에 replacement를 기록한다.

---

## 9. Run과 Trace

### 9.1 runId

- 사용자 ID와 무관한 고엔트로피 opaque string
- 현재 `run_<UUID>` 형식을 유지한다.
- API 사용자는 runId를 통해 해당 실행을 단건 조회한다.
- 전체 Run 목록 API를 제공하지 않는다.
- 순차 번호나 추측 가능한 ID를 사용하지 않는다.

현재 Prisma의 `@db.Uuid`와 `run_<UUID>`가 충돌하므로 Run·Trace ID와 FK는
`VarChar`로 맞춰야 한다.

### 9.2 RecommendationRun 저장 범위

최소 필드:

- `id`
- `status`
- `executionMode`
- `inputFingerprint`
- 식별정보와 자연어 원문을 제거한 `requestSnapshot`
- 원문 없는 local search query vector
- 결과 재조회용 `responseSnapshot`
- `excludedContentIds`
- `replacedContentIds`
- `candidateCount`
- `resultCount`
- 모델·도구 호출 수와 token count
- `durationMs`
- `policyBlockCount`
- `fallbackReason`
- `errorCode`
- `startedAt`, `completedAt`, `createdAt`, `updatedAt`

### 9.3 AgentTrace 저장 범위

- `id`
- `runId`
- `sequence`
- `action`
- `visibility`
- allowlist 기반 `detail`
- 공개용 `publicMessage`
- `durationMs`
- `createdAt`

Trace는 append-only로 저장한다. 공개 응답에는 `PUBLIC` 또는 이미 정제된
이벤트만 포함한다.

### 9.4 저장 금지

- 사용자 ID, 닉네임, 이메일
- OAuth·세션·쿠키 정보
- 생년월일
- 자연어 입력 원문
- 원본 prompt
- secret, API key, DB URL
- 찜·봤어요·관심 없음
- OTT 클릭 이벤트

### 9.5 Repository 모드

| 환경 | Run | Trace |
|---|---|---|
| no-env Demo·자동 테스트 | memory | memory |
| Supabase 설정 환경 | Prisma | Prisma |

두 구현은 동일한 repository contract test를 통과해야 한다. 선택되지 않은
Prisma adapter는 초기화하거나 환경 변수를 검증하지 않는다.

---

## 10. Backend API

| Method | Path | 입력 | 출력 | 상태 |
|---|---|---|---|---|
| POST | `/api/recommendations` | `RecommendationRequest` | 완료 또는 승인 대기 응답 | 유지·수정 |
| GET | `/api/recommendations/{runId}` | path runId | 단건 추천 응답 + Trace | 유지 |
| POST | `/api/recommendations/{runId}/approval` | `{ "decision": "approve" \| "reject" }` | 갱신된 추천 응답 | 유지 |
| POST | `/api/recommendations/{runId}/replacement` | `{ "contentId": "..." }` | 한 자리만 교체된 응답 | 유지 |
| GET | `/api/health` | 없음 | 선택 adapter 상태 | 유지·수정 |
| POST | `/api/demo/reset` | 없음 | `{ "ok": true }` | Demo·테스트만 |

제거 API:

- `GET /api/recommendations`
- `GET /api/auth/session`
- `GET|PUT /api/users/profile`
- `GET|POST /api/engagement`

### 10.1 응답 상태

- `completed`
- `awaiting_approval`

실패와 fallback은 성공 응답 내부의 상태·badge와 Trace 또는 표준 오류 응답으로
표현한다.

### 10.2 오류

```json
{
  "error": "사용자에게 표시할 안전한 메시지",
  "code": "BAD_REQUEST"
}
```

사용하는 코드는 `BAD_REQUEST`, `NOT_FOUND`, `INTERNAL_ERROR`다. 오류 응답에
stack, 환경 변수 값, raw prompt, DB 오류 원문을 포함하지 않는다.

---

## 11. Frontend 상태 계약

### 11.1 관심 없음

- key 예시: `ott-damoa:not-interested`
- 값: 현재 브라우저 탭에서 관심 없음으로 누른 contentId 문자열 배열
- 저장소: `sessionStorage`
- 백엔드 API 호출: 상태 저장 목적으로 호출하지 않음
- 교체가 필요할 때만 replacement API 호출
- 탭을 닫으면 상태가 사라질 수 있음

구체적인 key 이름은 프론트엔드 담당자가 확정할 수 있으나 backend contract에는
포함하지 않는다.

### 11.2 제거 UI

- 로그인·로그아웃
- 회원가입·온보딩
- 프로필 편집
- 찜
- 봤어요
- MY

### 11.3 유지 UI

- 홈에서 CHOICE로 직접 이동
- CHOICE
- 추천 결과
- 승인·거절
- 관심 없음과 즉시 교체
- 과정 타임라인
- OTT 이동
- Demo Lab

---

## 12. 기술 스택

| 영역 | v0.6 |
|---|---|
| Framework | Next.js App Router 호환 `vinext` + TypeScript + React |
| Style | Tailwind/PostCSS + 현재 global CSS |
| 기본 catalog | reviewed fixture |
| 기본 search | local token/hash vector cosine |
| 기본 selector | deterministic |
| 선택형 selector | OpenAI structured JSON |
| ORM | Prisma |
| DB | Supabase PostgreSQL, Run·Trace 전용 |
| Demo store | memory |
| Cache | 사용하지 않음 |
| 배포 | 현재 vinext·Cloudflare Worker 호환 빌드, 실제 대상은 확인 필요 |

v0.5의 Vercel 배포 결정과 현재 저장소의 vinext·Cloudflare 구조가 다르다.
3일 스프린트에서 배포 대상을 추가 변경하지 말고 촬영에 사용할 환경을 Day 1에
확정한다.

---

## 13. 완료 조건

### 13.1 기능

- 로그인 없이 홈에서 CHOICE와 추천 결과까지 이동한다.
- 이번 요청의 선택 OTT가 필터와 추천 이유에 반영된다.
- 정상 시나리오에서 고유한 작품 최대 5편을 반환한다.
- TOP1과 최대 3개 이유를 반환한다.
- 모든 반환 작품이 응답 직전 정책 검사를 통과한다.
- 30분 후보 부족 시 승인 대기로 멈춘다.
- 승인 시 45분만 적용하고 거절 시 부분 결과를 유지한다.
- 예산 초과 시 deterministic fallback과 고지를 반환한다.
- 교체는 정확히 한 자리만 안전한 새 작품으로 변경한다.
- Trace가 단계 순서대로 결과에 포함된다.
- 관심 없음은 backend DB나 API에 저장되지 않는다.

### 13.2 데이터와 보안

- DB에는 `RecommendationRun`, `AgentTrace`만 존재한다.
- Run·Trace에 사용자 식별정보와 자연어 원문이 없다.
- 전체 Run 목록을 익명 API로 조회할 수 없다.
- runId는 추측하기 어려운 opaque string이다.
- secret과 raw provider 오류가 API·Trace에 노출되지 않는다.

### 13.3 품질 게이트

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

모두 통과해야 한다. 별도 테스트는 정상, 승인, 거절, 정책 차단, 예산 fallback,
교체, Run 접근, Trace 정제, reset을 검증한다.

### 13.4 Demo

- 초기화부터 OTT 이동 전까지 대표 흐름을 1분 안에 실행할 수 있다.
- 촬영 환경에서 같은 입력은 같은 결과를 제공한다.
- 정상·승인·정책 차단·fallback 시나리오를 각각 재현할 수 있다.
- 외부 자격 증명이 실패해도 local/deterministic 경로로 Demo를 계속할 수 있다.

---

## 14. 착수 시 확인 항목

| 항목 | 상태 | 처리 |
|---|---|---|
| OpenAI 생성 모델명 | 확인 필요 | Day 1 확정, 환경 설정으로 격리 |
| Supabase Run·Trace 연결 정보 | 확인 필요 | 개인 `.env.local`, source에 값 금지 |
| Run 보존 기간 | 확인 필요 | 3일 Demo에서는 자동 만료 구현 제외 가능 |
| OTT 검색 URL | 일부 확인 필요 | 직접·검색·홈 상태를 fixture에 명시 |
| 촬영 배포 환경 | 확인 필요 | vinext local 또는 현재 hosting 대상 중 선택 |
| TMDB fixture 확대 | 확인 필요 | 대표 시나리오 후보가 충분하면 숫자보다 검수 우선 |

---

## 부록 A. 현재 코드 전환 원칙

### 유지

- `src/demo/fixtures/catalog.ts`
- `src/domains/catalog/filtering.ts`
- `src/domains/search/*`
- `src/domains/recommendation/*`의 pipeline·score·budget·fallback·policy·trace
- fixture catalog, local search, deterministic selector
- 추천 생성·단건 조회·승인·교체 API
- memory Run·Trace repository

### 수정

- `contracts/catalog.ts`: provider type 소유
- `contracts/search.ts`: `UserContext` 제거, 요청 단위 provider 추가
- `contracts/recommendation.ts`: userId와 owner snapshot 제거
- `contracts/ports.ts`: Auth·Profile·Engagement port 제거
- filtering·request·score·fallback·policy·executor: 사용자 프로필 의존 제거
- orchestrator: 인증 소유권과 engagement 흐름 제거
- composition·adapter config·health: auth/profile/engagement 제거
- Prisma: Run·Trace 전용 최소 schema
- Demo integration tests: 사용자·참여 테스트를 익명 Run 테스트로 교체

### 제거

- auth/session, users/profile, engagement API
- auth adapter
- profile·engagement repository
- user·engagement contracts
- user fixtures
- 로그인·온보딩·MY 페이지와 관련 컴포넌트

### 보류

- pgvector SQL
- Prisma catalog/search/embedding 모델
- agent executor와 tool registry
- 인증·사용자·참여 adapter
- TMDB 자동 배치

---

## 부록 B. 개정 이력

| 버전 | 주요 변경 |
|---|---|
| v0.5 | Supabase·pgvector·OpenAI·인증을 포함한 3일 착수안 |
| v0.6 | 익명 Demo 전환, 사용자·참여 기능 제거, 관심 없음 sessionStorage, DB Run·Trace 전용, 현재 local-first 구현 우선 |

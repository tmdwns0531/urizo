# v0.9.1 작품 비교 MVP

## 목적

익명 사용자가 서로 다른 작품 두 편을 선택하고, 검증된 catalog 사실만으로
공통점·차이점·상황별 선택 가이드를 확인한다. 별도 RAG, embedding, LLM 판단,
회원 이력, 비교 저장은 사용하지 않는다.

## 독립 경계

```text
src/app/compare/**
src/components/content-comparison/**
src/contracts/content-comparison.ts
src/domains/content-comparison/**
src/composition/content-comparison.ts
tests/content-comparison.test.mjs
```

기존 공용 layout, landing, AppShell, ContentCard, catalog contract, catalog filter,
composition index, Prisma schema와 migration은 수정하지 않는다. 비교 UI는 기존
export를 읽어서 사용할 뿐 공용 파일의 작성권을 가져오지 않는다.

## 데이터 흐름

```text
선택된 Demo/LIVE catalog adapter
→ catalog list
→ 기존 익명 필수 안전 필터
→ 18·UNKNOWN·국내 OTT 미제공 제외
→ GET 쿼리로 사용자가 고른 서로 다른 두 content ID
→ 구조화 필드 교집합·차집합·수치 비교
→ 고정 문장 template
→ 공통점·차이점·상황별 추천
```

공개 `/api/search` 또는 비교 전용 API를 추가하지 않는다. Prisma/OpenAI concrete
integration은 기존 request-scoped composition에서 catalog adapter만 읽는다.

## 비교 기준

- 공통점: 작품 유형, 공통 장르·분위기·OTT·제작 국가·관람등급·같은 유형의 상영시간
- 차이점: 작품 유형, 시간, 공개 연도, 등급, 고유 장르·분위기·OTT·국가,
  TMDB 평점과 평가 수
- 상황별 추천: 짧은 시청, 낮은 관람등급, OTT 선택 폭, 기존 추천 품질 지표,
  잔잔한 분위기

평점·평가 수 지표는 기존 추천과 같은 `voteAverage × log1p(voteCount)` 신호를
사용하고 3% 이내 차이는 동률로 표시한다. 영화 총시간과 시리즈 회당시간은
직접 우열을 정하지 않으며 작품의 절대적 우열을 주장하지 않는다.
줄거리 원문은 두 카드에 각각 노출하지만 코드가 숨은 주제나 서사를 추론하지
않는다.

## 안전·개인정보

- `18`, `UNKNOWN`, provider 없는 작품은 비교 후보에서 제외한다.
- 자연어, prompt, token, user ID, profile, review, engagement를 받거나 저장하지
  않는다.
- Run·Trace를 만들거나 변경하지 않는다.
- DB/provider 오류 원문과 비밀값을 화면에 노출하지 않는다.
- 동일 입력은 동일한 결과와 문장을 만든다.

## 결과 화면 진입 통합

완료된 구조화 CHOICE 결과와 자연어 결과에서 비교 진입점을 제공한다.

```text
TOP 1 또는 대안 카드에서 비교하기
→ 최대 두 편 선택
→ 모바일 하단·데스크톱 우측의 작은 비교 트레이
→ 두 작품 비교하기
→ /compare?left=<contentId>&right=<contentId>
```

통합 변경은 `src/components/recommendation-view.tsx`,
`src/components/natural-recommendation/natural-result.tsx`, 새 비교 트레이의
얇은 연결에 한정한다. 자연어 결과는 PR #17 병합 커밋 `e82dc96`을 먼저 받은
뒤 그 위에 순차 통합했다.

landing, 오늘의 한줄, 리뷰 기반 추천, ContentCard, 전역 CSS, 계약, composition,
Prisma schema와 migration은 수정하지 않는다.

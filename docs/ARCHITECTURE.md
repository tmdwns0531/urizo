# OTT 다모아 v0.9 bounded-Agent Demo/LIVE architecture

## Authority

LIVE 범위와 인수 기준은
[`OTT-DAMOA-LIVE-MVP-v0.8.md`](./OTT-DAMOA-LIVE-MVP-v0.8.md), 자격증명
없는 Demo 기준은 [`OTT-DAMOA-MVP-v0.6.md`](./OTT-DAMOA-MVP-v0.6.md), 익명
실행 계약과 팀 기준선은
[`BACKEND-SPRINT-OWNERSHIP-v0.7.md`](./BACKEND-SPRINT-OWNERSHIP-v0.7.md)를
따른다. v0.9 as-is 동작은 active contract/domain/schema/migration 코드가 우선하며,
이 문서는 그 구현 구조와 명시적 supersession을 요약한다.

v0.9의 활성 서비스는 익명 CHOICE 또는 결정론 자연어 해석 → bounded Agent → 추천
Run → 공개 Trace 흐름이다. 로그인, Profile, MY, 찜, 봤어요, 서버 저장 관심 없음은
제품 범위가 아니다.

## Runtime preset

`APP_PROFILE`은 composition root의 실제 preset이다. 기능별 selector를 명시하면
지원되는 혼합 실행도 가능하다.

| Capability | Demo | LIVE |
|---|---|---|
| catalog | fixture | Prisma catalog |
| search | local 64차원 hash/cosine | OpenAI 1536차원 embedding + pgvector |
| selector | deterministic | OpenAI structured selector |
| contextual curator | deterministic questions | OpenAI text + vision interpretation |
| Run store | memory | Prisma |
| Trace store | memory | Prisma |

- Demo는 환경 변수 없이 실행되며 Prisma와 OpenAI 모듈을 초기화하지 않는다.
- LIVE는 선택된 adapter에 필요한 변수만 검증한다.
- `fixture + pgvector`는 DB vector와 catalog의 일관성을 보장할 수 없어 거부한다.
- 선택된 Prisma adapter 실패를 memory로 숨기지 않는다.
- concrete adapter 선택과 동적 import는 `src/composition`에서만 수행한다.

## Dependency direction

```text
app -> domains -> contracts

composition -> contracts + adapters + domain constructors
adapters    -> contracts (+ selected external client)
```

Route와 UI는 HTTP/UI 변환 뒤 익명 서비스만 호출한다. Domain은 Prisma, TMDB,
OpenAI를 직접 import하지 않는다. 공개 `/api/search`는 없으며 후보 검색은 추천
orchestrator의 server-side port 안에서만 호출된다.

위 그림은 목표 방향이다. 현재는 다음 as-is 역방향 의존 예외가 있다.

- `src/domains/recommendation/orchestrator.ts` → `src/adapters/shared/id.ts`
- memory/Prisma recommendation persistence adapters →
  `src/domains/recommendation/trace.ts`
- local/pgvector/OpenAI embedding adapters →
  `src/domains/search/query.ts` 또는 `src/domains/search/semantic.ts`

현행 동작을 설명할 때 이 양방향 예외를 숨기거나 새 예외를 늘리지 않는다. 해소는
공용 ID, Trace sanitization, search-query/vector helper 경계 cleanup으로 별도
review한다.

## Active boundaries

| Boundary | Path |
|---|---|
| CHOICE, transient/sanitized input, vector continuation | `src/contracts/mvp-search.ts` |
| public response, Run lifecycle, budget/fallback, Trace DTO | `src/contracts/mvp-recommendation.ts` |
| catalog/search/selector/Run/Trace ports | `src/contracts/mvp-ports.ts`, `src/contracts/ports.ts` |
| public API descriptors | `src/contracts/mvp-api.ts` |
| transient contextual curator | `src/contracts/curator.ts`, `src/domains/curator/**`, `src/composition/curator.ts` |
| policy-safe execution attempt | `src/domains/recommendation/executors/types.ts` |
| preset, selector, conditional environment validation | `src/config/adapters.ts` |
| concrete assembly | `src/composition/**` |
| static Demo advertising (⚠️ owner unassigned) | `src/contracts/advertising.ts`, `src/domains/advertising/**`, `src/app/api/ads/**`, `src/components/advertising/**` |

과거 `user.ts`, `engagement.ts`, `search.ts`, `recommendation.ts`의 타입이 남아
있더라도 새 구현에서 사용하지 않는다. 삭제·호환 정리는 공용 계약 변경으로
분리한다.

## Contextual curator sequence

우측 하단의 AI 큐레이터 `모아`는 `/choice`의 구조화 폼이나 `/prompt`의 단일 자연어
요청을 복제하지 않는다. 사용자가 원하는 조건을 아직 모르거나, 현재 상황·기분을
대화로 풀거나, 이미지의 색감·분위기에서 단서를 찾고 싶을 때 다음 흐름을 사용한다.

```text
browser-memory conversation + optional transient image
-> strict curator request and image-signature validation
-> deterministic Demo or one bounded LIVE OpenAI text/vision interpretation
-> validated structured curator state + concise transient search query
-> explicit user confirmation
-> existing POST /api/recommendations
-> existing search, ranking, selector, approval, and final policy flow
```

큐레이터는 catalog를 검색하거나 작품 ID·제목을 선택하지 않는다. `/api/curator/turn`은
Run을 생성하지 않는 stateless endpoint이며, 현재 발화와 이전 응답의 allowlisted
구조화 state만 받는다. 원문 대화 이력·이미지·파일명은 서버 state, DB, Run, Trace에
저장하지 않는다. LIVE OpenAI 요청은 `store: false`, strict JSON Schema, 호출 1회,
12초 timeout을 사용하고 실패하면 같은 요청을 결정론 질문 흐름으로 전환한다.
모델 출력은 이전 턴과의 state transition을 다시 검사하며, 현재 발화에 명시적인
수정 단서가 없으면 이미 확정된 연령·provider·runtime·origin·media·필수/제외 조건을
완화할 수 없다. 아이 관람등급은 명시 답변과 일치해야 하며 마지막 턴의 미응답만
결정론 fallback이 `ALL`로 fail-safe한다.

브라우저는 JPG/PNG/WebP 원본 1장을 5MB까지 받은 뒤 최대 1600px JPEG로 재인코딩해
EXIF를 제거하고, 서버에는 2MB 이하 파생 이미지만 보낸다. 서버는 Base64 크기와 실제
파일 시그니처와 표시 해상도를 다시 검사한다. 이미지에서는 색감·분위기·배경·장르
단서만 사용하며 사람의 신원이나 민감한 속성을 추론하지 않는다. 전체 대화 이력은
탭 메모리에만 유지되고, 각 현재 발화와 선택 이미지만 요청 처리 중 일시 전송된다.
새로고침과 새 탭에서는 대화 state가 초기화된다.
파일 선택 외에 클립보드 붙여넣기와 패널 드래그앤드롭을 같은 전처리 경계로 받고,
준비된 첨부는 composer에, 전송 성공 후 이미지는 사용자 대화 bubble에 object URL
썸네일로 표시한다. 이 URL은 reset·추천 이동·unmount에서 즉시 revoke한다.

## Recommendation sequence

```text
strict anonymous request validation
-> deterministic parser structures neutral natural-language conditions
-> at most one ambiguity question before search
-> Agent calls the server-only searchCatalog tool once
-> mandatory catalog eligibility + local/pgvector search + scoring
-> deterministic or OpenAI allowlist selection inside budget
-> response-time mandatory policy recheck
-> policy-owned runtime proposal + user approval + at most one re-search
-> safe rule-based fallback or completion
-> sanitized Run snapshot and ordered Trace append
-> PUBLIC Trace projection
```

제한형 Agent는 질문 1회, `searchCatalog` 호출 1회, 승인 후 재검색 1회의 상한을
가진다. 연령, provider, runtime, origin, 제외, replacement 조건은 Agent나 selector가
결정하거나 임의로 완화하지 않는다. 조건 변경 가능 여부와 후보 부족 기준은
Policy가 소유한다. 고정 CHOICE 프리셋의 허용 변경은 사용자 승인 후
`runtime 30 → 45`다. 자연어의 정확한 45분 미만 제한은 먼저 그대로 적용하고,
후보가 부족할 때만 `<30 → 30` 또는 `30 이상 45 미만 → 45`를 제안한다.
OpenAI selector는 필터와 점수가 끝난 후보 ID allowlist 안에서만 최대 5개를
고른다. 모델 오류·timeout·invalid output·예산 초과는 같은 조건의 rule-based
1위부터 반환하는 fallback으로 바뀌며 raw prompt나 provider 오류는 응답·Run·Trace에
남기지 않는다.

가족 관련 1회 질문은 구성과 아이 관람등급을 함께 확정한다. 현재 Agent proposal은
해결되지 않은 가족 입력에 `성인 가족 / 전체 / 7 / 12 / 15`를 한 번에 제시한다.
구조화 CHOICE의 성인 가족은 정확한 `FAMILY`이므로 다시 묻지 않는다. 응답은 실제
나이가 아닌
`childAgeRatingLimit` 정책 상한으로 sanitized input에 저장되며 catalog 필터와 최종
정책 재검사가 같은 상한을 적용한다. 상한 없이 WITH_CHILDREN 검색을 실행하려는
경로는 fail closed한다.

`searchCatalog`는 composition에서 선택된 저장 카탈로그와 local/pgvector search
adapter만 사용한다. runtime 요청 중 TMDB를 호출하지 않으며, 도구 호출과 Agent
선택은 각각 기존 `vector_search`, `select` PUBLIC Trace action으로 투명하게 표시한다.

최초 LIVE 실행에서 embedding과 selector는 공통 model-call·token·deadline 예산을
소비한다. 가족 답변은 검색 전 상태에서 첫 vector를 만들고, runtime 승인은 저장
vector를 재사용해 selector를 실행한다. 교체는 저장 vector·ranking·policy를
재사용하지만 selector 모델은 재호출하지 않는다.

## Anonymous continuation

자연어 원문은 요청 동안만 transient하다. 가족 질문에 답할 때 원문이 브라우저에
남아 있으면 다시 transient하게 전달하고, canonical reload로 원문이 없으면 저장된
sanitized condition만으로 첫 검색을 계속한다. 검색 adapter는 사용 가능한 자연어와
CHOICE chip을 합쳐 다음 중 하나의 vector snapshot을 만든 뒤 원문을 폐기한다.

- `local-hash-cosine-v1`, 64차원
- `openai-text-embedding-3-small-v1`, 1536차원

Run에는 sanitized input, vector, `sha256:<64 lowercase hex>` fingerprint만 저장한다.
교체는 이 세 값을 그대로 사용한다. 런타임 완화 승인은 승인된 sanitized
runtime과 기존 vector로 서버가 새 fingerprint를 계산한 뒤 continuation을
검증한다. raw text, token, matched term은 재구성하거나 저장하지 않는다.

## Persistence

v0.7 baseline migration은 그대로 유지하고, v0.8 migration에서 catalog/vector 추가와
Run staging nullability·lifecycle CHECK를 비파괴적으로 적용한다. v0.9 multiturn
migration은 FAMILY/RUNTIME 승인 shape으로 CHECK를 교체하며, 후속 atomic-hardening
migration이 이를 명시적 transaction 안에서 원자적으로 재정립하고 JSON predicate를
fail closed한다. 후속 migration은 원본 v0.9 실패 구간을 소급 원자화하지 않는다.
활성 모델은 다음 여섯 개다.

- `RecommendationRun`, `AgentTrace`
- `CatalogContent`, `ProviderAvailability`
- `ContentSearchDocument`, `ContentEmbedding`

Run 생성·갱신의 revision compare-and-set과 해당 Trace batch는 하나의 persistence
unit-of-work에서 커밋된다. Prisma LIVE는 하나의 DB transaction으로 Run 상태·revision,
Run별 원자적 sequence, append-only Trace를 함께 반영하며 일부만 성공하는 상태를
허용하지 않는다. Catalog runtime은 Prisma만 읽으며 TMDB를 요청 중 호출하지 않는다.
`ContentEmbedding.embedding`은 `extensions.vector(1536)`이고 검색 SQL은 eligibility를
통과한 content ID만 parameter로 받는다.

상세 필드와 migration 원칙은 [`ERD-v0.8-live.md`](./ERD-v0.8-live.md)를 따른다.

최초 추천은 sanitized request만 있는 `RUNNING`을 먼저 저장한 뒤 실행한다.
terminal/runtime 승인 상태는 실제 mode·fingerprint·vector·response를 갖추고, 실패는 raw
오류 없이 `FAILED + INTERNAL_ERROR`로 저장한다. 승인 실행은 먼저 RUNNING CAS를
성공한 한 요청만 계속하며, 완료/실패와 Trace를 다시 원자 커밋한다.

`AWAITING_APPROVAL`에는 두 가지 멀티턴 shape이 있다. 검색 전 가족 구성 질문은
`FAMILY_COMPOSITION` proposal과 sanitized condition만 가지며 mode·fingerprint·vector가
아직 없다. 검색 후 후보 부족 제안은 `RUNTIME_RELAXATION` proposal과 실제 검색
continuation을 모두 가진다. 둘 다 같은 revision CAS와 Trace transaction 경계를
사용하고, 자연어 원문은 후속 답변에서도 일시적으로만 전달되어 Run에 저장되지
않는다.

## Catalog ingestion

```text
TMDB fetch (ko-KR / KR)
-> normalized catalog facts and provider availability
-> idempotent Prisma upsert
-> SHA-256 versioned search document
-> embed only pending/changed documents
-> pgvector upsert
```

TMDB key는 ingestion에서만 필요하다. runtime 추천은 TMDB 응답이나 key에
의존하지 않는다. TMDB가 제공하지 않는 mood·companion 사실을 모델로 발명하지
않고, 검증되지 않은 OTT 링크를 `DIRECT`로 표시하지 않는다.

## HTTP, privacy, and errors

공개 HTTP endpoint는 총 9개다. `MVP_API_ENDPOINTS`에는 추천·health/reset core
6개가 있고, `/api/ads`와 `/api/ads/events`는 별도 advertising contract를 사용한다.
`/api/curator/turn`도 별도 curator contract를 사용하며 Run/Trace persistence를
호출하지 않는다.
광고는 fictional static Demo fixture이고 현재 profile gate나 persistence가 없다.
익명 Run 목록은 없다.
공개 오류는 `BAD_REQUEST`, `NOT_FOUND`, `INTERNAL_ERROR`만 사용하고 stack,
DB/provider 원문, secret을 노출하지 않는다.

Run·Trace 저장 금지 항목:

- 사용자 식별정보, 인증, 세션
- 자연어 원문, token, matched term
- raw prompt, raw model/TMDB response
- API key, DB URL, password
- engagement 상태

Demo reset은 Demo profile의 memory Run·Trace에서만 가능하다. LIVE health는
선택된 adapter 구성을 공개하되 자격증명 값은 절대 공개하지 않는다.

## Team integration boundary

향후 역할 분담 문서는 통합, Catalog·DB, Search, Selector, Policy·Trace의 단일
작성자 경계를 유지한다. 기능 branch는 concrete factory를 제공하고 composition을
동시에 수정하지 않는다. 공용 contract와 migration은 작은 선행 commit으로
분리하고 영향받는 담당자 review를 거친다.

인수 전에는 `db:validate`, `lint`, `typecheck`, `test`, `build`를 모두 실행한다.
외부 migration, TMDB/OpenAI smoke, push와 PR은 각각 명시적으로 수행하며 비밀은
`.env.local` 또는 배포 secret store에만 둔다.

# OTT 다모아 v0.8 Demo/LIVE architecture

## Authority

LIVE 범위와 인수 기준은
[`OTT-DAMOA-LIVE-MVP-v0.8.md`](./OTT-DAMOA-LIVE-MVP-v0.8.md), 자격증명
없는 Demo 기준은 [`OTT-DAMOA-MVP-v0.6.md`](./OTT-DAMOA-MVP-v0.6.md), 익명
실행 계약과 팀 기준선은
[`BACKEND-SPRINT-OWNERSHIP-v0.7.md`](./BACKEND-SPRINT-OWNERSHIP-v0.7.md)를
따른다. 이 문서는 구현 구조를 요약하며 위 문서보다 우선하지 않는다.

v0.8의 활성 서비스는 익명 CHOICE → 추천 Run → 공개 Trace 흐름이다. 로그인,
Profile, MY, 찜, 봤어요, 서버 저장 관심 없음은 제품 범위가 아니다.

## Runtime preset

`APP_PROFILE`은 composition root의 실제 preset이다. 기능별 selector를 명시하면
지원되는 혼합 실행도 가능하다.

| Capability | Demo | LIVE |
|---|---|---|
| catalog | fixture | Prisma catalog |
| search | local 64차원 hash/cosine | OpenAI 1536차원 embedding + pgvector |
| selector | deterministic | OpenAI structured selector |
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

## Active boundaries

| Boundary | Path |
|---|---|
| CHOICE, transient/sanitized input, vector continuation | `src/contracts/mvp-search.ts` |
| public response, Run lifecycle, budget/fallback, Trace DTO | `src/contracts/mvp-recommendation.ts` |
| catalog/search/selector/Run/Trace ports | `src/contracts/mvp-ports.ts`, `src/contracts/ports.ts` |
| public API descriptors | `src/contracts/mvp-api.ts` |
| policy-safe execution attempt | `src/domains/recommendation/executors/types.ts` |
| preset, selector, conditional environment validation | `src/config/adapters.ts` |
| concrete assembly | `src/composition/**` |

과거 `user.ts`, `engagement.ts`, `search.ts`, `recommendation.ts`의 타입이 남아
있더라도 새 구현에서 사용하지 않는다. 삭제·호환 정리는 공용 계약 변경으로
분리한다.

## Recommendation sequence

```text
strict anonymous request validation
-> mandatory catalog eligibility
-> local or pgvector candidate search
-> ranking and diversity scoring
-> deterministic or OpenAI selector inside budget
-> response-time mandatory policy recheck
-> approval, safe fallback, or completion
-> sanitized Run snapshot and ordered Trace append
-> PUBLIC Trace projection
```

연령, provider, runtime, origin, 제외, replacement 조건은 selector가 결정하지
않는다. OpenAI selector는 필터와 점수가 끝난 후보 ID allowlist 안에서만 최대
5개를 고른다. 모델 오류·timeout·invalid output·예산 초과는 정제된 fallback
reason으로 바뀌며 raw prompt나 provider 오류는 응답·Run·Trace에 남기지 않는다.

최초 LIVE 실행에서 embedding과 selector는 공통 model-call·token·deadline 예산을
소비한다. 승인은 저장 vector를 재사용하고 selector를 실행하며, 교체는 저장
vector·ranking·policy를 재사용하지만 selector 모델은 재호출하지 않는다.

## Anonymous continuation

자연어 원문은 최초 요청 동안만 존재한다. 검색 adapter는 자연어와 CHOICE chip을
합쳐 다음 중 하나의 vector snapshot을 만든 뒤 원문을 폐기한다.

- `local-hash-cosine-v1`, 64차원
- `openai-text-embedding-3-small-v1`, 1536차원

Run에는 sanitized input, vector, `sha256:<64 lowercase hex>` fingerprint만 저장한다.
교체는 이 세 값을 그대로 사용한다. 30분 → 45분 승인은 승인된 sanitized
runtime과 기존 vector로 서버가 새 fingerprint를 계산한 뒤 continuation을
검증한다. raw text, token, matched term은 재구성하거나 저장하지 않는다.

## Persistence

v0.7 baseline migration은 그대로 유지하고, v0.8 migration에서 catalog/vector 추가와
Run staging nullability·lifecycle CHECK를 비파괴적으로 적용한다.
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
terminal/승인 상태는 실제 mode·fingerprint·vector·response를 갖추고, 실패는 raw
오류 없이 `FAILED + INTERNAL_ERROR`로 저장한다. 승인 실행은 먼저 RUNNING CAS를
성공한 한 요청만 계속하며, 완료/실패와 Trace를 다시 원자 커밋한다.

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

공개 endpoint는 `MVP_API_ENDPOINTS`의 여섯 개뿐이며 익명 Run 목록은 없다.
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
# OTT 다모아 LIVE MVP v0.8

- 상태: v0.6 Demo를 보존하는 LIVE 확장 기준
- 기준일: 2026-07-31
- Demo 제품 기본선: docs/OTT-DAMOA-MVP-v0.6.md
- 익명 실행 계약 기본선: docs/BACKEND-SPRINT-OWNERSHIP-v0.7.md

> **v0.9 supersession note (2026-08-03):** `AWAITING_APPROVAL`의 모든 실행
> 필드가 항상 materialized된다는 아래 규칙은 runtime 승인에는 유지되지만,
> 검색 전 `FAMILY_COMPOSITION` 질문에는 적용되지 않는다. 그 상태의
> `executionMode`, `inputFingerprint`, `queryVector`는 모두 null이고, runtime
> 승인 상태에서는 모두 non-null이다. ordered migration과
> `docs/V09-MIGRATION-ATOMICITY-REVIEW.md`가 배포 review 기준이다.

## 1. 목적과 우선순위

v0.8은 자격 증명 없이 실행되는 v0.6 Demo를 폐기하지 않고 다음 LIVE
capability를 추가한다.

- Supabase PostgreSQL과 Prisma를 사용하는 catalog·Run·Trace
- 요청 처리와 분리된 TMDB catalog ingestion
- OpenAI text-embedding-3-small 1536차원 embedding
- PostgreSQL pgvector 후보 검색
- OpenAI structured final selector

LIVE 범위에서는 이 문서가 v0.6의 catalog DB·pgvector·TMDB 보류 결정보다
우선한다. 익명 사용자, 정책, 예산, 승인, 안전 필터, Trace, 저장 금지 정보와
Demo 무자격증명 실행 규칙은 계속 v0.6·v0.7을 따른다.

단, 승인 continuation의 fingerprint 규칙은 이 문서 5절이 v0.7 2.3절의
“최초 fingerprint를 재계산하지 않는다” 규칙을 의도적으로 대체한다. Demo와
LIVE가 공유하는 익명 orchestrator는 승인된 sanitized input과 기존 vector로
fingerprint만 다시 계산하며 embedding은 다시 만들지 않는다.

또한 v0.8은 v0.7의 Run 상태 전이를 유지하되, 실행 전 `RUNNING` Run을 먼저
저장하기 위해 아직 실제 값이 없는 `executionMode`, `inputFingerprint`,
`queryVector`만 `RUNNING`/`FAILED`에서 nullable로 허용한다. `AWAITING_APPROVAL`과
`COMPLETED`에는 세 필드와 상태에 맞는 response snapshot이 모두 필요하다.
가짜 vector나 fingerprint로 빈자리를 채우지 않는다.

## 2. 프로필과 adapter preset

APP_PROFILE은 실제 composition preset이다.

| Capability | demo | live |
|---|---|---|
| catalog | fixture | Prisma |
| search | local hash/cosine | OpenAI embedding + pgvector |
| selector | deterministic | OpenAI structured selector |
| Run store | memory | Prisma |
| Trace store | memory | Prisma |

각 selector 환경 변수로 혼합 실행을 허용한다. fixture + pgvector 조합은
embedding row의 catalog 일관성을 보장할 수 없으므로 거부한다. 선택된 Prisma
adapter가 실패하면 memory로 몰래 전환하지 않는다. OpenAI selector 실패는
정제된 deterministic fallback으로 전환할 수 있다.

Demo composition은 Prisma나 OpenAI client를 초기화하지 않아야 한다. 모든
concrete integration 선택은 src/composition에서만 수행하며 페이지와 API에
분기를 흩뿌리지 않는다.

## 3. 환경 변수

소스와 문서에는 이름과 안전한 기본값만 둔다.

| 선택 기능 | 필요한 변수 |
|---|---|
| Prisma runtime adapter | DATABASE_URL |
| Prisma migration | DIRECT_URL |
| OpenAI selector | OPENAI_API_KEY, OPENAI_GENERATION_MODEL |
| pgvector search | OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL, OPENAI_EMBEDDING_DIMENSIONS=1536 |
| TMDB ingestion | TMDB_API_KEY |

TMDB 변수는 ingestion 명령에서만 검증한다. Prisma-only runtime은 Supabase
anon key나 service-role key를 요구하지 않는다.

### 3.1 공개 추천 요청 상한

익명 `POST /api/recommendations`는 JSON을 파싱하기 전에 UTF-8 body를 최대
16 KiB로 제한한다. `desiredGenres`와 호환 alias인
`explicitlyRequestedGenres`는 각각 중복 없는 최대 20개이며, NFKC 정규화와
trim 이후 각 항목은 Unicode code point 기준 최대 40자다. enum 배열도
허용 가능한 값 수를 넘으면 항목 순회 전에 거부한다. `naturalLanguage`의 기존
140 code point 상한은 유지한다. 상한 위반은 외부 adapter 호출 전에
`BAD_REQUEST`로 종료한다.

## 4. LIVE catalog

LIVE runtime은 TMDB를 호출하지 않고 Prisma catalog만 읽는다. ingestion은
명시적으로 실행하는 개발·운영 작업이다.

    TMDB fetch
    → KR locale·media type·runtime·age·provider 정규화
    → idempotent Prisma upsert
    → versioned search document hash
    → 변경된 document만 embedding
    → pgvector upsert

- tmdbId + mediaType은 고유하다.
- TMDB 원본 응답 전체를 저장하지 않는다.
- TMDB가 제공하지 않는 mood·companion 사실을 모델이 발명하지 않는다.
- 검증되지 않은 provider URL을 DIRECT로 표시하지 않는다.
- 18과 UNKNOWN은 익명 결과에서 항상 제외한다.
- User, Profile, Subscription, Engagement, 찜, 봤어요, 관심 없음 모델은
  추가하지 않는다.

## 5. 검색 continuation

query vector snapshot은 다음 두 형식을 지원한다.

- local-hash-cosine-v1, 64차원
- openai-text-embedding-3-small-v1, 1536차원

모든 vector 값은 finite number여야 한다. 최초 요청만 자연어와 CHOICE chip을
조합해 vector를 만들고, 승인·교체는 Run에 저장된 vector를 재사용한다.
승인으로 runtime이 바뀌면 서버가 승인된 sanitized input과 기존 vector로 새
fingerprint를 계산한다. 자연어 원문, token, matched term은
Run·Trace·prompt log에 저장하지 않는다.

pgvector 검색은 catalog eligibility를 통과한 content ID allowlist 내부에서만
parameterized SQL로 실행한다. 후보 밖 ID, 잘못된 차원, non-finite 값은
거부한다. 공개 /api/search는 만들지 않는다.

## 6. OpenAI selector

selector에는 필수 필터를 통과하고 점수 계산이 끝난 후보의 최소 사실만
전달한다.

- 출력은 structured JSON이다.
- 선택 ID는 후보 allowlist 내부의 고유 ID여야 한다.
- 최대 5개만 허용한다.
- TOP1 생성 이유는 180자 이내이며 실제 후보 사실에 근거하고, 최종 reasons는 최대 3개다.
- selector는 연령, provider, runtime, origin, 제외, 승인, 교체 정책을 결정할
  수 없다.
- timeout, raw 오류, invalid JSON, unknown·duplicate ID, 예산 초과는
  allowlist fallback reason으로 정제한다.
- raw prompt와 provider 오류를 DB·Trace·API에 기록하지 않는다.

## 7. 영속성과 보안

v0.7의 RecommendationRun, AgentTrace 계약을 유지하면서 LIVE catalog 모델을
추가한다. 상세 구조는 docs/ERD-v0.8-live.md가 정의한다.

Run·Trace 저장 금지 항목:

- 사용자 식별정보·인증·세션
- 자연어 원문·token·matched term
- raw prompt·모델 응답 원문
- secret·API key·DB URL
- engagement·찜·봤어요·관심 없음

Run 생성·갱신의 revision compare-and-set과 해당 요청의 Trace batch 삽입은
하나의 persistence unit-of-work에서 커밋된다. Prisma LIVE는 하나의 DB transaction으로
Run 상태·revision, Run별 원자적 sequence, append-only Trace를 함께 반영하며,
한 쪽이 실패하면 모두 rollback한다.

최초 요청은 외부 catalog/search/model 실행 전에 sanitized request만 담은
`RUNNING` revision 0으로 시작한다. 성공은 같은 unit-of-work로 `COMPLETED` 또는
`AWAITING_APPROVAL`과 Trace를 커밋하고, 실패는 raw 오류 없이 `FAILED + INTERNAL_ERROR`로
종료한다. 승인은 `AWAITING_APPROVAL → RUNNING → COMPLETED|FAILED`, 거절은
`AWAITING_APPROVAL → COMPLETED`, 교체는 `COMPLETED → COMPLETED` CAS를 따른다.

## 8. 정책과 fallback

LIVE adapter도 다음 경계 안에서만 실행된다.

    익명 요청 검증
    → catalog 필수 eligibility
    → candidate search
    → hybrid ranking
    → budget 안의 selector
    → 응답 직전 동일 정책 재검사
    → 승인·fallback·완료
    → 정제 Run·Trace

fallback은 연령, provider, runtime, origin, 제외, replacement 조건을 완화하지
않는다. DB/catalog 장애는 안전한 표준 오류로 종료한다. selector 장애만
deterministic fallback으로 전환한다.

최초 pgvector 검색의 embedding과 OpenAI selector는 하나의 `BudgetCounter`에서 model call,
token, deadline을 함께 소비하며 deadline 종료 시 진행 중인 외부 요청도 abort한다.
승인은 저장 vector를 재사용하고 configured selector를 실행한다. 교체는 저장 vector와
ranking을 재사용하되 selector를 다시 호출하지 않는 `ranked` 모드를 사용한다.

## 9. 팀 병렬 개발 경계

향후 역할 분담 문서는 다음 단일 작성자 경계를 보존해야 한다.

| 영역 | 파일 경계 |
|---|---|
| 통합 | config, composition, health, release docs |
| Catalog·DB | Prisma schema/migration, Prisma repositories, TMDB ingestion |
| Search | search contract, embedding client, pgvector adapter |
| Selector | OpenAI selector, budget, executor, fallback |
| Policy·Trace | orchestrator, approval, replacement, Trace projection |

공유 contract와 migration은 별도 작은 commit과 영향받는 담당자 review를
필요로 한다. concrete adapter factory를 제공하고 composition 파일을 각
기능 branch에서 동시에 수정하지 않는다.

## 10. 완료 조건

- 무환경 Demo가 fixture/local/deterministic/memory로 계속 실행된다.
- LIVE preset이 Prisma/pgvector/OpenAI/Prisma를 실제 선택한다.
- 조건부 환경 검증이 선택되지 않은 adapter의 값을 요구하지 않는다.
- migration으로 catalog/provider/document/vector/Run/Trace가 준비된다.
- ingestion이 idempotent하고 runtime 추천 중 TMDB를 호출하지 않는다.
- embedding이 정확히 1536차원이며 continuation에서 재사용된다.
- OpenAI selector 출력은 후보 allowlist와 예산 안에서 검증된다.
- 모든 최종 결과가 응답 직전 익명 정책을 통과한다.
- 자연어·prompt·secret canary가 DB·Trace·API에 없다.
- db:validate, lint, typecheck, test, build가 모두 통과한다.

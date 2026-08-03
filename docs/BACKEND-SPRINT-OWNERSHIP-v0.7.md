# OTT 다모아 v0.7 5인 수직 슬라이스 역할 분담

- 문서 버전: v0.7
- 작성일: 2026-07-31
- 제품 범위 단일 기준: `docs/OTT-DAMOA-MVP-v0.6.md`
- 인원·일정: 5명 · 개발 3일 · 4일 차 시연 영상 촬영
- 방식: 백엔드 도메인 오너십 + 담당 화면 프론트엔드 연동 + 담당 E2E
- 통합 오너: 담당 1

> **v0.9 supersession note (2026-08-03):** 이 문서의 two-model schema,
> CHOICE-only 입력, 30→45 runtime 승인, 파일/branch 할당은 역사적 스프린트
> 기준선이다. 현재 자연어/bounded Agent, family pre-search clarification,
> six-model LIVE schema, 광고 surface의 review 경계는
> `docs/TEAM-OWNERSHIP.md`를 따른다. 광고는 아직 오너 미지정이다.

이 문서는 제품 기획을 v0.7로 변경하는 문서가 아니다. 제품의 MVP 기능 범위와
완료 조건은 계속 `OTT-DAMOA-MVP-v0.6.md`를 따른다. v0.7은 기존 백엔드 전용
역할 분담을 실제 사용자 흐름 단위의 수직 역할 분담으로 보완한 실행 문서다.

현재 파일 표기:

- **기존**: 현재 저장소에서 확인된 파일
- **신규 제안**: 현재 없으며 충돌 분리를 위해 스프린트에서 생성할 파일
- **확인 필요**: 자격 증명·배포 환경처럼 저장소만으로 확정할 수 없는 항목

---

## 0. 문서 적용 원칙

적용 우선순위는 다음과 같다.

```text
OTT-DAMOA-MVP-v0.6.md
→ BACKEND-SPRINT-OWNERSHIP-v0.7.md
→ ARCHITECTURE.md·TEAM-OWNERSHIP.md
→ BACKEND-SPRINT-OWNERSHIP-v0.6.md
→ v0.5 기획서
```

v0.6 기획서와 구 문서가 충돌하면 다음 원칙으로 해석한다.

1. 로그인·회원가입·계정·프로필·인증 세션은 사용하지 않는다.
2. 찜·봤어요·MY·engagement 백엔드는 사용하지 않는다.
3. 관심 없음은 프론트엔드 `sessionStorage`에서만 저장한다.
4. 백엔드 DB의 활성 모델은 `RecommendationRun`, `AgentTrace` 두 개뿐이다.
5. fixture catalog, local search, deterministic selector, memory store가 기본
   Demo 경로다.
6. OpenAI selector와 Prisma Run·Trace store는 선택형 adapter다.
7. v0.6 부록에서 auth adapter가 제거와 보류에 중복 기재된 부분은 본문 0절,
   2절, 13절을 우선해 **MVP 활성 경로와 선택 설정에서 제거**로 확정한다.
8. 물리 파일 삭제는 import 의존성을 먼저 제거한 뒤 각 파일의 지정 오너가
   수행한다.
9. 담당자는 백엔드 함수만 넘기지 않고 자신이 소유한 화면 연동과 E2E까지
   완료해야 한다.
10. 통합 오너는 다른 담당자의 비즈니스 로직을 대신 구현하거나 테스트 실패를
    임의로 무시할 수 없다.

각 feature branch의 독립 typecheck를 위해 Day 1 baseline은 신규 v0.7 타입을
추가하고 기존 사용자·engagement 타입과 port는 `deprecated` 상태로 잠시
유지한다. 신·구 interface를 declaration merge하거나 같은 이름으로 덮어쓰지
않는다. 신규 코드는 아래의 충돌 없는 이름만 사용한다.

| 기존 deprecated 이름 | v0.7 활성 이름 |
|---|---|
| `SearchAdapter` | `RecommendationSearchAdapter` |
| `SelectorAdapter` | `RecommendationSelectorAdapter` |
| `RunRepository` | `RecommendationRunRepository` |
| `TraceRepository` | `AgentTraceRepository` |
| `RecommendationExecutor` | `MvpRecommendationExecutor` |
| `RecommendationServices` | `AnonymousRecommendationServices` |
| `AdapterConfig`, `AdapterSet`, `Composition` | `MvpAdapterConfig`, `MvpAdapterSet`, `MvpComposition` |
| `RecommendationChoice`, `RecommendationRequest` | `MvpRecommendationChoice`, `MvpRecommendationRequest` |
| `DemoScenario` | `MvpDemoScenario` |
| `ApprovalProposal`, `ApprovalDecision` | `MvpApprovalProposal`, `MvpApprovalDecision` |
| `CompletedRecommendationResponse`, `AwaitingApprovalRecommendationResponse`, `RecommendationResponse` | `MvpCompletedRecommendationResponse`, `MvpAwaitingApprovalRecommendationResponse`, `MvpRecommendationResponse` |
| `TraceAction`, `PublicTraceEvent` | `MvpTraceAction`, `MvpPublicTraceEvent` |

위 이름은 module-local export의 정확한 이름이다. 개념 설명에서 접두어를
생략하더라도 신규 코드의 import는 위 활성 이름을 사용한다. 공용
`RecommendationItem`, `ScoreBreakdown`, catalog 타입은 사용자 식별 정보를
포함하지 않으므로 기존 module의 공유 활성 타입으로 유지한다. `Companion`과
`OriginPreference`의 활성 source는 `mvp-search.ts`이며 구 `search.ts`는
전환기 호환 re-export만 제공한다.

각 담당자 PR은 자신의 runtime 의존성을 제거하지만, 다른 미병합 branch가
import하는 공용 legacy 파일을 먼저 물리 삭제하지 않는다. 모든 기능 branch를
병합한 뒤 3일 차 cleanup slot에서 지정 오너가 legacy 타입·port·파일을
삭제한다. 신규 코드는 deprecated 계약을 사용할 수 없다. v0.7 활성 이름은
cleanup 뒤에도 유지하므로 마지막 날의 대규모 rename은 없다.

---

## 1. 역할 요약

| 담당 | 수직 도메인 | 백엔드 종단 책임 | 프론트엔드 연동 책임 | E2E·완료 판정 |
|---|---|---|---|---|
| **1 — 통합 오너** | Anonymous Platform·Run·Release | 익명 HTTP 경계, runId, Run mapping, health/reset, composition | 공통 shell에서 로그인·프로필·MY 제거 | 익명 진입→생성→단건 조회, reset, 전체 release gate |
| **2** | Catalog·Eligibility·OTT·DB Gate | fixture, 필수 사전 필터, provider/link type, 최소 Prisma schema | provider badge, 콘텐츠 카드, engagement 없는 OTT 이동·관심 없음 trigger | 안전 후보·OTT 링크·Run/Trace-only schema |
| **3** | CHOICE·Query·Local Search | CHOICE 검증·정규화, query, local vector search, 연속 실행 context | 홈에서 CHOICE 직접 진입, CHOICE 화면 전체와 요청 단위 OTT 선택 | 폼 입력→검색 후보, 동일 입력 결정성·vector 재현 |
| **4** | Ranking·Selector·Fallback·Result | hybrid score, diversity, TOP5, selector, budget counter, fallback | 완료 결과·TOP1·이유·match·fallback 고지 | 후보→최종 결과와 fallback 표시 |
| **5** | Policy·Approval·Replacement·Trace·Interaction | 최종 정책, 상태 전이, 승인·교체, Trace 저장·공개 projection | 결과 container, 승인·거절, 관심 없음 sessionStorage, 타임라인 | 승인·정책 차단·교체·Trace·관심 없음 비저장 |

### 1.1 사용자 흐름과 오너 연결

```text
홈·CHOICE 직접 진입                                담당 3
  → 익명 공통 shell                                담당 1
  → CHOICE UI·요청 정규화                          담당 3
    → POST/GET API·runId·Run 저장                  담당 1
      → Policy·workflow                            담당 5
        → Catalog·필수 필터                        담당 2
        → Query·local candidate search             담당 3
        → Ranking·selector·fallback                담당 4
        → 응답 직전 최종 정책·Trace                담당 5
      → 완료 결과 표시                             담당 4
      → 승인·관심 없음·교체·타임라인               담당 5
      → OTT 버튼·provider 이동                     담당 2
  → composition·통합 suite·release 판정            담당 1
```

### 1.2 통합 오너의 권한과 제한

담당 1은 다음만 단독 책임진다.

- Day 1 공동 계약 회의 진행 및 baseline 커밋 준비
- 통합 브랜치와 병합 순서 관리
- `src/composition/*`, `src/config/adapters.ts` 최종 배선
- 공용 HTTP 오류 변환과 health/reset route
- `tests/demo-flows.test.mjs`의 최소 수직 smoke
- 전체 품질 명령 실행, 실패 분류, release candidate 판정
- 4일 차 촬영용 실행 명령과 reset 순서 확정

담당 1이 하지 않는 일:

- 다른 담당자의 도메인 로직 수정
- 다른 담당자의 UI 구현
- 실패한 도메인 테스트를 삭제하거나 기대값 완화
- 안전 필터·예산·승인 규칙의 임의 변경
- 코드 리뷰 없이 공통 계약 변경

통합 실패는 해당 도메인 오너가 직접 수정한다. 담당 1은 재현 정보와 실패
경계를 제공하고 재병합 여부만 관리한다.

---

## 2. Day 1 공동 API·타입·DB 계약

개발 시작 후 첫 90~120분 동안 아래 계약을 확정해
`contract/v0.7-baseline`으로 고정한다. 실제 Git metadata와 `dev` branch는
작업 시작 시 **확인 필요**다.

### 2.1 API와 화면 소비 계약

| Method | Path | 성공 응답 | 주요 실패 | 백엔드 오너 | 프론트 소비·E2E 오너 |
|---|---|---|---|---|---|
| POST | `/api/recommendations` | 201 `MvpRecommendationResponse` | 검증 400 | 담당 1 | CHOICE 호출 담당 3, smoke 담당 1 |
| GET | `/api/recommendations/{runId}` | 200 `MvpRecommendationResponse` | 없음 404, 저장된 실패 Run 500 | 담당 1 | 결과 조회 담당 5 |
| POST | `/api/recommendations/{runId}/approval` | 200 갱신 응답 | 상태·중복 400, 없음 404 | 담당 5 | 승인 UI·E2E 담당 5 |
| POST | `/api/recommendations/{runId}/replacement` | 200 완료 응답 | 상태·ID·후보 400, 없음 404 | 담당 5 | trigger 담당 2, 호출·E2E 담당 5 |
| GET | `/api/health` | 200 allowlist 상태 | 안전한 500 | 담당 1 | release smoke 담당 1 |
| POST | `/api/demo/reset` | 허용 환경에서 200 `{ ok: true }` | 비허용 환경 404 | route 담당 1, service clear 담당 1·5 | smoke 담당 1 |

외부에서 제거할 API와 오너:

| 제거 API | 오너 |
|---|---|
| `GET /api/recommendations` 목록 동작 | 담당 1 |
| `/api/auth/session` | 담당 1 |
| `/api/users/profile` | 담당 1 |
| `/api/engagement` | 담당 5 |

표준 오류:

```ts
type PublicErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

interface ErrorResponse {
  error: string;
  code: PublicErrorCode;
}
```

stack, 환경 변수, DB URL, raw prompt, raw provider 오류는 API와 Trace에
포함하지 않는다.

### 2.2 CHOICE 요청 계약

현재 배열 구조를 최대한 활용하되 기획서의 단일 선택 조건을 검증으로
강제한다.

```ts
type Mood =
  | "밝은"
  | "따뜻한"
  | "감성적인"
  | "어두운"
  | "긴장감 있는"
  | "잔잔한"
  | "생각할 거리가 있는"
  | "자극적인";

type ChoiceRuntimeMinutes = 30 | 60 | 120 | 180 | null;
type EffectiveRuntimeMinutes = ChoiceRuntimeMinutes | 45;

interface MvpRecommendationChoice {
  selectedProviders?: OttProvider[];
  companions?: Companion[];
  moods?: Mood[];
  desiredGenres?: string[];
  companionAvoidGenres?: string[];
  maxRuntimeMinutes?: ChoiceRuntimeMinutes;
  originPreference?: "KR" | "NON_KR" | "ANY";
  naturalLanguage?: string;
  explicitlyRequestedGenres?: string[]; // v0.6 호환 alias
}

interface MvpRecommendationRequest {
  choice?: MvpRecommendationChoice;
}

type MvpDemoScenario =
  | "normal"
  | "approval"
  | "policy_block"
  | "budget_fallback";

interface MvpDemoRecommendationRequest extends MvpRecommendationRequest {
  scenario?: MvpDemoScenario;
}
```

검증·정규화 규칙:

- `userId`와 정의되지 않은 필드는 400으로 거부한다.
- `companions`는 생략 또는 0~1개만 허용한다. 생략 또는 `[]`이면 `[ANY]`,
  1개면 해당 값으로 정규화하고 2개 이상이면 400이다.
- `ANY`는 다른 companion과 함께 올 수 없다.
- `companionAvoidGenres`는 최대 1개이고 `PARTNER`, `FRIENDS`일 때만 허용한다.
- `moods`는 위 8개 값의 고유 배열이며 생략 시 `[]`다.
- 공개 POST runtime은 `30`, `60`, `120`, `180`, `null`만 허용한다.
- `45`는 승인 후 service 내부에서만 `effectiveRuntime`으로 만든다.
- provider 생략 또는 빈 배열은 지원하는 국내 OTT 전체로 정규화한다.
- `naturalLanguage`는 Unicode code point 기준 최대 140자이며 요청 처리 중에만
  메모리에 둔다.
- 자연어에서 연령·runtime·provider·장르 필터를 추론하지 않는다.
- `explicitlyRequestedGenres`가 제공되면 `desiredGenres`와 같은 집합이어야
  한다. 정규화 후에는 `desiredGenres` 하나만 필터와 점수에 사용한다.
- v0.6 표준 UI에는 긍정 장르 선택 항목이 확인되지 않으므로 담당 3은 새로운
  장르 UI를 추가하지 않는다. 표준 UI는 두 필드를 빈 배열로 보낸다.
- 공개 API는 v0.6 요청 예시와 안전 정책을 위해 유효한 비어 있지 않은
  `desiredGenres`도 지원한다. `explicitlyRequestedGenres`는 그와 같은 집합일
  때만 상대 제외 장르 해제 근거가 된다. 이 계약은 live에서도 동일하다.
- `scenario`는 Demo Lab·자동 테스트에서만 허용하고 live profile에서는
  무시하지 않고 400으로 거부한다.
- `scenario`, 자연어 원문, token, `matchedTerms`는 저장 snapshot에 넣지 않는다.

### 2.3 Search 연속 실행 계약

담당 3은 vector를 생성하고 담당 1은 이를 정제된 Run에 저장한다. 담당 3이
직접 DB를 쓰지 않는다는 뜻이지 vector를 Run에 저장하지 않는다는 뜻이 아니다.

```ts
interface QueryVectorSnapshot {
  algorithm: "local-hash-cosine-v1";
  version: 1;
  dimensions: 64;
  values: number[];
}

interface RecommendationSearchContinuation {
  queryVector: QueryVectorSnapshot;
  inputFingerprint: string;
}

interface RecommendationSearchOutput {
  results: RecommendationSearchResult[];
  continuation: RecommendationSearchContinuation;
}

interface RecommendationSearchResult {
  content: CatalogContent;
  semanticScore: number;
}

interface TransientRecommendationSearchInput
  extends SanitizedRecommendationSearchInput {
  naturalLanguage: string;
}

interface SanitizedRecommendationSearchInput {
  selectedProviders: OttProvider[];
  companions: Companion[];
  moods: Mood[];
  desiredGenres: string[];
  companionAvoidGenres: string[];
  maxRuntimeMinutes: EffectiveRuntimeMinutes;
  originPreference: "KR" | "NON_KR" | "ANY";
  hasNaturalLanguage: boolean;
}

type RecommendationSearchInvocation =
  | {
      kind: "initial";
      input: TransientRecommendationSearchInput;
    }
  | {
      kind: "continuation";
      input: SanitizedRecommendationSearchInput;
      continuation: RecommendationSearchContinuation;
    };

interface RecommendationSearchAdapter {
  search(
    invocation: RecommendationSearchInvocation,
    candidates: CatalogContent[],
  ): Promise<RecommendationSearchOutput>;
}
```

불변 조건:

- 최초 query는 자연어와 CHOICE chip 문장을 함께 조합한다.
- vector는 현재 local token/hash 방식을 활용한 64차원 finite number 배열이다.
- 재실행 `semanticScore`는 저장 vector와 content vector만으로 재현 가능해야
  한다.
- 현재 코드의 token overlap 요소는 vector만으로 재현할 수 없으므로 담당 3이
  vector 기반 cosine으로 통일한다.
- `matchedTerms`는 최초 실행의 휘발성 진단값으로만 허용하며 공통
  `RecommendationSearchResult`, Run, Trace에는 전달하지 않는다.
- 승인·교체는 저장된 vector와 정제된 CHOICE를 사용한다.
- 동일 fixture와 vector는 동일 점수와 정렬을 제공한다.
- fingerprint는 다음 식으로 고정한다.

```text
inputFingerprint =
"sha256:" +
SHA-256(canonicalJson({
  normalizedInitialChoiceWithoutNaturalLanguage,
  queryVector
}))
```

- canonical JSON은 key를 정렬하고 의미상 순서가 없는 배열도 정렬하며 UTF-8과
  lowercase hex를 사용한다.
- v0.7 baseline에서는 승인으로 effective runtime이 45분이 되어도 최초
  fingerprint를 재계산하지 않는다.
- v0.8 익명 runtime은 continuation 무결성을 위해 이 한 규칙을 의도적으로
  대체한다. Demo와 LIVE 모두 승인된 sanitized input과 기존 vector로 새
  fingerprint를 계산하고, vector embedding 자체는 재생성하지 않는다. 자세한
  권한 문구는 `OTT-DAMOA-LIVE-MVP-v0.8.md` 1절과 5절을 따른다.

### 2.4 공개 응답·내부 실행 상태 계약

공개 응답 상태:

```ts
type PublicRecommendationStatus =
  | "completed"
  | "awaiting_approval";
```

내부 Run 상태:

```ts
type RunLifecycleStatus =
  | "RUNNING"
  | "AWAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED";
```

매핑:

| 내부 상태 | 공개 표현 |
|---|---|
| `AWAITING_APPROVAL` | `awaiting_approval` |
| `COMPLETED` | `completed` |
| `RUNNING` | 공개 응답으로 직렬화하지 않음 |
| `FAILED` | 안전한 표준 오류 |

`FALLBACK`, `PARTIAL`은 lifecycle status로 사용하지 않는다.

- fallback: `COMPLETED + fallbackUsed: true`
- 승인 거절 부분 결과: `COMPLETED + 5편 미만 + notice`
- 교체: `COMPLETED` 유지 + Run revision 증가

합법적인 내부 전이:

```text
RUNNING
  → COMPLETED
  → AWAITING_APPROVAL
  → FAILED

AWAITING_APPROVAL
  → RUNNING (approve)
  → COMPLETED (reject, 기존 부분 결과 보존)

COMPLETED
  → COMPLETED (replacement, revision + 1)
```

완료 응답 최소 계약:

```ts
interface MvpCompletedRecommendationResponse {
  status: "completed";
  runId: string;
  recommendations: RecommendationItem[];
  topPick: RecommendationItem | null;
  fallbackUsed: boolean;
  policyBlockedCount: number;
  notice?: string;
  trace: PublicTraceEvent[];
  createdAt: string;
  updatedAt: string;
}
```

승인 대기 응답 최소 계약:

```ts
interface MvpAwaitingApprovalRecommendationResponse {
  status: "awaiting_approval";
  runId: string;
  proposal: ApprovalProposal;
  partialRecommendations: RecommendationItem[];
  fallbackUsed: false;
  policyBlockedCount: number;
  trace: PublicTraceEvent[];
  createdAt: string;
  updatedAt: string;
}

type MvpRecommendationResponse =
  | MvpCompletedRecommendationResponse
  | MvpAwaitingApprovalRecommendationResponse;

type MvpApprovalDecision = "approve" | "reject";
```

### 2.5 Budget·fallback 인계 계약

역할 경계:

- 담당 4: `BudgetCounter` 타입·계측, executor, deterministic fallback 생성
- 담당 5: Policy에서 counter를 주입하고 초과를 감시하며 fallback 전환 결정
- 담당 1: 최종 snapshot을 Run mapping에 저장

```ts
interface BudgetSnapshot {
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  elapsedMs: number;
}

const BUDGET_LIMITS = {
  modelCalls: 3,
  toolCalls: 2,
  tokens: 8_000,
  elapsedMs: 25_000,
} as const;

type ExecutionMode = "DETERMINISTIC" | "OPENAI" | "FALLBACK";

type FallbackReason =
  | "BUDGET_EXCEEDED"
  | "MODEL_ERROR"
  | "MODEL_TIMEOUT"
  | "MODEL_INVALID_OUTPUT";

interface MvpRecommendationExecutionResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
  continuation: RecommendationSearchContinuation;
  executionMode: ExecutionMode;
  fallbackUsed: boolean;
  fallbackReason: FallbackReason | null;
  budgetSnapshot: BudgetSnapshot;
  durationMs: number;
  notice?: string;
}

interface SelectorOutput {
  selectedIds: string[];
  topPickReason?: string;
  tokenUsage: number;
}

interface RuleBasedFallbackInput {
  eligibleCatalog: CatalogContent[];
  searchInput: SanitizedRecommendationSearchInput;
  continuation: RecommendationSearchContinuation;
  excludedContentIds: string[];
}

interface RecommendationSelectorAdapter {
  select(
    items: RecommendationItem[],
    limit: number,
  ): Promise<SelectorOutput>;
}

type ExecutionAttempt =
  | {
      kind: "success";
      result: MvpRecommendationExecutionResult;
    }
  | {
      kind: "fallback_required";
      reason: FallbackReason;
      budgetSnapshot: BudgetSnapshot;
      durationMs: number;
      fallbackInput: RuleBasedFallbackInput;
    };

interface RuleBasedFallbackResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
}

interface MvpRecommendationExecutionContext {
  runId: string;
  searchInvocation: RecommendationSearchInvocation;
  budget: BudgetCounter;
}

interface MvpRecommendationExecutor {
  execute(
    context: MvpRecommendationExecutionContext,
  ): Promise<ExecutionAttempt>;
}
```

규칙:

- 기본 deterministic 결과는 fallback이 아니다.
- OpenAI 성공 시에만 mode가 `OPENAI`다.
- 예산·모델 오류 전환 결과는 `FALLBACK`이고 `fallbackUsed: true`다.
- fallback reason과 snapshot은 담당 5의 Trace와 담당 1의 Run까지 전달한다.
- success와 fallback 모두 같은 `RecommendationSearchContinuation`을 최종
  execution result에 포함한다. 담당 1은 여기서 queryVector·fingerprint를
  Run에 저장하고 담당 5는 승인·교체 때 이를 재사용한다.
- raw 모델 오류는 result·Trace·DB에 넣지 않는다.
- 승인·교체 재실행은 새 counter를 사용하되 Run 저장값은 누적한다.
- adapter 코드와 fake-client 계약 테스트는 MVP 필수다.
- 실제 OpenAI key smoke는 자격 증명이 제공될 때만 실행한다.
- deterministic selector도 같은 async 계약의 Promise를 반환한다.
- executor는 selector가 반환한 ID가 후보 allowlist 안에 있고 중복되지 않는지
  검증한 뒤 RecommendationItem으로 변환한다.
- executor는 raw SDK 예외 대신 정제된 `ExecutionAttempt`를 Policy에 반환한다.
- executor는 필터·local vector/search를 먼저 완료해 fallback input을 만든
  다음 selector를 실행한다. 따라서 selector 오류·timeout·예산 초과
  `fallback_required`에는 정제 input·continuation·eligible catalog가 있다.
- executor context에는 `UserContext`와 Trace writer를 넣지 않는다. 익명 정책과
  Trace 기록은 담당 5의 외부 Policy 경계에서 수행한다.
- `ruleBasedFallback(fallbackInput)`은 같은 필수 필터를 이미 통과한
  `RuleBasedFallbackInput`으로 `RuleBasedFallbackResult`를 반환하고 기존
  `excludedContentIds`를 보존한다.

### 2.6 Trace 저장·공개 projection 계약

저장 레코드와 공개 응답 타입을 분리한다.

```ts
type MvpTraceAction =
  | "filter"
  | "vector_search"
  | "score"
  | "select"
  | "policy_block"
  | "approval_request"
  | "approval_decision"
  | "fallback"
  | "replacement"
  | "complete";

type TraceMetricKey =
  | "candidateCount"
  | "eligibleCount"
  | "resultCount"
  | "blockedCount"
  | "modelCalls"
  | "toolCalls"
  | "tokens"
  | "durationMs"
  | "effectiveRuntimeMinutes";

type TraceMetrics = Partial<Record<TraceMetricKey, number>>;

interface SanitizedTraceDetail {
  title: string;
  description: string;
  metrics?: TraceMetrics;
}

interface NewTraceEventBase {
  action: MvpTraceAction;
  detail: SanitizedTraceDetail;
  durationMs: number | null;
}

type NewTraceEvent =
  | (NewTraceEventBase & {
      visibility: "PUBLIC";
      publicMessage: string;
    })
  | (NewTraceEventBase & {
      visibility: "INTERNAL";
      publicMessage: string | null;
    });

type StoredTraceEvent = NewTraceEvent & {
  id: string;
  runId: string;
  sequence: number;
  createdAt: string;
};

interface AgentTraceRepository {
  append(runId: string, event: NewTraceEvent): Promise<StoredTraceEvent>;
  listStored(runId: string): Promise<StoredTraceEvent[]>;
}

interface MvpPublicTraceEvent {
  id: string;
  runId: string;
  step: number;
  action: MvpTraceAction;
  title: string;
  description: string;
  createdAt: string;
  metrics?: TraceMetrics;
}
```

규칙:

- caller는 ID, runId, sequence, createdAt을 만들지 않는다.
- repository가 Run별 sequence를 원자적으로 할당한다.
- `[runId, sequence]`는 unique다.
- 저장 detail 자체가 allowlist 기반으로 정제되어야 한다.
- `PUBLIC` event는 `publicMessage`가 필수다.
- API projection은 `PUBLIC`만 사용하며 `step = sequence`,
  `description = publicMessage`로 변환한다.
- metrics key는 위 `TraceMetricKey`만 허용하고 값은 finite non-negative
  number만 허용한다.
- 저장 레코드를 API가 직접 반환하지 않는다.
- Demo reset 외에는 Trace를 수정·삭제하지 않는다.
- memory `AgentTraceRepository`는 별도 `DemoResettable.clearForDemo`를
  구현하고 Prisma `AgentTraceRepository`는 이를 구현하지 않는다.

### 2.7 Run 저장 계약

일시적인 요청 객체와 영속화 객체를 분리한다.

```ts
type StoredResponseSnapshot =
  | Omit<MvpCompletedRecommendationResponse, "trace">
  | Omit<MvpAwaitingApprovalRecommendationResponse, "trace">;

interface StoredRecommendationRun {
  id: string;
  status: RunLifecycleStatus;
  revision: number;
  executionMode: ExecutionMode;
  inputFingerprint: string;
  requestSnapshot: SanitizedRecommendationSearchInput;
  queryVector: QueryVectorSnapshot;
  responseSnapshot: StoredResponseSnapshot | null;
  excludedContentIds: string[];
  replacedContentIds: string[];
  candidateCount: number;
  resultCount: number;
  modelCallCount: number;
  toolCallCount: number;
  totalTokens: number;
  durationMs: number;
  policyBlockCount: number;
  fallbackReason: FallbackReason | null;
  errorCode: PublicErrorCode | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type StoredRecommendationRunPatch =
  Partial<Omit<StoredRecommendationRun, "id" | "revision" | "createdAt">>;

type RunUpdateResult =
  | {
      ok: true;
      run: StoredRecommendationRun;
    }
  | {
      ok: false;
      reason: "NOT_FOUND" | "REVISION_CONFLICT";
    };

interface RecommendationRunRepository {
  create(run: StoredRecommendationRun): Promise<void>;
  get(runId: string): Promise<StoredRecommendationRun | null>;
  update(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
  ): Promise<RunUpdateResult>;
}

interface DemoResettable {
  clearForDemo(): Promise<void>;
}
```

- memory와 Prisma 모두 같은 `StoredRecommendationRun` 정제 타입을 저장한다.
- 저장 타입에는 사용자 정보와 자연어 원문이 존재하지 않는다.
- `responseSnapshot`에는 Trace를 제외하고, 조회 시 담당 5의 공개 Trace를
  결합한다.
- 승인·교체는 repository revision compare-and-set으로 중복 갱신을 막는다.
- 전체 목록 method를 제공하지 않는다.
- 일반 repository에서 전역 `clear`를 제거한다.
- reset은 memory `RecommendationRunRepository`와 memory
  `AgentTraceRepository`가 각각 구현하는 `DemoResettable.clearForDemo`
  capability만 사용한다.

### 2.8 DB 최소 계약

활성 Prisma enum:

| enum | 값 |
|---|---|
| `RecommendationRunStatus` | `RUNNING`, `AWAITING_APPROVAL`, `COMPLETED`, `FAILED` |
| `RecommendationExecutionMode` | `DETERMINISTIC`, `OPENAI`, `FALLBACK` |
| `TraceVisibility` | `INTERNAL`, `PUBLIC` |
| `TraceAction` | 2.6의 `TraceAction`과 동일 |

활성 Prisma 모델:

| 모델 | 정확한 필드 계약 |
|---|---|
| `RecommendationRun` | `id String @db.VarChar(64)`, `status RecommendationRunStatus`, `revision Int`, `executionMode RecommendationExecutionMode`, `inputFingerprint String @db.VarChar(71)`, `requestSnapshot Json`, `queryVector Json`, `responseSnapshot Json?`, `excludedContentIds String[]`, `replacedContentIds String[]`, `candidateCount Int`, `resultCount Int`, `modelCallCount Int`, `toolCallCount Int`, `totalTokens Int`, `durationMs Int`, `policyBlockCount Int`, `fallbackReason String? @db.VarChar(32)`, `errorCode String? @db.VarChar(32)`, `startedAt DateTime`, `completedAt DateTime?`, `createdAt DateTime`, `updatedAt DateTime` |
| `AgentTrace` | `id String @db.VarChar(64)`, `runId String @db.VarChar(64)`, `sequence Int`, `action TraceAction`, `visibility TraceVisibility`, `detail Json`, `publicMessage String?`, `durationMs Int?`, `createdAt DateTime` |

DB 규칙:

- Run ID는 application이 발급한 `run_<UUID>`이고 `VarChar`다.
- Trace ID는 `trace_<UUID>`이고 `VarChar`다.
- Trace FK도 `VarChar`다.
- Run에는 사용자 relation이 없다.
- 활성 schema에는 User, Profile, Subscription, Catalog, Provider, Embedding,
  RecommendationItem, Approval, Engagement 모델을 두지 않는다.
- 기존 `RecommendationRunStatus`의 `PARTIAL`, `FALLBACK`, `CANCELLED`와
  기존 `RecommendationExecutionMode`의 `AGENT`, 다단계 Approval 값은
  제거한다.
- 작품·추천 item·승인은 Run의 정제 snapshot과 revision으로 표현한다.
- Prisma mapper는 `fallbackReason`을 `FallbackReason`, `errorCode`를
  `PublicErrorCode` allowlist로만 읽고 쓴다. raw 예외명·메시지는 거부한다.
- Run·Trace 보존 기간 자동화는 이번 3일 MVP 범위에서 제외한다.

### 2.9 reset·health 계약

reset 활성 조건:

```text
runStore=memory
AND traceStore=memory
AND (appProfile=demo OR test 환경)
```

- 조건을 만족하지 않으면 repository를 호출하지 않고 404를 반환한다.
- 익명 Prisma 전체 삭제 route는 제공하지 않는다.
- reset service는 Run과 Trace만 초기화한다.

health 공개 allowlist:

- 전체 상태: `ok | degraded`
- mode: `demo | live`
- fullyDemo: boolean
- catalog: fixture
- search: local
- selector: deterministic 또는 openai
- runStore: memory 또는 prisma
- traceStore: memory 또는 prisma
- adapter별 상태: `ok | unavailable | not_checked`

auth·profile·engagement 상태, 환경 변수 이름·값, DB URL, raw adapter 오류는
반환하지 않는다.

`fullyDemo` 계산:

```text
catalog=fixture
AND search=local
AND selector=deterministic
AND runStore=memory
AND traceStore=memory
```

### 2.10 익명 service·composition 계약

```ts
interface AnonymousRecommendationServices {
  recommend(
    request?: MvpRecommendationRequest | MvpDemoRecommendationRequest,
  ): Promise<MvpRecommendationResponse>;
  getRun(runId: string): Promise<MvpRecommendationResponse | null>;
  decideApproval(
    runId: string,
    decision: MvpApprovalDecision,
  ): Promise<MvpRecommendationResponse>;
  replace(
    runId: string,
    contentId: string,
  ): Promise<MvpCompletedRecommendationResponse>;
  resetForDemo(): Promise<void>;
}

interface MvpAdapterConfig {
  appProfile: "demo" | "live";
  catalog: "fixture";
  search: "local";
  selector: "deterministic" | "openai";
  runStore: "memory" | "prisma";
  traceStore: "memory" | "prisma";
}

interface MvpAdapterSet {
  catalog: CatalogRepository;
  search: RecommendationSearchAdapter;
  selector: RecommendationSelectorAdapter;
  runs: RecommendationRunRepository;
  traces: AgentTraceRepository;
}

interface MvpComposition {
  adapters: MvpAdapterSet;
  services: AnonymousRecommendationServices;
}
```

- `listRuns`, `profile`, `engagement`, auth/profile/engagement adapter 선택지는 없다.
- Prisma catalog와 pgvector search 선택지도 없다.
- 기본값은 fixture/local/deterministic/memory/memory다.
- 선택된 OpenAI selector만 OpenAI 환경 변수를, 선택된 Prisma store만 DB 환경
  변수를 검증한다.
- reset은 `MvpAdapterSet`의 일반 port가 아니라 memory 구현이 추가로 제공하는
  `DemoResettable` capability를 허용 조건 확인 뒤 호출한다.

---

## 3. 담당 1 — Anonymous Platform·Run·Release

**통합 오너**

| 항목 | 내용 |
|---|---|
| 담당 도메인 | Anonymous HTTP Platform, Run Lifecycle & Release Integration |
| 역할과 책임 | 익명 HTTP 요청부터 opaque runId 발급, 정제 Run mapping·단건 조회, no-env composition, 최종 release 판정까지 책임진다. |
| 백엔드 세부 기능 | POST·단건 GET route, 목록 GET 제거, body·path 오류 변환, `run_<UUID>`, memory/Prisma `RecommendationRunRepository`, revision update, health allowlist, reset guard, auth/profile API 제거 |
| 프론트 연동 책임 | AppShell profile fetch·MY 링크·profile chip 제거, 익명 공통 navigation·문구와 layout metadata 정리 |
| 통합 오너 책임 | baseline·통합 branch, composition/config 단독 배선, merge queue, smoke suite, 전체 품질 gate, 촬영 실행 순서 |
| 수정할 기존 파일 | `src/app/layout.tsx`, `src/components/app-shell.tsx`, `src/app/api/recommendations/route.ts`, `src/app/api/recommendations/[runId]/route.ts`, `src/app/api/_shared/http.ts`, `src/app/api/health/route.ts`, `src/app/api/demo/reset/route.ts`, `src/adapters/shared/id.ts`, `src/adapters/memory/memory-run-repository.ts`, `src/composition/*`, `src/config/adapters.ts`, `tests/demo-flows.test.mjs`, `.env.example`, `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/TEAM-OWNERSHIP.md` |
| 제거할 기존 파일 | `src/app/api/auth/session/route.ts`, `src/app/api/users/profile/route.ts`, `src/adapters/auth/demo-auth-adapter.ts`, `src/adapters/memory/memory-profile-repository.ts`, `src/demo/fixtures/users.ts` |
| 생성할 파일 | **신규 제안** `tests/anonymous-platform-run.test.mjs`; Prisma Run repository 기술 구현은 담당 2가 제공 |
| 제공 API·함수 | 추천 POST·단건 GET, health GET, reset POST, `create/get/update` `RecommendationRunRepository`, `createComposition` |
| 입력 | HTTP `RecommendationRequest`, opaque runId, 담당 5의 workflow 결과, 담당 3의 continuation |
| 출력 | 201/200 공개 응답, 안전한 400/404/500, 정제 `StoredRecommendationRun`, release 결과 |
| 담당 DB | `RecommendationRun` business mapping과 memory repository. Prisma repository는 담당 2 구현을 계약 검토한다. |
| 의존 관계 | 담당 2의 schema/client·Prisma repository, 담당 3의 request validator·continuation, 담당 5의 `AnonymousRecommendationServices`·Trace projection |
| Git 브랜치 예시 | `feature/v07-anonymous-platform-release` |

### 3.1 일자별 계획

| 일자 | 작업 |
|---|---|
| 1일 차 | 공동 계약 baseline, 익명 route·runId·memory Run, AppShell 익명화, 제거 API import 해소. baseline 직후 30분 동안 AGENTS·Ownership pointer와 실행 문서를 v0.6·v0.7로 정합화 |
| 2일 차 | 정제 Run mapping과 담당 2 Prisma repository 계약 검증, composition/config·health/reset 연결, 오후 no-env happy-path 통합 |
| 3일 차 | 정해진 순서로 병합, README·Architecture·환경 변수 문서 최종 반영, 제외 route 검사, 전체 gate·2회 리허설, release candidate 동결 |

### 3.2 완료 조건

- 로그인·쿠키·사용자 ID 없이 홈→CHOICE→POST→GET이 성공한다.
- 홈과 shell에 로그인·MY·프로필 링크와 fetch가 없다.
- runId는 `run_<UUID>`이고 DB 타입과 일치한다.
- 전체 Run 목록을 조회할 수 없다.
- memory·Prisma가 동일한 정제 Run 계약을 통과한다.
- 자연어 canary가 두 저장 구현 모두에 없다.
- health·reset이 2.9 계약을 지킨다.
- composition 기본 경로가 외부 자격 증명을 요구하지 않는다.
- 통합 실패가 0개이고 네 가지 품질 명령이 모두 통과한다.
- 대표 Demo를 1분 이내로 2회 연속 재현한다.

### 3.3 테스트

- 빈 body·잘못된 JSON·정의되지 않은 필드·140자 초과
- POST 201, 단건 GET 200, 없는 runId 404
- `GET /api/recommendations` 목록 동작 부재
- auth/session·users/profile route 부재
- runId 유일성과 추측 불가능성
- memory·Prisma create/get/revision update 계약
- 동시 revision 충돌
- memory·Prisma 자연어·사용자 canary 비저장
- health safe allowlist
- memory Demo reset 성공, live·Prisma reset 404
- 선택되지 않은 외부 adapter의 설정·장애가 no-env 경로에 영향 없는지 검사
- 선택된 OpenAI 실패 시 deterministic fallback
- 선택된 Prisma store 실패 시 memory로 자동 전환하지 않고 안전한 500
- 홈→CHOICE→결과 1분 smoke

---

## 4. 담당 2 — Catalog·Eligibility·OTT·DB Gate

| 항목 | 내용 |
|---|---|
| 담당 도메인 | Catalog, Anonymous Eligibility, OTT Resolution & Prisma Gate |
| 역할과 책임 | fixture 작품 정보부터 검색 전 안전 후보와 검증 수준에 맞는 OTT 이동까지 책임지고, Run·Trace-only schema의 migration gate를 맡는다. |
| 백엔드 세부 기능 | `OttProvider` 소유권 이동, `DIRECT/SEARCH/HOME`, fixture 조회·검증, 익명 연령 안전선, WITH_CHILDREN, 국내 OTT, 선택 OTT, runtime, origin, 상대 제외 장르 필터, 최소 Prisma schema/client |
| 프론트 연동 책임 | ProviderBadge 타입 이동, ContentCard provider 표시, engagement fetch 제거, link type에 맞는 버튼 문구·URL, 관심 없음 callback trigger 제공 |
| 수정할 기존 파일 | `src/contracts/catalog.ts`, `src/domains/catalog/filtering.ts`, `src/adapters/catalog/fixture-catalog-repository.ts`, `src/demo/fixtures/catalog.ts`, `src/components/provider-badge.tsx`, `src/components/content-card.tsx`, `src/components/poster-art.tsx`는 변경 필요 여부 확인, `prisma/schema.prisma`, `prisma/README.md` |
| 제거할 기존 파일 | `src/contracts/user.ts`는 provider 이동과 전체 import 해소 후 제거, 기존 Prisma의 Run·Trace 이외 모델·enum |
| 생성할 파일 | **신규 제안** `src/adapters/prisma/prisma-client.ts`, `src/adapters/prisma/prisma-run-repository.ts`, 최소 migration, `tests/catalog-ott-schema.test.mjs`, fixture/link validator |
| 제공 API·함수 | 공개 HTTP 없음, CatalogRepository, `getFilterReasons`, `filterCatalog`, OTT link label resolver, lazy Prisma client, Prisma `RecommendationRunRepository` 기술 구현 |
| 입력 | fixture `CatalogContent[]`, 담당 3의 정규화 SearchInput |
| 출력 | `{ eligible, excluded }`, link type·안전 URL을 가진 CatalogContent, 동결 schema/client |
| 담당 DB | 두 모델의 schema·migration 기술 gate와 Prisma Run repository. 정제 Run business mapping은 담당 1, Trace mapping은 담당 5 |
| 의존 관계 | 담당 3 SearchInput 소비, 담당 4 Pipeline·결과 child에 데이터 제공, 담당 5 final filter에 같은 함수 제공 |
| Git 브랜치 예시 | `feature/v07-catalog-ott-schema` |

### 4.1 ContentCard 계약

`src/components/content-card.tsx`는 담당 2만 수정한다.

- backend engagement·OTT click API를 호출하지 않는다.
- provider link type에 따라 `바로 보기` 또는 `OTT에서 찾기`를 표시한다.
- `DIRECT`가 아니면 바로 보기라고 표시하지 않는다.
- 관심 없음 버튼은 callback만 호출한다.
- sessionStorage와 replacement API 호출은 담당 5 container가 수행한다.
- 담당 5는 ContentCard 파일을 수정하지 않고 동결된 callback을 소비한다.

### 4.2 일자별 계획

| 일자 | 작업 |
|---|---|
| 1일 차 | provider/catalog 계약, 필수 filter, link type, 담당 2가 작성하는 최소 Prisma schema baseline |
| 2일 차 | 29편 fixture·태그·링크 QA, ContentCard·ProviderBadge 연동, schema/client·Prisma Run repository·domain test |
| 3일 차 | 검색·ranking·final policy 통합 데이터 검증, migration 회귀, 촬영 fixture 동결 |

### 4.3 완료 조건

- 모든 fixture ID·tmdbId가 고유하다.
- 검색·필터·화면에 필요한 필드가 누락되지 않는다.
- `18`, `UNKNOWN`이 익명 후보에 없다.
- WITH_CHILDREN에는 `ALL`, `7`, `12`만 남는다.
- 선택 provider·runtime·origin·상대 제외 장르를 위반한 작품이 없다.
- 표준 UI에서 명시하지 않은 긍정 장르로 제외 조건을 풀지 않는다.
- link type·URL·버튼 문구가 일치한다.
- OTT 클릭이 engagement API를 호출하지 않는다.
- 활성 schema와 fresh migration에는 Run·Trace 두 모델만 있다.
- 대표 시나리오 후보 수 보고서를 담당 3·4·5에게 제공한다.

### 4.4 테스트

- 기본 익명 연령선과 WITH_CHILDREN
- provider 선택 없음·단일·복수
- provider 없음·빈 URL·검증 안 된 URL
- 30·45·60·120·180분 effective 경계
- KR 공동 제작과 NON_KR
- 상대 제외 장르와 동일한 desired genre
- fixture ID·tmdbId 중복·필수 필드
- DIRECT·SEARCH·HOME 버튼과 URL
- ContentCard OTT 클릭 시 backend fetch 없음
- 관심 없음 callback이 정확한 contentId 한 개 전달
- Prisma generate·validate와 fresh migration table 검사

---

## 5. 담당 3 — CHOICE·Query·Local Search

| 항목 | 내용 |
|---|---|
| 담당 도메인 | Anonymous CHOICE, Query Construction & Local Candidate Search |
| 역할과 책임 | 로그인 없는 CHOICE 화면부터 요청 검증·중립 정규화, 자연어+chip query, 저장 vector로 재현되는 최대 30개 후보까지 책임진다. |
| 백엔드 세부 기능 | request parser/validator, 중립 기본값, SearchInput 익명화, query 조합, 한글 token/hash vector, cosine, continuation·fingerprint, 안정 정렬 |
| 프론트 연동 책임 | 홈 `/login` 진입을 `/choice`로 변경, CHOICE 6개 OTT 복수 선택, companion 1개, mood 8종 복수, runtime·origin, 조건부 상대 제외 장르 1개, 자연어 140자, 중립 초기값, Demo Lab |
| 수정할 기존 파일 | `src/app/page.tsx`, `src/app/choice/page.tsx`, `src/components/choice-form.tsx`, `src/contracts/search.ts`, `src/domains/recommendation/request.ts`, `src/domains/search/query.ts`, `src/domains/search/semantic.ts`, `src/adapters/search/local-search-adapter.ts`, `src/app/globals.css` |
| 제거할 기존 파일 | `src/app/login/page.tsx`, `src/app/onboarding/page.tsx`, `src/components/onboarding-form.tsx` |
| 생성할 파일 | **신규 제안** `tests/choice-search-continuation.test.mjs` |
| 제공 API·함수 | 공개 HTTP 없음, request 검증 함수, `resolveRecommendationRequest`, `toSearchInput`, `buildSearchQuery`, vector 생성·복원, `RecommendationSearchAdapter.search` |
| 입력 | 프론트 CHOICE 상태, 담당 2의 eligible catalog, 초기 자연어 또는 저장 continuation |
| 출력 | 검증된 RecommendationRequest, 정규화 search input, `RecommendationSearchOutput` 최대 30개 |
| 담당 DB | 없음. continuation을 담당 1에게 전달하며 직접 영속화하지 않는다. |
| 의존 관계 | 담당 2 provider/catalog 타입, 담당 4 `RecommendationSearchResult` 소비, 담당 5 승인·교체 재실행, 담당 1 HTTP validator 연결 |
| Git 브랜치 예시 | `feature/v07-choice-local-search` |

### 5.1 프론트 중립값

현재 UI의 `ALONE`, 특정 mood, 120분 기본 선택을 다음과 같이 변경한다.

- provider: 빈 선택 UI → backend에서 전체 지원 OTT로 정규화
- companion: `ANY`
- moods: `[]`
- runtime: `null`
- origin: `ANY`
- 상대 제외 장르: `[]`
- naturalLanguage: `""`

요약 문구에서 `프로필 기준`, `구독 OTT 안에서`를 제거한다. 선택값이 없으면
`상관없음`, `모든 지원 OTT`, `선택 안 함` 같은 익명 중립 문구를 사용한다.

### 5.2 globals.css 단일 작성 규칙

현재 `src/app/globals.css`가 모든 화면 스타일을 포함하므로 담당 3을 단일
작성자로 둔다.

- 담당 1·2·4·5는 필요한 selector·상태·접근성 변경 목록과 markup commit을
  담당 3에게 전달한다.
- 담당 3은 정해진 Day 2 merge slot에 style patch만 적용한다.
- 스타일 적용 후 각 화면의 기능 오너가 직접 브라우저 회귀를 승인한다.
- 담당 3이 다른 담당자의 JSX나 도메인 동작을 대신 수정하지 않는다.
- CSS module 전환은 현재 구조에서 확인되지 않았고 3일 범위에서 진행하지 않는다.

### 5.3 일자별 계획

| 일자 | 작업 |
|---|---|
| 1일 차 | 요청 cardinality·enum 검증, SearchInput 익명화, 홈 CHOICE 직접 진입, 중립 UI·provider 상태, vector continuation 골격 |
| 2일 차 | 자연어+chip query, pure vector 재현 검색, 폼 POST 연동, 도메인 테스트와 CSS merge slot |
| 3일 차 | 담당 2 eligible·담당 4 ranking 연결, 승인·교체 continuation, 결정성·privacy 회귀 |

### 5.4 완료 조건

- 홈에서 로그인 화면 없이 CHOICE로 이동한다.
- 모든 CHOICE 항목이 v0.6 수량·선택 규칙과 일치한다.
- provider 선택이 POST body에 포함된다.
- 미선택 값은 중립값으로 전송·정규화된다.
- 자연어와 chip 조건이 함께 query에 들어간다.
- 자연어에서 필수 필터를 추론하지 않는다.
- 후보 수는 최대 30개다.
- 같은 입력·fixture가 같은 score와 순서를 제공한다.
- 저장 vector만으로 승인·교체 score와 순서를 재현한다.
- raw 자연어·token·matchedTerms가 continuation·Run·Trace에 없다.

### 5.5 테스트

- companion 0·1개 성공, 2개·ANY 혼합 400
- mood 8종·빈 배열·잘못된 값·중복
- 상대 제외 장르 0·1개와 잘못된 companion 조건
- runtime 공개 값과 공개 45 요청 400
- provider 없음·빈 배열·복수·중복
- 자연어 0·140·141자와 Unicode
- chip만·자연어만·chip+자연어
- 같은 query의 initial·직렬화 continuation score·순서 동일
- vector 차원·finite value·version 검증
- 최대 30개와 한글 제목 tie-break
- 자연어 canary 비전달
- CHOICE 모바일·키보드·오류 메시지 접근성

---

## 6. 담당 4 — Ranking·Selector·Fallback·Result

| 항목 | 내용 |
|---|---|
| 담당 도메인 | Hybrid Ranking, Selection, Budget Mechanics, Fallback & Result Presentation |
| 역할과 책임 | 후보의 계산 가능한 점수부터 다양성을 반영한 TOP5, 선택 adapter, 안전한 fallback과 완료 결과 표시까지 책임진다. |
| 백엔드 세부 기능 | score 0~1, 조건부 genre weight, Match Percent, quality 정규화, diversity penalty, 중복 제거, deterministic/OpenAI selector, BudgetCounter, executor, fallback 생성 |
| 프론트 연동 책임 | 완료 결과 child, TOP1·후보 4개, 이유 최대 3개, match, fallback badge·고지, 부분·빈 결과 표시 |
| 수정할 기존 파일 | `src/config/recommendation.ts`, `src/domains/recommendation/scoring.ts`, `src/domains/recommendation/budget.ts`, `src/domains/recommendation/fallback.ts`, `src/domains/recommendation/executors/types.ts`, `src/domains/recommendation/executors/pipeline-recommendation-executor.ts`, `src/adapters/recommendation/deterministic-selector-adapter.ts`, `tests/budget.test.mjs` |
| 수정하지 않을 공유 파일 | `src/components/recommendation-view.tsx`는 담당 5, `src/components/content-card.tsx`는 담당 2 |
| 생성할 파일 | **신규 제안** `src/adapters/recommendation/openai-selector-adapter.ts`, `src/components/recommendation-results.tsx`, `tests/ranking-selector-result.test.mjs`, `tests/pipeline-fallback.test.mjs` |
| 제공 API·함수 | 공개 HTTP 없음, score 함수, `RecommendationSelectorAdapter`, `MvpRecommendationExecutor`, BudgetCounter, ruleBasedFallback, 완료 결과 child |
| 입력 | 담당 2 Catalog/Filter, 담당 3 `RecommendationSearchOutput`, 담당 5가 주입한 budget context |
| 출력 | 2.5 `ExecutionAttempt`, `RuleBasedFallbackResult`, 고유 최대 TOP5, 완료 결과 markup |
| 담당 DB | 없음. 모델 응답·점수 목록을 별도 DB에 저장하지 않는다. |
| 의존 관계 | 담당 2 콘텐츠·ContentCard, 담당 3 후보, 담당 5 Policy·result container |
| Git 브랜치 예시 | `feature/v07-ranking-fallback-result` |

### 6.1 결과 컴포넌트 분리

`src/components/recommendation-results.tsx`는 현재 없으며 파일 충돌 방지를 위한
**신규 제안**이다.

- 담당 4가 완료 결과 표시만 구현한다.
- API 호출, sessionStorage, 승인, 교체 상태 전이는 넣지 않는다.
- 담당 2의 ContentCard와 담당 5가 제공하는 callback을 사용한다.
- 담당 5는 현재 RecommendationView container에서 기존 완료 결과 JSX를 제거하고
  이 child를 import한다.
- 담당 4는 RecommendationView 파일을 동시에 수정하지 않는다.

### 6.2 일자별 계획

| 일자 | 작업 |
|---|---|
| 1일 차 | 익명 score·reason·`MvpRecommendationExecutionResult`·BudgetCounter 계약, 완료 결과 child API 골격 |
| 2일 차 | score/diversity/deterministic·OpenAI fake adapter, fallback, 결과 표시와 테스트 |
| 3일 차 | Catalog/Search/Policy container 통합, 모델 오류·예산·부분 결과 회귀 |

### 6.3 완료 조건

- 모든 component score가 0~1이고 Match Percent가 0~100 정수다.
- desiredGenres가 비면 genre weight를 제외하고 재정규화한다.
- profile genre를 기본값으로 만들지 않는다.
- collection 반복 감점은 설정값 0.12를 사용한다.
- TOP5 contentId가 고유하고 같은 입력은 같은 순서다.
- TOP1 이유는 최대 3개이며 계산에 사용한 실제 데이터만 포함한다.
- 선택 provider가 적용된 경우 실제 provider 이유만 표시한다.
- OpenAI가 후보 밖·중복 ID를 반환할 수 없다.
- invalid JSON·unknown ID·timeout·예산 초과가 안전한 fallback으로 전환된다.
- fallback에도 동일한 필수 필터가 적용되고 badge·고지가 화면에 표시된다.
- 0~5편 결과가 깨지지 않고 표시된다.

### 6.4 테스트

- 자연어 있음·없음 가중치
- desiredGenres 없음·있음
- 품질 min-max와 품질 동률
- runtime score 경계
- collection 반복 감점
- score·Match clamp
- 후보 0·1·3·5·30개와 deterministic tie-break
- TOP1 이유 개수·근거·provider
- OpenAI 정상 fake·invalid JSON·unknown·duplicate·timeout
- 모델·도구·token·elapsed budget
- success·fallback_required 양쪽의 continuation·excluded ID 인계
- fallback reason·snapshot·notice
- fallback·부분·빈·정상 결과 표시
- 같은 입력 정상·fallback 결정성

---

## 7. 담당 5 — Policy·Approval·Replacement·Trace·Interaction

| 항목 | 내용 |
|---|---|
| 담당 도메인 | Recommendation Control Plane, Approval, Replacement, Trace & Result Interaction |
| 역할과 책임 | Pipeline 바깥에서 실행을 감시하고 응답 직전 정책을 재검사하며 승인·교체·Trace와 결과 상호작용을 책임진다. |
| 백엔드 세부 기능 | 익명 orchestrator, final policy, 30→45 승인·거절, Run revision, 안전한 한 자리 교체, Trace 저장·projection, memory/Prisma `AgentTraceRepository`, engagement 흐름 제거 |
| 프론트 연동 책임 | 결과 조회 container, 승인·거절, 관심 없음 sessionStorage, replacement 호출·상태, 접힌 공개 타임라인, 정책 차단 고지 |
| 수정할 기존 파일 | `src/domains/recommendation/orchestrator.ts`, `src/domains/recommendation/policy.ts`, `src/domains/recommendation/trace.ts`, `src/app/api/recommendations/[runId]/approval/route.ts`, `src/app/api/recommendations/[runId]/replacement/route.ts`, `src/adapters/memory/memory-trace-repository.ts`, `src/demo/scenarios/index.ts`, `src/app/recommendations/[runId]/page.tsx`, `src/components/recommendation-view.tsx` |
| 제거할 기존 파일 | `src/app/api/engagement/route.ts`, `src/contracts/engagement.ts`, `src/adapters/memory/memory-engagement-repository.ts`, `src/components/engagement-actions.tsx`, `src/app/my/page.tsx`, `src/components/my-view.tsx` |
| 생성할 파일 | **신규 제안** `src/adapters/prisma/prisma-trace-repository.ts`, `src/components/recommendation-timeline.tsx`, `tests/policy-approval-trace.test.mjs`, `tests/replacement-interest.test.mjs` |
| 제공 API·함수 | approval·replacement POST, `AnonymousRecommendationServices`, PolicyLayer, Trace writer/repository/projection |
| 입력 | 익명 request/runId/decision/contentId, 담당 4 `ExecutionAttempt`, 담당 1 `RecommendationRunRepository` |
| 출력 | 최종 조립된 `MvpRecommendationExecutionResult`, 완료·승인 대기 응답, 정제 PublicTraceEvent[], 정확히 한 자리 교체 |
| 담당 DB | `AgentTrace` mapping/repository. Run 변경은 담당 1 repository 계약 사용 |
| 의존 관계 | 담당 1 Run/API/reset, 담당 2 final filter·ContentCard, 담당 3 continuation, 담당 4 Executor·result child |
| Git 브랜치 예시 | `feature/v07-policy-trace-interaction` |

### 7.1 관심 없음 계약

- key는 `ott-damoa:not-interested`로 Day 1에 고정한다.
- 값은 현재 탭에서 누른 contentId의 중복 없는 문자열 배열이다.
- 저장소는 `sessionStorage`다.
- 사용자가 누르면 contentId를 sessionStorage에 먼저 반영한다.
- 상태 저장을 위한 backend API는 호출하지 않는다.
- 교체가 필요할 때만 기존 replacement API를 호출한다.
- 교체 실패 시 ID는 sessionStorage에 유지하고 안전한 오류와 재시도 동작을
  표시한다.
- 탭 종료 시 상태가 사라질 수 있다.
- backend Run에는 교체 이력만 남고 관심 없음 상태는 남지 않는다.

### 7.2 Policy·fallback 경계

- 담당 5 Policy가 BudgetCounter를 생성해 담당 4 Executor에 전달한다.
- 초과 또는 adapter 실패를 감지하면 추가 외부 호출을 중단한다.
- 담당 4의 deterministic fallback 생성 함수를 호출한다.
- `fallbackInput`의 continuation·정제 input·제외 ID를 유지한 채 담당 5가
  fallback 결과를 최종 `MvpRecommendationExecutionResult`로 조립한다.
- fallback reason·snapshot을 정제 Trace로 기록한다.
- 최종 결과에 `fallbackUsed`, `notice`를 반영하고 담당 1 Run mapping에 전달한다.
- 응답 직전 담당 2의 같은 필터를 다시 적용한다.
- 위반 작품을 제거할 수 있지만 조건을 풀어 5편을 채울 수 없다.

### 7.3 일자별 계획

| 일자 | 작업 |
|---|---|
| 1일 차 | Auth/Profile/Engagement/owner 검사 제거, 상태 전이, Trace 저장·projection 계약, 결과 container 골격 |
| 2일 차 | final policy, 승인·거절, 교체, sessionStorage 관심 없음, timeline, Trace repository·테스트 |
| 3일 차 | 담당 1 Run·담당 3 continuation·담당 4 engine/result child 통합, privacy·동시성 회귀 |

### 7.4 완료 조건

- AuthAdapter·ProfileRepository·EngagementRepository 없이 workflow가 실행된다.
- 모든 응답 작품이 응답 직전 필수 필터를 통과한다.
- 30분 후보가 5편 미만이면 조건 변경 전에 승인 대기로 멈춘다.
- 승인 시 effective runtime만 45분으로 바꾸고 한 번 재실행한다.
- 거절 시 기존 부분 결과 ID와 순서를 유지한다.
- 완료 Run 중복 승인을 거부한다.
- 관심 없음 ID는 sessionStorage에만 저장된다.
- 교체는 완료 결과의 정확히 한 위치만 바꾼다.
- 현재·과거 노출 작품을 교체 후보로 재사용하지 않는다.
- Trace sequence가 원자적·고유하고 append-only다.
- 공개 응답에는 PUBLIC Trace만 순서대로 포함된다.
- 자연어·prompt·secret·raw 오류가 저장·공개 Trace에 없다.
- engagement·찜·봤어요 이벤트와 API가 없다.

### 7.5 테스트

- 정상 완료와 최종 정책 재검사
- 30분 후보 부족 승인 대기
- 승인 45분 1회 재실행
- 거절 부분 결과 ID·순서 보존
- 완료 Run 중복 승인·없는 Run
- 완료 전·추천 밖 contentId 교체
- 정확히 한 자리 교체·교체 후보 없음
- 현재·과거 노출 작품 제외
- sessionStorage 즉시 저장·중복 방지·탭 범위
- 관심 없음 저장용 backend 호출 없음
- replacement 성공·실패·동시 클릭 lock
- 정책 차단 부분 응답
- fallback reason·snapshot Trace
- fallbackInput으로 최종 result를 조립한 뒤 vector·fingerprint 동일성
- 동시 Trace append sequence unique
- INTERNAL Trace 비노출과 공개 projection
- 자연어·secret canary 비저장·비노출

---

## 8. 공유 파일·충돌 방지 계약

### 8.1 단일 작성자

| 파일·영역 | 단일 작성자 | 다른 담당자의 참여 방식 |
|---|---|---|
| `src/contracts/catalog.ts` | 담당 2 | 소비자는 Day 1 review |
| `src/contracts/search.ts` | 담당 3 | 담당 2·4·5 review |
| `src/contracts/recommendation.ts` | baseline 후 담당 1 | 담당 3·4·5 승인 필요 |
| `src/contracts/ports.ts` | baseline 후 담당 1 | repository 오너 1·5와 schema 오너 2 review |
| `prisma/schema.prisma`·migration | 담당 2 | business mapping 오너 1·5 review |
| `src/composition/*`·adapter config | 담당 1 | 각 오너는 factory·adapter export 제공 |
| `src/app/api/_shared/http.ts` | 담당 1 | validator 요구사항만 전달 |
| `src/components/content-card.tsx` | 담당 2 | 담당 5는 callback 소비 |
| `src/components/recommendation-view.tsx` | 담당 5 | 담당 4 child import만 요청 |
| `src/components/recommendation-results.tsx` | 담당 4 | 담당 5가 props review |
| `src/app/globals.css` | 담당 3 | 각 화면 오너가 selector patch와 브라우저 승인 제공 |
| `tests/demo-flows.test.mjs` | 담당 1 | 각 오너가 assertion 초안·domain test 제공 |
| `.env.example`, `README.md`, `AGENTS.md` | 담당 1 | 각 adapter·화면 오너가 필요한 이름·실행 변경을 전달 |
| `docs/ARCHITECTURE.md`, `docs/TEAM-OWNERSHIP.md` | 담당 1 | v0.6·v0.7 기준으로 최종 pointer와 경계를 정합화 |

### 8.2 담당별 테스트 파일

```text
tests/anonymous-platform-run.test.mjs       담당 1  신규 제안
tests/catalog-ott-schema.test.mjs           담당 2  신규 제안
tests/choice-search-continuation.test.mjs   담당 3  신규 제안
tests/ranking-selector-result.test.mjs      담당 4  신규 제안
tests/pipeline-fallback.test.mjs             담당 4  신규 제안
tests/policy-approval-trace.test.mjs        담당 5  신규 제안
tests/replacement-interest.test.mjs         담당 5  신규 제안
tests/demo-flows.test.mjs                   담당 1  기존 수직 smoke
tests/budget.test.mjs                       담당 4  기존
```

현재 `npm test`는 `tests/*.test.mjs`를 실행하므로 신규 파일도 별도 test script
변경 없이 포함된다.

### 8.3 자동·수동 테스트 경계

현재 저장소에는 jsdom, React Testing Library, Playwright가 확인되지 않는다.
새 브라우저 테스트 의존성이 이미 있다고 가정하지 않는다.

자동 Node·HTTP 테스트:

- API 상태·오류·privacy
- request·search·score·policy·replacement 계약
- memory·Prisma repository 계약
- fallback·Trace·schema
- server render와 전체 flow smoke

수동 브라우저 체크:

- sessionStorage 저장·중복 방지·탭 종료 범위
- 관심 없음 callback과 교체 loading·실패 UI
- OTT 새 창 이동과 버튼 문구
- 모바일 layout
- 키보드 조작·focus·aria-live
- 1분 시연 동선

브라우저 test framework를 새로 도입하려면 설치 시간과 build 호환성을 Day 1에
확인해야 한다. 도입하지 않아도 위 수동 체크 결과를 담당별 handoff note에
기록해야 한다.

---

## 9. 도메인 의존성과 병렬 작업

### 9.1 Day 1에 먼저 고정할 선행 작업

1. 담당 2가 작성하는 provider·catalog·두 모델 Prisma baseline
2. 담당 3이 작성하는 요청 검증·SearchInput·continuation baseline
3. 담당 4가 작성하는 `ExecutionAttempt`·
   `MvpRecommendationExecutionResult`·BudgetSnapshot baseline
4. 담당 5가 작성하는 상태 전이·Trace 저장/projection baseline
5. 담당 1이 취합하는 API·공개 응답·repository·`MvpAdapterSet` baseline
6. ContentCard callback과 Result child props
7. 공통 타입 compile과 최소 contract test

baseline은 공동 커밋이고 각 담당은 자신의 계약 부분에 책임을 진다. 담당 1이
회의 진행자라는 이유로 모든 계약 내용을 작성하지 않는다.

### 9.2 계약 후 독립적으로 가능한 작업

- 담당 1: 익명 route, Run memory/mapping, shell, composition 골격
- 담당 2: fixture, 필터, links, ContentCard, migration
- 담당 3: ChoiceForm, request, query, semantic, continuation
- 담당 4: score, selector, budget, fallback, result child
- 담당 5: 상태 전이, policy, Trace, approval/replacement, result container

담당 4는 Catalog/Search mock을 사용하고 담당 5는 Executor/Repository mock을
사용한다. 다른 사람의 구현 완료를 기다리지 않는다.

### 9.3 실제 blocking 관계

| 후행 작업 | 필요한 선행 계약·구현 |
|---|---|
| 담당 3 provider UI | 담당 2 OttProvider baseline |
| 담당 2 필터 | 담당 3 SearchInput baseline |
| 담당 4 Pipeline 통합 | 담당 2 Catalog/Filter + 담당 3 `RecommendationSearchOutput` |
| 담당 5 final policy | 담당 2 filter + 담당 4 `ExecutionAttempt`·fallback 함수 |
| 담당 5 승인·교체 검색 | 담당 3 continuation |
| 담당 4 result child | 담당 2 ContentCard contract + 담당 5 callback contract |
| 담당 1 HTTP happy path | 담당 5 `AnonymousRecommendationServices` mock 또는 구현 |
| Prisma workflow E2E | 담당 1 Run mapping·contract + 담당 2 schema/client·Prisma Run repo + 담당 5 Prisma Trace repo |

---

## 10. 3일 실행 계획

### 10.1 1일 차 — 계약·익명화·독립 골격

오전:

- 90~120분 v0.7 공동 계약
- API·request·response·search continuation·execution·Trace·DB baseline
- 공유 파일 단일 작성자와 merge slot 확정
- baseline typecheck와 contract test
- baseline 직후 30분: 담당 1이 `AGENTS.md`·`TEAM-OWNERSHIP.md`의 역할
  pointer를 v0.6·v0.7로 갱신하고, 나머지 담당자는 자신의 경계 문구를 검토
- 실제 Git branch·Supabase·OpenAI·촬영 환경 확인

오후:

- 담당 1: 익명 route·memory Run·AppShell
- 담당 2: provider 이동·fixture filter·link type·최소 schema
- 담당 3: 중립 ChoiceForm·request/SearchInput·vector 골격
- 담당 4: 익명 score·executor·BudgetCounter·result child 골격
- 담당 5: 익명 orchestrator·state·Trace projection·result container 골격

종료 조건:

- 다섯 branch가 각각 typecheck 가능한 compile-ready 골격을 제공한다.
- 신규 v0.7 계약과 목표 `MvpAdapterSet`이 고정되고 legacy 계약은 deprecated
  상태로 유지된다.
- 신규 코드에는 사용자·프로필·engagement 의존성이 없다.
- mock을 사용한 POST→completed 최소 service contract가 통과한다.
- P0 blocker는 0개이거나 실명 오너와 Day 2 오전 마감이 있다.

### 10.2 2일 차 — 도메인 완료·첫 수직 통합

오전:

- 담당별 P0 happy path의 backend·frontend 연동과 compile-ready export 완료
- edge flow와 비필수 live smoke는 첫 수직 통합 후에도 병렬 진행
- adapter/factory/component props export
- style selector 변경 요청을 담당 3에게 전달
- 각 branch lint·typecheck

오후:

1. 담당 2 Catalog/Filter mock 또는 branch 연결
2. 담당 3 CHOICE/Search 연결
3. 담당 4 Engine/Result child 연결
4. 담당 5 Policy/Result container 연결
5. 담당 1 API/Composition 통합 branch 연결
6. no-env 홈→CHOICE→정상 결과 happy path 실행

종료 조건:

- happy path 수직 통합이 실제 브라우저와 API에서 성공한다.
- 정상 결과가 고유 최대 5편이고 선택 provider가 반영된다.
- 담당별 완료 조건 90% 이상, domain test green
- Day 3에는 최초 배선이 아닌 edge-flow 통합과 안정화만 남는다.

### 10.3 3일 차 — edge flow·release candidate

오전 병합 순서:

1. 담당 2 Catalog·OTT·schema
2. 담당 3 CHOICE·Search·CSS
3. 담당 4 Ranking·Fallback·Result child
4. 담당 5 Policy·Trace·Interaction container
5. 담당 1 API·Run·Composition 최종 배선
6. 통합 오너가 cleanup preflight로 활성 코드의 legacy import가 없는지 검사
7. 담당 3이 login·onboarding page/form 소비 파일 삭제 → typecheck
8. 담당 5가 MY·engagement UI/API/adapter를 삭제하되 contract는 잠시 유지
   → typecheck
9. 담당 1이 auth·profile API/adapter/fixture와 deprecated port·import·구
   composition을 제거 → typecheck
10. 담당 5가 이제 미참조인 engagement contract를 삭제 → typecheck
11. 담당 2가 이제 미참조인 user contract와 legacy Prisma 모델·enum을 제거
    → typecheck·migration 검사

오후:

- 제거 route·model·import 검사
- memory no-env 전체 integration
- 자격 증명이 있으면 Prisma·OpenAI smoke
- 정상·승인·거절·정책 차단·fallback·교체·reset 수동 실행
- lint·typecheck·test·build
- 1분 대표 시연 2회
- release candidate 동결 후 기능 변경 금지

종료 조건:

```text
npm run lint       PASS
npm run typecheck  PASS
npm run test       PASS
npm run build      PASS
```

- 모든 MVP 흐름이 연속 2회 성공한다.
- 제외 route와 UI가 노출되지 않는다.
- DB fresh migration에는 Run·Trace만 존재한다.
- 외부 자격 증명이 없어도 촬영 가능한 no-env Demo가 동작한다.

---

## 11. v0.6 완료 조건별 최종 오너

| v0.6 완료 조건 | 1차 판정 오너 | 필수 협력 |
|---|---|---|
| 로그인 없이 홈→CHOICE→결과 | 담당 1 | 담당 3·5 |
| 선택 OTT가 필터에 반영 | 담당 2 | 담당 3 |
| 선택 OTT가 추천 이유에 반영 | 담당 4 | 담당 2 |
| 고유 작품 최대 5편 | 담당 4 | 담당 2·3 |
| TOP1과 이유 최대 3개 | 담당 4 | 없음 |
| 응답 직전 정책 검사 | 담당 5 | 담당 2 |
| 30분 후보 부족 승인 대기 | 담당 5 | 담당 2·3·4 |
| 승인 시 runtime 45만 적용 | 담당 5 | 담당 3 |
| 거절 시 부분 결과 유지 | 담당 5 | 담당 4 |
| 예산 초과 deterministic fallback | 담당 5 | 생성 담당 4 |
| fallback badge·고지 | 담당 4 | metadata 담당 5 |
| 정확히 한 자리 안전 교체 | 담당 5 | 담당 2·3 |
| Trace 순서와 공개 결과 포함 | 담당 5 | 없음 |
| 관심 없음 backend 비저장 | 담당 5 | API 검사 담당 1 |
| DB에는 Run·Trace만 존재 | 담당 2 | mapping 담당 1·5 |
| Run·Trace 비식별·자연어 미저장 | 담당 1 | 담당 3·5 |
| 전체 Run 목록 API 없음 | 담당 1 | 없음 |
| opaque runId | 담당 1 | 담당 2 |
| secret·raw 오류 비노출 | 담당 1 | 담당 4·5 |
| 정상 결과 결정성 | 담당 4 | 담당 2·3 |
| 승인·정책 차단 시나리오 | 담당 5 | 담당 2·3 |
| fallback 시나리오 | 담당 5 | 담당 4 |
| reset | route 담당 1 | Trace clear 담당 5 |
| OTT 이동 | 담당 2 | 결과 배치 담당 4 |
| 1분 Demo와 2회 재현 | 진행 담당 1 | 전원 |
| lint·typecheck·test·build | gate 진행 담당 1 | 실패 수정은 각 오너 |

---

## 12. 현재 VS Code 구조 처리

### 12.1 유지

| 현재 영역 | 오너 | 처리 |
|---|---|---|
| fixture catalog | 담당 2 | 필드·링크 검수 후 동결 |
| catalog filtering | 담당 2 | 사용자 context를 요청 context로 변경 |
| local query·semantic search | 담당 3 | vector continuation 가능하게 수정 |
| deterministic selector | 담당 4 | 기본 경로 유지 |
| score·budget·fallback·pipeline | 담당 4 | 익명 입력과 metadata 계약 반영 |
| policy·Trace | 담당 5 | 저장/public 타입 분리 |
| 추천 생성·단건 조회·승인·교체 route | 담당 1·5 | API 계약대로 수정 |
| memory Run·Trace | 담당 1·5 | 정제 저장 계약과 동시성 반영 |

### 12.2 수정

| 현재 영역 | 오너 | 필요한 변경 |
|---|---|---|
| catalog contract·provider 타입 | 담당 2 | user contract 의존 제거, link type |
| search contract | 담당 3 | UserContext 제거, provider·continuation |
| recommendation·ports contract | baseline 후 담당 1 | 사용자 소유권 제거, exact Run·Trace 계약 |
| request/query/semantic | 담당 3 | 중립값, 자연어+chip, vector 재현 |
| scoring/executor/fallback | 담당 4 | 익명 score, result metadata |
| orchestrator/policy/trace | 담당 5 | auth/profile/engagement 제거 |
| composition/config/health/reset | 담당 1 | 익명 capability만 조립 |
| Prisma schema·README | 담당 2 | Run·Trace-only |
| 홈 | 담당 3 | `/login` 대신 CHOICE 직접 진입 |
| shell | 담당 1 | 로그인·프로필·MY 제거 |
| CHOICE | 담당 3 | provider와 중립값 |
| ContentCard·ProviderBadge | 담당 2 | link type·engagement 제거·callback |
| 결과 표시 | 담당 4·5 | child와 container로 파일 분리 |
| globals.css | 담당 3 | 제거 selector 정리와 새 상태 스타일 |
| Demo tests | 담당 1, domain test는 전원 | 사용자·참여 회귀를 익명 flow로 교체 |
| `.env.example`·README·AGENTS | 담당 1 | 익명 no-env 실행과 v0.7 오너십 pointer |
| Architecture·Team Ownership 문서 | 담당 1 | v0.6·v0.7보다 낮은 구 경계를 정합화 |

### 12.3 제거

아래 표는 최종 삭제 오너를 의미한다. 공용 legacy 타입·component를 각자의
독립 feature branch에서 먼저 삭제하지 않는다. 모든 runtime 의존 branch가
통합된 뒤 3일 차 cleanup slot에서 아래 순서로 삭제하고, 삭제 단계마다 import
검사와 typecheck를 실행한다.

| 순서 | 현재 파일·영역 | 제거 오너 | 선행 조건 |
|---:|---|---|---|
| 1 | login·onboarding page와 onboarding form | 담당 3 | 홈 직접 CHOICE 진입 |
| 2 | MY page·MyView, engagement API·memory repository·actions | 담당 5 | AppShell 링크·ContentCard 호출 제거. engagement contract는 유지 |
| 3 | auth/session·users/profile API, auth adapter·profile repository·user fixture, deprecated port/import·구 composition | 담당 1 | orchestrator·composition이 v0.7 활성 이름만 사용 |
| 4 | engagement contract | 담당 5 | deprecated `EngagementRepository` import 제거 |
| 5 | user contract | 담당 2 | `OttProvider` 이동과 auth/profile/deprecated port import 제거 |
| 6 | Prisma의 User·Profile·Subscription·Catalog·Embedding·Item·Approval·Engagement 모델·enum | 담당 2 | Run response snapshot·revision 계약 확정 |

### 12.4 보류

다음은 구현하거나 확장하지 않는다.

- `prisma/sql/pgvector.sql`
- Prisma catalog/search/embedding 모델
- `AgentRecommendationExecutor`
- tool registry 확장
- agent loop·LangGraph·MCP·ReAct
- TMDB runtime·자동 배치
- post-MVP 인증·계정·프로필·engagement 기능 재도입
- 300편 확대 작업
- 다단계 조건 완화

보류 코드는 기본 composition에서 import하거나 선택할 수 없어야 한다. 기존
extension seam 파일을 물리 삭제할지는 MVP 동작과 무관하므로 스프린트에서
추가 작업하지 않는다.

---

## 13. 작업량 균형과 조정

예상 상대 부하:

| 담당 | 예상 부하 | 부하 요인 |
|---|---|---|
| 담당 1 | 높음 | API·Run mapping·shell + 통합 운영 |
| 담당 2 | 높음 | fixture/filter/OTT UI + schema |
| 담당 3 | 높음 | CHOICE UI·search + CSS 단일 작성 |
| 담당 4 | 높음 | scoring/selector/OpenAI/budget/fallback + 결과 child |
| 담당 5 | 높음 | policy/승인/교체/Trace + 상호작용 |

통합 오너에게 작업이 몰리지 않도록 다음을 적용한다.

| 상황 | 조정 |
|---|---|
| 담당 1 통합 운영으로 Run 작업 지연 | 담당 2가 Prisma repository·client·migration을 제공하고 담당 1은 정제 mapping·memory 계약만 유지 |
| 담당 2 schema 작업 과부하 | fixture QA case 작성은 담당 3·4가 자신이 쓰는 시나리오별로 분담 |
| 담당 3 CSS 단일 작성 과부하 | 각 UI 오너가 완성된 selector patch와 상태표를 제공하고 담당 3은 기계적 적용만 수행 |
| 담당 4 OpenAI 지연 | adapter 코드·fake test는 완료하고 실제 key smoke만 확인 필요로 남김. deterministic path는 P0 |
| 담당 5 workflow 지연 | 담당 3이 continuation integration test, 담당 4가 fallback result/UI test를 제공 |
| 전체 test 실패 | 담당 1은 분류만 하고 원인 도메인 오너가 수정 |
| 한 담당이 Day 2 오전 조기 완료 | 자신의 연동 소비자에게 test fixture·canary·접근성 검증을 제공하되 타 도메인 코드는 수정하지 않음 |

---

## 14. Git·통합 운영

브랜치 예시:

```text
dev
├─ feature/v07-anonymous-platform-release
├─ feature/v07-catalog-ott-schema
├─ feature/v07-choice-local-search
├─ feature/v07-ranking-fallback-result
└─ feature/v07-policy-trace-interaction
```

규칙:

- 실제 repository의 Git metadata와 `dev` 존재 여부는 시작 전에 확인한다.
- baseline에서 분기한다.
- PR 대상은 `dev`다.
- `dev`, `main`에 직접 push하지 않는다.
- 공유 계약 변경은 작은 별도 커밋과 영향받는 오너 review가 필요하다.
- 각 PR은 backend, 담당 frontend 연동, domain test를 함께 포함한다.
- integration owner가 merge slot을 열기 전에 각 오너가 lint·typecheck를
  통과시킨다.
- 개인 `.env.local`, secret, token, DB URL, 로그, build output을 커밋하지 않는다.

---

## 15. 확인 필요 항목

확인되지 않아도 no-env MVP 완료를 막지 않는 항목:

| 항목 | 상태 | 처리·영향 오너 |
|---|---|---|
| OpenAI 모델명·키 | 확인 필요 | adapter/fake test 담당 4, 실제 smoke만 조건부 |
| Supabase 연결 정보 | 확인 필요 | schema 담당 2, Run·Trace smoke 담당 1·5 |
| 촬영·배포 환경 | 확인 필요 | Day 1 담당 1이 확정 |
| OTT 검색 URL 검증 | 일부 확인 필요 | 담당 2가 DIRECT/SEARCH/HOME으로 표시 |
| Run 보존 기간 | 확인 필요 | 3일 MVP 자동 만료 제외 |
| fixture 확대 | 확인 필요 | 대표 흐름 후보가 부족할 때만 담당 2가 최소 보강 |
| 실제 Git branch 상태 | 확인 필요 | 담당 1이 시작 전 확인 |

다음은 v0.7에서 이미 확정하므로 다시 논의하지 않는다.

- 로그인·회원가입·계정·프로필·인증 세션 제외
- 찜·봤어요·MY 제외
- 관심 없음 sessionStorage
- DB Run·Trace 전용
- fixture/local/deterministic/memory 기본 경로
- frontend 연동을 각 도메인 오너가 책임
- 담당 1이 통합 오너

---

## 16. v0.7 완료 판정

역할 분담 문서 자체의 완료 조건:

- v0.6 포함 기능과 완료 조건마다 1차 오너가 있다.
- v0.6 제외 기능이 어떤 담당자의 신규 기능에도 없다.
- 다섯 담당자 모두 backend·frontend 연동·E2E 책임을 가진다.
- health/reset·제외 API 삭제·composition·통합 suite의 오너가 있다.
- 공유 파일마다 단일 작성자가 있다.
- 첫 수직 통합이 Day 2에 배치되어 있다.
- 통합 오너의 권한과 과부하 방지 규칙이 명시되어 있다.
- 확인되지 않은 외부 항목은 확인 필요로 표시되어 있다.

제품 release 완료 조건은 `OTT-DAMOA-MVP-v0.6.md` 13절을 그대로 따른다.

---

## 17. 개정 이력

| 버전 | 변경 |
|---|---|
| v0.6 | 백엔드 도메인 중심 5인 역할 분담 |
| v0.7 | 도메인별 backend + 담당 frontend 연동 + 담당 E2E로 수직화, 담당 1 통합 오너 지정, 미배정 API·삭제·통합 작업 보완 |

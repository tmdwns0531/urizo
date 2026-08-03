# OTT 다모아 v0.9 bounded-Agent Demo/LIVE MVP

OTT 다모아는 익명 사용자가 현재 구독 중인 OTT, 기분, 함께 보는 사람, 시청 가능 시간 등을 선택하거나 한 문장으로 입력하면 안전 정책을 통과한 작품을 최대 5개 추천하는 서비스입니다.

현재 기준은 다음 두 실행 프로필을 함께 유지합니다.

- `demo`: 외부 자격증명 없이 fixture catalog, 로컬 검색, 결정론적 selector, memory 저장소로 실행
- `live`: Supabase PostgreSQL/Prisma catalog, OpenAI embedding + pgvector 검색, OpenAI selector, Prisma Run·Trace 저장소로 실행

로그인, SNS/OAuth, Profile, MY, 찜, 봤어요, 서버 저장 관심 없음은 v0.9 범위에 포함되지 않습니다.

## Demo 바로 실행

요구 사항:

- Node.js 22.13 이상
- npm

Windows:

```powershell
npm.cmd ci
npm.cmd run dev
```

macOS/Linux:

```bash
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 기본값은 `APP_PROFILE=demo`이며 `.env.local`, 데이터베이스, Supabase, pgvector, OpenAI, TMDB가 없어도 실행되어야 합니다.

Demo preset은 다음과 같습니다.

| 기능 | 구현 |
|---|---|
| Catalog | `fixture` |
| Search | `local` 64차원 hash/cosine |
| Selector | `deterministic` |
| Run store | `memory` |
| Trace store | `memory` |

## LIVE 구조

`APP_PROFILE=live`는 화면 표시만 바꾸는 값이 아니라 composition root에서 실제 adapter 조합을 선택하는 preset입니다.

```text
익명 CHOICE/자연어 요청 검증
→ 결정론 parser의 자연어 조건 구조화
→ bounded Agent의 필요 시 검색 전 가족 구성 질문(최대 1회)
→ Prisma catalog 필수 eligibility
→ OpenAI 1536차원 embedding
→ pgvector 후보 검색
→ hybrid ranking
→ 예산 안의 OpenAI structured selector
→ 응답 직전 동일 정책 재검사
→ 승인·fallback·완료
→ Prisma Run 저장 및 append-only Trace
```

LIVE preset은 다음 구현을 선택합니다.

| 기능 | 구현 |
|---|---|
| Catalog | Prisma |
| Search | OpenAI embedding + pgvector |
| Selector | OpenAI structured selector |
| Run store | Prisma |
| Trace store | Prisma |

페이지와 API는 adapter를 직접 분기하지 않습니다. concrete integration 선택과 동적 import는 `src/composition`에서만 수행합니다. 추천 요청 중 TMDB를 호출하지 않으며, TMDB는 별도의 catalog ingestion 단계에서만 사용합니다. 공개 `/api/search`도 제공하지 않습니다.

OpenAI selector가 실패하면 필수 정책을 완화하지 않는 결정론적 fallback을 사용할 수 있습니다. 데이터베이스나 catalog 장애를 memory 저장소로 몰래 전환하지는 않습니다.

## LIVE 환경 변수

공유 가능한 변수 이름과 안전한 기본값은 [.env.example](./.env.example)에만 둡니다. 실제 값은 Git에서 제외된 `.env.local`에만 저장하고 기존 파일을 덮어쓰지 마세요.

| 선택 기능 | 필요한 변수 |
|---|---|
| Prisma runtime | `DATABASE_URL` |
| Prisma migration | `DATABASE_URL`, `DIRECT_URL` |
| 계정 세션 (로그인·찜) | `SESSION_SECRET` |
| OpenAI selector | `OPENAI_API_KEY`, `OPENAI_GENERATION_MODEL` |
| pgvector search | `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS=1536` |
| TMDB ingestion | `TMDB_API_KEY` |

`SESSION_SECRET`은 LIVE에서 선택이 아니라 필수입니다. 값이 없으면 계정 API가 기동을 거부하고 회원가입·로그인이 500으로 실패합니다. 기본값으로 서명하면 그 키가 저장소에 공개되어 누구나 남의 세션을 위조할 수 있기 때문에, 조용히 뚫려 있는 대신 뜨지 않도록 했습니다. 값은 각자 만들며 서로 같을 필요가 없습니다. Demo는 프로세스마다 임시 키를 만들어 쓰므로 설정하지 않아도 됩니다.

기본 모델 설정은 `gpt-5.6-terra`, `text-embedding-3-small`, 1536차원입니다. 선택한 adapter에 필요한 변수만 검증하며 Prisma-only runtime에는 Supabase anon key나 service-role key가 필요하지 않습니다.

기능별 selector인 `CATALOG_ADAPTER`, `SEARCH_ADAPTER`, `SELECTOR_ADAPTER`, `RUN_STORE`, `TRACE_STORE`를 명시하면 지원되는 혼합 구성을 사용할 수 있습니다. 다만 catalog 일관성을 보장할 수 없는 `fixture + pgvector` 조합은 거부됩니다.

## LIVE 로컬 준비 순서

실제 LIVE 자격증명을 사용하기 전에 다음 순서로 준비합니다.

1. 과거에 노출 가능성이 있었던 OpenAI API key, Supabase service-role key, PostgreSQL 비밀번호·URL, TMDB key를 모두 회전합니다.
2. 인증 없는 Demo API가 외부에 공개되지 않도록 실행 중인 `cloudflared` 등 공개 터널을 종료합니다.
3. 새 값을 `.env.local`에만 넣습니다. 일반 실행은 `APP_PROFILE=live`, 로컬 강제 실행은 `npm run dev:live`를 사용합니다.
4. Prisma migration을 적용하고 client를 생성합니다.
5. TMDB catalog를 정규화해 idempotent upsert합니다.
6. 변경된 search document만 OpenAI embedding으로 변환해 pgvector에 저장합니다.
7. 로컬 서버를 실행하고 health, 추천 생성, 승인, 교체 흐름을 검증합니다.

LIVE 준비 명령은 다음과 같습니다.

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run live:catalog:ingest
npm.cmd run live:catalog:embed
npm.cmd run dev:live
```

`db:migrate:deploy`는 `.env.local`의 `DATABASE_URL`과 `DIRECT_URL`이 모두 필요하며 실제 대상 DB를 변경합니다. `live:catalog:ingest`는 TMDB를 호출하고, `live:catalog:embed`는 OpenAI 사용량을 발생시킵니다. 대상과 회전된 자격증명을 확인한 뒤 순서대로 실행하세요. 세 작업을 한 번에 수행할 때만 `npm.cmd run live:prepare`를 사용합니다.

`dev:live`는 크로스플랫폼 Node wrapper가 자식 Vinext 프로세스에 내부 override를 주입해 완전한 LIVE preset을 강제합니다. 따라서 `.env.local`에 Demo selector가 남아 있어도 catalog/search/selector/Run/Trace가 모두 LIVE adapter로 조립됩니다. 일반 `npm.cmd run dev`는 override를 강제하지 않으며, 환경 변수가 없거나 Demo로 설정된 경우 credential-free Demo를 실행합니다.

Worker 호환 Prisma Client와 request-scoped 연결 수명주기는 구현되어 있습니다. 외부 Sites 배포, 운영 secret 등록, 연결 풀 한도 검증은 별도 release gate이며 위 순서는 로컬 LIVE 검증 범위입니다.

## 화면과 API

화면:

| 경로 | 설명 |
|---|---|
| `/` | 서비스 소개와 익명 추천 진입 |
| `/choice` | 익명 CHOICE 입력 |
| `/prompt` | 한 문장 입력, 해석 확인·수정, in-place 추천 결과 |
| `/recommendations/[runId]` | canonical TOP1과 대안 최대 4개, Trace, 가족·runtime 승인, 교체 |

API:

| Method | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | adapter 구성과 catalog·Run·Trace 저장소 readiness 확인. 비밀값은 반환하지 않음 |
| `POST` | `/api/recommendations` | 익명 추천 Run 생성 |
| `GET` | `/api/recommendations/[runId]` | 추천 Run 조회 |
| `POST` | `/api/recommendations/[runId]/approval` | 가족 구성 답변 또는 runtime 완화 승인·거절 |
| `POST` | `/api/recommendations/[runId]/replacement` | 기존 sanitized input과 vector를 재사용한 안전한 교체 |
| `POST` | `/api/demo/reset` | Demo profile의 memory Run·Trace만 초기화 |
| `POST` | `/api/ads` | 추천과 분리된 정적 Demo 스폰서 fixture 선택 |
| `POST` | `/api/ads/events` | Demo `IMPRESSION`·`CLICK` payload 검증 후 폐기 |

총 HTTP surface는 8개입니다. `MVP_API_ENDPOINTS`는 익명 추천·health/reset의 fixed core 6개만 등록하고 광고 2개는 별도 광고 계약을 사용합니다. 익명 Run 목록 API는 제공하지 않습니다. LIVE health는 비용을 발생시키지 않도록 catalog·Run·Trace 저장소만 실제 조회하고, OpenAI search·selector는 `not_checked`로 표시합니다. 공개 오류는 정제된 코드만 반환하며 stack, DB/provider 원문, prompt, secret을 노출하지 않아야 합니다.

광고는 두 개의 fictional campaign을 사용하는 비영속 Demo fixture입니다. 현재 route/component에는 `APP_PROFILE` gate가 없으므로 LIVE 노출이 코드로 차단됐다고 간주하지 않습니다. 광고 실패는 추천 완료를 막지 않으며 추천 순위·일치율에 섞이지 않습니다.

## 보안과 데이터 원칙

- `.env.local`, `.dev.vars*`, API key, 비밀번호, DB URL, token을 코드·문서·로그·커밋·PR에 넣지 않습니다.
- Run·Trace에는 사용자 식별정보, 인증·세션, 자연어 원문, matched term, raw prompt, 모델·TMDB 원문 응답을 저장하지 않습니다.
- 연령, provider, runtime, origin, 제외, 교체, 최종 안전 필터를 OpenAI selector나 fallback이 우회할 수 없습니다.
- 18세 및 연령 UNKNOWN 작품은 익명 결과에서 제외합니다.
- 아이 동반 시 사용자가 고른 `ALL·7·12·15`를 최대 허용 관람등급으로 적용하고, 상한이 없으면 fail closed합니다.
- pgvector 검색은 catalog eligibility를 통과한 content ID allowlist 내부에서만 parameterized SQL로 수행합니다.
- 실제 키를 사용하기 전에 공개 터널이 종료되었는지 다시 확인합니다.

## 필수 검증

변경을 인계하기 전에 다음 명령을 모두 통과시킵니다.

```powershell
npm.cmd run db:validate
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

`db:validate`는 validation 전용 로컬 URL을 Prisma CLI child process에만 주며 실제 데이터베이스에 연결하지 않습니다. 외부 migration, TMDB/OpenAI smoke test는 위 정적·회귀 검사와 별도로 수행합니다.

## Git과 팀 작업

기준 저장소는 `https://github.com/tmdwns0531/urizo.git`입니다. 팀원은 승인된 `dev`에서 기능 branch를 만들고 PR을 `dev`로 보냅니다. `dev`와 `main`에는 직접 push하지 않습니다.

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/<github-id>_<work-slug>_<version>

# 구현 및 필수 검증 후
git push -u origin feature/<github-id>_<work-slug>_<version>
```

v0.9 작업은 다음 단일 작성자 경계를 유지합니다.

| 영역 | 주요 경계 |
|---|---|
| 통합 | config, composition, health, release docs |
| Catalog·DB | Prisma schema/migration, repositories, TMDB ingestion |
| Search | embedding client, pgvector adapter, continuation |
| Selector | OpenAI selector, model budget, deterministic fallback |
| Policy·Trace | orchestrator, approval, replacement, Trace projection |
| Demo 광고(⚠️ 오너 지정 필요) | 광고 contract/domain/routes/components/public asset/test |

공유 contract와 migration은 작은 선행 commit으로 분리하고 영향을 받는 담당자의 review를 거칩니다. 기능 branch는 concrete factory를 제공하며 여러 branch가 composition 파일을 동시에 수정하지 않습니다.

## 기준 문서

- [v0.9 dev review readiness](./docs/V09-DEV-REVIEW-READINESS.md)
- [v0.9 migration atomicity review](./docs/V09-MIGRATION-ATOMICITY-REVIEW.md)
- [LIVE MVP v0.8](./docs/OTT-DAMOA-LIVE-MVP-v0.8.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [LIVE ERD v0.8](./docs/ERD-v0.8-live.md)
- [Backend Sprint Ownership v0.7](./docs/BACKEND-SPRINT-OWNERSHIP-v0.7.md)
- [Demo MVP v0.6](./docs/OTT-DAMOA-MVP-v0.6.md)
- [Agent guide](./AGENTS.md)

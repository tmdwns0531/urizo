# OTT 다모아 Demo MVP

구독 중인 OTT, 현재 기분, 시청 가능 시간을 바탕으로 지금 볼 작품 5편을 고르고 추천 과정과 정책 적용 내역을 공개하는 로컬 Demo입니다.

기본 실행 경로는 인증 키, 데이터베이스, pgvector, OpenAI 키, 외부 네트워크를 요구하지 않습니다. Fixture 카탈로그와 결정론적 추천 엔진을 사용하되 필수 필터, 점수 정규화, 다양성, 예산, 승인, 응답 직전 정책 검사, 폴백, Trace, 교체 로직은 Live 어댑터와 공유할 수 있도록 도메인 코드에 분리했습니다.

## 바로 실행

요구 사항: Node.js 22.13 이상

```powershell
npm.cmd ci
npm.cmd run dev
```

### macOS / Linux

```bash
npm ci
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 환경변수가 하나도 없어도 모든 어댑터가 Demo 기본값으로 선택됩니다.

```text
APP_PROFILE=demo
AUTH_ADAPTER=demo
CATALOG_ADAPTER=fixture
SEARCH_ADAPTER=local
SELECTOR_ADAPTER=deterministic
RUN_STORE=memory
TRACE_STORE=memory
ENGAGEMENT_STORE=memory
```

개인 Live 값은 `.env.local`에만 두고, 공유할 변수 이름은 `.env.example`에 추가합니다.

## 확인할 화면

- `/` — 제품 소개와 정책 원칙
- `/login` — 외부 인증 없는 Demo 진입
- `/onboarding` — 연령·구독 OTT·취향 프로필
- `/choice` — 네 그룹 CHOICE와 Demo Lab
- `/recommendations/[runId]` — TOP1 + 후보 4편, 공개 타임라인, 교체와 참여
- `/my` — 찜·봤어요·관심 없음·최근 추천
- `/api/health` — 현재 선택된 기능별 어댑터

CHOICE의 Demo Lab에서 다음 시나리오를 재현할 수 있습니다.

1. 기본 추천 — 필수 필터부터 최종 정책 검사까지 정상 TOP5
2. 승인 게이트 — 30분 후보 3편에서 45분 완화 승인 또는 거절
3. 정책 차단 — 미성년 Demo 컨텍스트에 주입된 성인 후보를 응답 직전에 제거
4. 예산 폴백 — 상한 초과 후 같은 필터를 지키는 결정론적 규칙 추천

## 검증

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

`npm run test`는 빌드된 Worker를 대상으로 정상 추천, 승인·거절, 정책 차단, 결정론적 폴백, 안전한 교체, 참여 이벤트, MY, 초기화를 순서대로 검증합니다.

## 구조

```text
src/
├─ app/                 # 화면과 HTTP route handler
├─ components/          # 공통 제품 UI
├─ contracts/           # 공급자 중립 계약
├─ domains/             # 검색·추천·정책·승인·Trace 핵심 로직
├─ adapters/            # Demo/Live 교체 지점
├─ composition/         # 유일한 어댑터 선택 위치
├─ config/              # 가중치·예산·어댑터 설정
└─ demo/                # 검수 가능한 사용자·작품 Fixture와 시나리오

prisma/                 # 미래 Live 어댑터 스키마와 pgvector SQL
docs/                   # 아키텍처와 5인 팀 소유권
```

핵심 의존 방향은 `app → domains → contracts`이며, 외부 구현은 `composition → adapters`에서 주입합니다. 공개 `/api/search`는 두지 않고 추천 API가 서버 내부 검색 계약을 호출합니다.

## Live 어댑터 연결

각 팀원은 자신의 선택자만 바꾸고 나머지는 Demo로 유지할 수 있습니다.

| 영역 | Demo | Live 슬롯 |
|---|---|---|
| 인증 | `demo` | `authjs` |
| 카탈로그 | `fixture` | `prisma` |
| 검색 | `local` | `pgvector` |
| 최종 선택 | `deterministic` | `openai` |
| 실행·Trace·참여 저장 | `memory` | `prisma` |

Live 선택 시 필요한 환경변수만 검증됩니다. 현재 저장소는 Live SDK 구현을 강제하지 않으며, 선택된 Live 구현은 `createComposition({ overrides })`로 해당 계약에만 주입합니다. 기본 Demo 경로에서는 Prisma Client나 외부 SDK를 import하지 않습니다.

자세한 경계와 담당 영역은 `docs/ARCHITECTURE.md`, `docs/TEAM-OWNERSHIP.md`를 참고하세요. 미래 Prisma 모델은 Demo 런타임과 분리되어 있으며 `prisma/schema.prisma`에 정의돼 있습니다.

## GitHub 협업

공유 저장소는 `https://github.com/tmdwns0531/urizo`입니다. 팀원은 `dev`에서 기능 브랜치를 만든 뒤 `dev` 대상으로 PR을 요청합니다. `main`과 `dev`에는 직접 push하지 않습니다.

```bash
git clone https://github.com/tmdwns0531/urizo.git
cd urizo
npm ci
npm run dev
```

사람과 코딩 LLM은 루트 `AGENTS.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/TEAM-OWNERSHIP.md` 순서로 읽으면 Demo 실행과 담당 어댑터 교체 지점을 바로 파악할 수 있습니다.

외부 배포는 아직 포함하지 않습니다. `.openai/hosting.json`, Sites Vite 플러그인, Cloudflare Worker 호환 빌드는 이후 명시적인 배포 단계에서 이어갈 수 있습니다.
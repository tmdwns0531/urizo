# v0.9 dev review readiness

- 확인 시각: 2026-08-03 06:26 KST
- 대상 branch: `feature/emilyjjang_ad-integration_v0.9.0`
- 구현 snapshot HEAD: `ece8cd7efdef149a779f04d83861247f95b55cd7`
- fetched `origin/dev`: `92d7787852bd147e71d25cd57f176f1a5a753adf`
- fetched origin feature: `e2d9697d4cbb567b047eed307b57d67e9de22a60`

이 snapshot은 P0-4 문서 정리 직전의 실행 코드와 migration 범위를 고정한다.
P0-4 자체는 문서와 PR template만 바꾸므로 아래 구현 통계에는 포함하지 않는다.
최종 PR 화면의 최신 SHA와 파일 수는 review 직전에 다시 확인한다.

## Remote and PR check

직접 `git fetch origin dev feature/emilyjjang_ad-integration_v0.9.0`를 실행한 뒤
비교했다.

| 비교 | 실제 결과 |
|---|---|
| `origin/dev...HEAD` | 0 behind / 5 ahead |
| origin feature...`HEAD` | 0 behind / 3 ahead |
| `origin/dev...HEAD` 구현 diff | 103 files, +12,541 / -1,285 |
| 열린 PR, base=`dev` | 0개 (`gh pr list` 결과 `[]`) |
| 열린 PR 변경 파일 overlap | 열린 PR이 없어 해당 없음 |

`origin/dev..HEAD`에는 아래 커밋이 있었다.

1. `ece8cd7` — P0-3 lifecycle CHECK 원자성 보강
2. `5d32036` — P0-2 아동 최대 허용 등급 copy 정렬
3. `b1770b4` — 이미 해결된 P0-1 family canonical 연속성 고정
4. `e2d9697` — v0.9 Agent/advertising integration
5. `099db05` — recommendation UX 개선

`099db05`는 `origin/feature/emilyjjang_live-ux-bugfixes_v0.8.1` history에도
포함된 stacked ancestry다. 확인 시점에는 이를 대상으로 한 열린 `dev` PR이
없었지만, merge 전 closed/merged PR과 중복 반영 여부는 GitHub commit graph에서
다시 확인한다.

## Document-to-code drift

| 영역 | 확인한 drift | 정리 결과 |
|---|---|---|
| 결과 수 | README의 고정 5개 표현이 실제 최대 5개/fail-safe 결과와 달랐다. | README를 최대 5개로 수정했다. |
| 입력·화면 | README와 구 문서는 CHOICE 중심이고 `/prompt`, 자연어 해석, bounded Agent를 설명하지 않았다. | README, AGENTS, Architecture에 현재 흐름을 추가하고 v0.6/v0.7에 supersession note를 붙였다. |
| API | 문서는 fixed core 6개만 공개 endpoint 전체로 설명했지만 코드에는 별도 `/api/ads*` 2개가 있다. | 총 HTTP 8개, core descriptor 6개 + 광고 계약 2개로 정정했다. 광고 코드는 변경하지 않았다. |
| family 상태 | 구 설명은 모든 `AWAITING_APPROVAL`에 vector/fingerprint가 있다고 전제했다. | `FAMILY_COMPOSITION` pre-search는 세 실행 필드 모두 null, runtime approval은 모두 non-null임을 v0.8 addendum/ERD/Prisma 문서에 명시했다. |
| family 행위 | 구조화 성인 `FAMILY`도 모호하다고 보는 설명과 dead-end가 있었다. | P0-1 코드에서는 재질문하지 않고 canonical 답변 버튼과 continuation을 유지한다. Architecture에도 exact structured 예외를 기록했다. |
| 아동 등급 | Step 1/6, canonical result, natural flow 문구가 실제 `ALL|7|12|15` 상한 필터를 충분히 설명하지 않았다. | P0-2에서 선택값이 최대 허용 기준이며 `18|UNKNOWN`은 제외된다는 copy와 test를 정렬했다. 필터 로직은 바꾸지 않았다. |
| migration | 기존 v0.9 DROP/ADD CHECK가 explicit transaction 밖에 있었고 SQL NULL이 CHECK를 통과할 여지가 있었다. | 기존 파일은 보존하고 transaction 및 `IS TRUE`를 사용하는 additive hardening migration과 review note/test를 추가했다. |
| schema 수 | v0.7/TEAM 문서가 active two-model schema라고 했다. | 현재 6개 모델로 AGENTS/TEAM을 정정하고 v0.7은 역사적 기준선으로 표시했다. |
| 승인 범위 | TEAM 문서는 30→45 runtime 승인만 설명했다. | family pre-search를 분리하고 runtime은 현재 `<30→30` 또는 `30 이상 45 미만→45`이며 CHOICE는 30→45임을 명시했다. |
| ownership | v0.7 역할표에는 자연어, Agent, 광고가 없고 과거 A–E 표기가 PR template에 남아 있었다. | Agent executor mechanics=4, conversation/orchestration/state=5로 분리했다. 광고는 임의 배정 없이 ⚠️ unassigned로 표시하고 PR template도 숫자 lane 기준으로 바꿨다. |
| cross-lane tool | `search-catalog-tool.ts`가 eligibility(2), search(3), scoring(4)을 함께 사용한다. | single writer 선합의가 필요하며 2·3·4 공동 review gate라고 기록했다. |
| dependency direction | orchestrator→adapter ID 의존 외에도 persistence adapters→domain Trace, search adapters→domain query/semantic 의존이 있어 목표 그림과 양방향이다. | 양방향 as-is 예외를 Architecture에 기록했다. 코드 cleanup은 이 문서 작업 범위에서 하지 않았다. |
| branch 규칙 | README의 `feature/<area>` 예시는 repository 규칙보다 느슨했다. | `feature/<github-id>_<work-slug>_<version>`으로 정정했다. |
| CODEOWNERS | wildcard 한 계정만 있어 1–5 lane과 광고 미지정 경계를 강제하지 못한다. | 파일은 임의 username 없이 유지한다. 아래 review 요청을 수동 적용해야 한다. |
| 외부 기준 문서 | workspace 밖 `PROJECT_CORE.md`, `PROCESS_DEFINITION.md`는 `e2d9697` 관점이며 P0-1/P0-2를 미해결로 표시한다. | context로만 사용했고 외부 파일은 수정하지 않았다. 이 저장소의 active docs와 코드가 PR artifact다. |

## Ownership and required review

| Lane | 이 branch가 건드린 주요 경계 | 필요한 review 관점 |
|---|---|---|
| 1 | API/Run mapping, composition, `mvp-api`, shell 및 release docs | HTTP compatibility, composition, release gate |
| 2 | Prisma migrations/schema docs, catalog filtering/fixtures | eligibility 불변, migration 순서와 deploy recovery |
| 3 | CHOICE/natural parser/request, search adapters/query | transient 원문, structured mapping, vector continuation |
| 4 | Agent executor mechanics, scoring/selector/fallback/result UI | budget, ranking, 최대 5개와 안전 fallback |
| 5 | Agent conversation/orchestrator/policy, family/runtime approval, replacement/Trace/canonical interaction | 상태 전이, persistence shape, 공개 Trace와 dead-end 방지 |
| ⚠️ unassigned | advertising contract/domain/routes/components/assets/tests | 오너 지정 전 확장 금지; 이번 P0 작업은 광고 코드를 변경하지 않음 |

특히 shared recommendation contracts는 영향받은 모든 lane, migration은 2와 Run
mapping 1 및 lifecycle/Trace 5, `searchCatalog`는 single writer 합의와 2·3·4
review가 필요하다. 현재 `CODEOWNERS`만으로 이를 자동 요청할 수 없다.

## P0 handoff units

| Unit | 독립 commit | 핵심 범위 |
|---|---|---|
| P0-2 | `5d32036` | UI/public copy와 copy regression test만 변경; filtering 불변 |
| P0-3 | `ece8cd7` | 신규 additive migration, static regression test, migration/ERD review docs |
| P0-4 | 이 문서와 정렬된 README/AGENTS/Architecture/ownership/history/template | 코드 변경 없는 review baseline 정리 |

## Remaining risks and unverified work

- ⚠️ 신규 migration은 실제 LIVE database에 적용하지 않았다. 대상 DB의
  migration history와 constraint 상태를 확인한 승인된 deploy가 별도로 필요하다.
- ⚠️ additive migration은 기존 v0.9 migration이 DROP 뒤 실패한 database를
  자동 복구하지 못한다. 그런 DB는 migration이 다음 파일까지 도달하지 않으므로
  수동 상태 확인과 승인된 repair 절차가 필요하다.
- ⚠️ 브라우저 수동/E2E와 시각적 copy 확인은 수행하지 않았다. source-level 및
  Node regression test와 구분한다.
- ⚠️ open PR 결과와 remote ref는 위 확인 시각의 snapshot이며 merge 직전에 다시
  fetch/check해야 한다.
- ⚠️ 광고는 profile gate가 없고 오너도 미지정이다. 이번 작업 범위에서는 광고
  behavior를 변경하지 않았다.
- ⚠️ 외부 `PROJECT_CORE.md`와 `PROCESS_DEFINITION.md`, 그리고 CODEOWNERS 자체는
  갱신하지 않았다.

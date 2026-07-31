# OTT 다모아 Git 작업 규칙

## 목적

저장소 owner와 모든 팀원은 같은 방식으로 작업한다. 개인 작업은
`dev` 또는 `main`에서 직접 시작하거나 push하지 않고, 최신 `dev`에서 만든
feature branch를 통해 공유한다.

## 브랜치 이름

모든 작업 브랜치는 아래 형식을 사용한다.

```text
feature/<github-id>_<work-slug>_<version>
```

- `github-id`: 작업자의 정확한 GitHub 로그인 ID
- `work-slug`: 작업 내용을 나타내는 소문자 영문·숫자·하이픈 조합
- `version`: 합의된 제품 버전 (`v0.8`, `v0.8.1` 등)
- 공백, 한글, 개인 이름, 의미 없는 번호만으로 된 작업명은 사용하지 않는다.

예시:

```text
feature/tmdwns0531_live-runtime_v0.8
feature/member01_catalog-ingestion_v0.8
feature/member02_replacement-trace_v0.8.1
```

## 표준 작업 순서

```bash
git switch dev
git fetch origin --prune
git pull --ff-only origin dev
git switch -c feature/<github-id>_<work-slug>_<version>

# 구현 및 검증
git add <이번 작업 파일>
git commit -m "<type>(<scope>): <summary>"
git push -u origin feature/<github-id>_<work-slug>_<version>
```

push 후에는 feature branch에서 `dev`를 대상으로 pull request를 만든다.
review와 필수 검사가 끝난 뒤 `dev`에 병합한다.

## 작업 시작 전 원격 충돌 점검

모든 작업자는 구현을 시작하기 전에 최신 원격 상태를 확인해야 한다. PR 제목만
보지 말고 실제 변경 파일까지 확인하여 자신의 예정 작업과 겹치는지 판단한다.

필수 점검 대상:

1. `origin/dev`의 최신 commit과 자신의 로컬 `dev` 차이
2. `dev`를 대상으로 열려 있는 모든 pull request
3. 각 pull request의 변경 파일 목록
4. 자신이 수정할 contract, migration, composition, 공용 UI와 테스트 파일

원격 `dev`는 다음과 같이 갱신하고 확인한다.

```bash
git fetch origin --prune
git log --oneline --decorate -n 15 origin/dev
git diff --name-status dev..origin/dev
```

GitHub 웹의 Pull requests 화면에서 base branch가 `dev`인 열린 PR을 확인한다.
GitHub CLI가 설치된 경우에는 다음 명령을 함께 사용할 수 있다.

```bash
gh pr list --base dev --state open --json number,title,headRefName,author,changedFiles
gh pr view <pr-number> --json files
```

예정 파일이 열린 PR 또는 최신 `origin/dev` 변경과 겹치면 독립적으로 구현을
진행하지 않는다. 아래 중 하나를 먼저 선택한다.

- 기존 PR 작성자 및 해당 파일 단일 작성자와 수정 순서를 합의한다.
- 겹치지 않는 파일·도메인으로 자신의 작업 범위를 줄인다.
- 기존 PR을 먼저 병합한 뒤 최신 `origin/dev`에서 branch를 다시 정렬한다.
- 공용 contract나 schema 변경을 단일 작성자의 작은 선행 PR로 분리한다.

원격 또는 GitHub 접근 문제로 열린 PR 변경 파일을 확인하지 못했다면
충돌이 없다고 간주하지 않는다. 확인하지 못한 범위를 작업자와 reviewer에게
알리고, 확인될 때까지 자신의 명시된 단독 소유 파일 밖으로 작업을 넓히지 않는다.

## PR 전 재점검과 기록

구현 시작 시 충돌이 없었더라도 작업 중 다른 PR이 생성될 수 있다. 따라서
review 요청 직전과 병합 직전에 위 점검을 다시 수행한다.

PR 설명에는 최소한 아래 내용을 기록한다.

```text
- 확인한 origin/dev commit:
- 확인한 dev 대상 열린 PR:
- 중복 가능 파일 및 협의 결과:
- 이번 PR의 단독 소유 파일:
- contract/schema/composition 변경 여부:
```

열린 PR과 파일이 겹치는 경우, 합의 내용이나 선행 병합 관계가 PR 설명에
없으면 review 및 병합을 진행하지 않는다.

## 공통 규칙

- 저장소 owner의 작업도 반드시 별도 feature branch를 사용한다.
- `dev`와 `main`에는 누구도 작업 커밋을 직접 push하지 않는다.
- 하나의 branch에는 하나의 검토 가능한 작업만 포함한다.
- 다른 팀원의 미완료 파일이나 담당 영역을 함께 수정하지 않는다.
- 공용 contract, Prisma migration, composition 경계를 바꾸면 관련 담당자의
  review를 받는다.
- 병합 전 `db:validate`, lint, typecheck, test, build를 통과한다.
- `.env.local`, API key, token, DB URL, 생성 로그와 build 결과는 commit하지
  않는다.
- 충돌 해결은 원래 담당자와 합의하고, 안전·정책·예산·Trace 검사를 약화하지
  않는다.

## 팀 역할 문서와의 관계

추후 추가되는 팀 역할 분담 문서는 각 작업의 `work-slug`, 담당 파일,
필수 reviewer를 지정할 수 있다. 다만 이 문서의 브랜치 형식과
`feature branch -> dev pull request` 원칙은 그대로 유지한다.

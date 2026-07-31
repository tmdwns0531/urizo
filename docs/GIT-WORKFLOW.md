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
git fetch origin
git pull --ff-only origin dev
git switch -c feature/<github-id>_<work-slug>_<version>

# 구현 및 검증
git add <이번 작업 파일>
git commit -m "<type>(<scope>): <summary>"
git push -u origin feature/<github-id>_<work-slug>_<version>
```

push 후에는 feature branch에서 `dev`를 대상으로 pull request를 만든다.
review와 필수 검사가 끝난 뒤 `dev`에 병합한다.

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

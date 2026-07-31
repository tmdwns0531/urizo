# Prisma Run·Trace baseline

`schema.prisma`는 v0.6·v0.7의 선택형 Live persistence 계약이다. 활성 모델은
`RecommendationRun`과 `AgentTrace`뿐이다. 자격 증명 없는 기본 Demo는 memory
repository를 사용하며 Prisma client를 import하거나 DB 환경 변수를 검사하지
않아야 한다.

## 저장 경계

- Run ID는 application이 발급한 `run_<UUID>` 문자열이다.
- Trace ID는 application이 발급한 `trace_<UUID>` 문자열이다.
- `requestSnapshot`은 구조화되고 정제된 CHOICE/search input만 저장한다.
- 연속 실행에는 64차원 numeric query vector와 SHA-256 fingerprint를 쓴다.
- `responseSnapshot`에는 공개 Trace를 포함하지 않는다.
- 승인과 교체의 동시 갱신은 `revision` compare-and-set repository 계약으로
  처리한다.
- Trace는 append-only이며 repository가 Run별 `sequence`를 할당한다.
- fallback reason과 error code는 TypeScript allowlist를 통과한 값만 저장한다.

사용자 relation, 자연어 원문, token, matched terms, prompt, secret,
engagement, catalog 데이터는 저장하지 않는다.

## 개발 규칙

1. Prisma Run 또는 Trace store를 명시적으로 선택한 경우에만
   `DATABASE_URL`과 `DIRECT_URL`을 개인 secret 저장소에서 제공한다.
2. migration 파일에는 connection string이나 자격 증명을 넣지 않는다.
3. 이 저장소에서 외부 DB에 migration을 적용하지 않는다.
4. 기본 Demo composition에서 `@prisma/client`를 import하지 않는다.

## 자격 증명 없는 schema 검증

`npm run db:validate`는 `scripts/prisma-validate.mjs`를 통해 validation 전용
loopback URL을 Prisma CLI 자식 프로세스에만 주입한다. `prisma validate`는
PostgreSQL에 연결하지 않으며, loopback port 1을 사용하므로 외부 DB를
가리키지 않는다. 이 값은 application process나 `.env.local`에 저장되지
않는다.

실제 application에서 `runStore=prisma` 또는 `traceStore=prisma`를 선택하면
`validateSelectedMvpAdapters`가 호출자가 제공한 진짜 `DATABASE_URL`과
`DIRECT_URL`을 계속 요구한다. validation 전용 URL은 runtime adapter 설정의
대체값이 아니다.

ERD는 [`docs/ERD-v0.7-baseline.md`](../docs/ERD-v0.7-baseline.md)를 참조한다.
`sql/pgvector.sql`은 보류된 구 확장 자료이며 이 baseline migration에 포함하지
않는다.

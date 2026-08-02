# OTT 다모아 LIVE v0.8 ERD + v0.9 Run lifecycle extension

v0.8은 accepted v0.7 migration을 수정하지 않고 비식별 Run·Trace lifecycle staging을
비파괴적으로 보완하며 LIVE catalog 검색에 필요한 네 모델을 추가한다. User, Auth,
Profile, Subscription, Engagement 관계는 만들지 않는다.

```text
CatalogContent 1 --- N ProviderAvailability
CatalogContent 1 --- N ContentSearchDocument
ContentSearchDocument 1 --- N ContentEmbedding
RecommendationRun 1 --- N AgentTrace
```

## CatalogContent

- `id`: application ID, `varchar(64)` primary key
- `tmdbId + mediaType`: unique
- title, synopsis, runtimeMinutes, releaseYear, ageRating
- genres, moodTags, companionTags
- originCountries, productionCountries, optional collectionId
- voteAverage, voteCount, optional posterUrl, backdropColor, isActive
- runtime/year/vote 범위 check와 active/media index

## ProviderAvailability

- `contentId + provider`: composite primary key
- `watchUrl`, `linkType(DIRECT|SEARCH|HOME)`
- provider/content index, catalog cascade delete
- KR ingestion 결과만 적재하며 검증되지 않은 URL은 `DIRECT`로 표시하지 않는다.

## ContentSearchDocument

- `id`: `varchar(64)` primary key
- contentId, locale, documentText, SHA-256 `contentHash`, isActive
- `contentId + contentHash`: unique
- partial unique index로 content별 active document를 하나만 허용
- catalog cascade delete

## ContentEmbedding

- `id`: `varchar(64)` primary key
- searchDocumentId, model, dimensions, `extensions.vector(1536)`
- `searchDocumentId + model`: unique
- dimensions는 check constraint로 1536만 허용
- HNSW cosine index, search document cascade delete

## RecommendationRun / AgentTrace

v0.7 공개 DTO와 status enum을 유지한다. v0.8 migration은 Trace sequence 할당용
`nextTraceSequence`를 추가하고, 외부 실행 전 `RUNNING` 생성을 위해
`executionMode`, `inputFingerprint`, `queryVector`의 DB null을 허용한다.
v0.9에서 `AWAITING_APPROVAL`은 두 shape으로 나뉜다. 검색 전
`FAMILY_COMPOSITION`은 status에 맞는 response JSON을 가지되 `executionMode`,
`inputFingerprint`, `queryVector`가 모두 null이다. 검색 후 `RUNTIME_RELAXATION`과
`COMPLETED`에는 세 필드가 모두 materialize되어야 한다. `FAILED`는 response를 두지
않고 allowlist `errorCode`와 `completedAt`을 가진다. DB lifecycle CHECK가 이 상태
shape을 강제한다. Run CAS와 해당 Trace batch는 하나의 transaction이다.

## Migration rules

- `20260731090000_v07_run_trace_baseline`은 수정하지 않는다.
- `20260731160000_v08_live_catalog_vector`는 catalog/vector를 추가하고 Run staging nullability·lifecycle CHECK를 비파괴적으로 적용한다.
- `20260802090000_v09_bounded_agent_multiturn`은 FAMILY/RUNTIME 승인 shape으로
  lifecycle CHECK를 교체한다. 기존 파일은 수정하지 않는다.
- `20260803062000_v09_lifecycle_shape_atomic_hardening`은 같은 CHECK를 명시적
  transaction 안에서 원자적으로 재정립하고 nullable JSON predicate를 fail closed한다.
  단, 앞선 v0.9 migration의 실패 구간을 소급 원자화하지는 못한다.
- pgvector extension은 `extensions` schema에 설치한다.
- raw TMDB payload, raw OpenAI response, 자연어 원문, prompt, token, secret은
  저장하지 않는다.
- Prisma schema, migration SQL, repository mapper, 이 문서는 같은 계약을
  유지해야 한다.

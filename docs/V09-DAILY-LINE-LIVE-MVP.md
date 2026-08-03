# v0.9 오늘의 한줄 LIVE MVP

## 목적과 범위

메인 화면의 작은 사이드 카드에서 서울의 현재 날씨와 LIVE 카탈로그를
바탕으로 작품 한 편을 보여준다. 현재는 시청 경험 기반 학습 데이터셋이
없으므로 별도 임베딩 문서, 벡터 테이블, pgvector 인덱스 또는 검색 RAG를
추가하지 않는다.

이 기능은 기존 메인 추천 RAG와 독립된 `daily-line-live` vertical이다. Vinext의
RSC 렌더 경계에서 Prisma I/O를 수행하지 않고, 입력 없는 읽기 전용
`GET /api/daily-line`이 서버 composition을 호출한다. 이 endpoint는 후보나 검색
정보를 노출하지 않고 검증된 최종 카드 DTO만 반환한다.

## 요청 시 흐름

1. Open-Meteo에서 서울 고정 좌표의 현재 날씨를 조회하고 정규화한다.
2. Prisma 카탈로그에서 활성 작품을 읽는다.
3. 기존 anonymous MVP 최종 정책으로 `18`, `UNKNOWN`, 국내 제공 OTT가 없는
   작품을 제거한다.
4. TMDB 평점·평가 수를 기본 품질 신호로 쓰고 장르·미디어 형식·컬렉션
   중복 감점을 적용해 최대 24개 후보로 제한한다.
5. OpenAI Responses API에는 정규화된 날씨와 제한된 후보 사실만 전달한다.
6. 모델은 strict JSON Schema 안에서 allowlist 작품 ID와 문장 톤만 고른다.
7. 서버가 현재 canonical 작품을 다시 조회하고 정책을 재검사한 뒤, 검증된
   제목·날씨·톤으로 한 줄을 조립한다.
8. 날씨와 최종 판단은 process-local TTL cache에 저장한다.
9. 홈의 client slot은 최종 DTO만 받아 카드로 렌더링한다. query string은
   거부한다.

모델에는 synopsis, watch URL, poster URL, 원본 날씨 응답을 보내지 않는다.
모델이 자유문이나 작품 사실을 생성하지 않으므로 한 줄의 제목과 날씨
근거는 서버가 보장한다. 브라우저 응답에도 후보 ID, synopsis, watch URL,
prompt 또는 token을 포함하지 않는다.

## 캐시와 실패 처리

- 서울 날씨: 10분 TTL, 갱신 실패 시 최대 60분 stale-if-error
- 작품 판단: 30분 TTL, 최대 32개 키
- 키: KST 날짜 + 날씨 상태 + 온도 구간 + 시간대
- 동일 키 동시 miss: 한 Promise로 합쳐 외부 호출을 한 번만 수행
- 캐시 hit: `catalog.getById`와 anonymous 최종 정책을 다시 검사
- 날씨 실패: OpenAI를 호출하지 않고 날짜 기반 안전 fallback
- OpenAI timeout, 모델 오류, allowlist 밖 ID: 상위 안전 후보에서 결정적
  fallback
- DB 오류 또는 안전 후보 0개: API는 sanitized 503만 반환하고 카드만
  unavailable 상태로 렌더링하며 홈은 계속 제공

캐시는 비개인화된 날씨·작품 ID·톤만 다룬다. 자연어 원문, prompt, raw model
output, token, secret, 회원 identity, Run/Trace는 저장하지 않는다. 다중 서버
인스턴스 사이에서 공유되는 캐시가 아니라 이번 사이드 MVP용 best-effort
메모리 캐시다.

## 실행 프로필과 환경

- Demo: fixture catalog + 고정 Demo 날씨 + deterministic fallback. 자격증명과
  외부 네트워크가 필요 없다.
- LIVE: Prisma catalog + Open-Meteo + OpenAI selector.
- 기존 `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_GENERATION_MODEL`을 재사용한다.
- 선택 설정: `DAILY_LINE_WEATHER_ENDPOINT`, `DAILY_LINE_WEATHER_API_KEY`.

기본 Open-Meteo endpoint는 로컬/비상업 개발 검증용이다. Open-Meteo 데이터
출처를 카드에 표시한다. 광고를 포함한 상업 배포 전에는
[공식 라이선스·요금 조건](https://open-meteo.com/en/terms)을 확인하고 유료
고객 endpoint 및 API key를 설정해야 한다. 필드와 weather code 정의는
[Open-Meteo Forecast API 문서](https://open-meteo.com/en/docs)를 따른다.

## 비범위

- 별도 weather-content 임베딩 데이터셋과 벡터 인덱스
- 사용자 위치 수집 또는 브라우저 geolocation
- 로그인, Profile, MY, saved, watched, backend not-interested
- 공개 `/api/search` 또는 daily-line 후보·검색 결과 노출
- Prisma schema 변경과 migration
- 기존 메인 추천의 검색·랭킹·selector 변경

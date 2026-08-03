# v0.9.1 contextual curator MVP

## Product role

`모아`는 우측 하단에서 열리는 익명 대화형 AI 큐레이터다.

- `/choice`: 사용자가 이미 아는 조건을 직접 고르는 흐름
- `/prompt`: 사용자가 이미 정리한 요구를 한 문장으로 보내는 흐름
- `모아`: 원하는 것을 아직 모르거나 미묘한 상황·기분·이미지 단서를 대화로
  발견하고, 안전한 추천 조건을 함께 만드는 흐름

작품 비교, 리뷰 추천, 오늘의 자동 추천, 로그인·프로필·이력·MBTI는 이 MVP에
포함하지 않는다.

## Acceptance

- 모든 주요 화면에서 launcher를 열 수 있다.
- 데스크톱은 약 384px 패널, 모바일은 최대 86dvh 하단 시트다.
- Escape, focus trap, focus 복귀, `aria-modal`, 44px 조작 영역을 제공한다.
- 대화는 최대 6턴이다. 전체 이력은 브라우저 메모리에만 두고, 현재 발화와 선택
  이미지는 조건 분석 요청 동안만 일시 전송한다.
- JPG/PNG/WebP 1장으로 색감·분위기·배경·장르 단서를 보탤 수 있다.
- 파일 선택, 클립보드 붙여넣기, 패널 드래그앤드롭을 지원하며 첨부 준비 상태와
  전송된 이미지 썸네일을 대화 안에서 확인할 수 있다.
- 이미지에서 사람의 신원이나 민감한 속성을 추론하지 않는다.
- 추천 전 구조화 조건을 보여주고 사용자가 CTA로 명시적으로 확정한다.
- 앞선 턴에서 확정된 연령·OTT·시간·국가·형식·필수/제외 조건은 현재 발화에
  명시적인 수정 단서가 없으면 모델 출력이 완화할 수 없다.
- CTA는 기존 `POST /api/recommendations`만 호출한다.
- 큐레이터는 `/api/search`를 추가하거나 작품 ID를 선택하지 않는다.
- Demo는 자격증명 없이 동작한다.
- LIVE의 OpenAI timeout·provider 오류·invalid output은 결정론 대화로 fallback한다.

## Privacy and limits

| Item | Limit / behavior |
|---|---|
| current message | 500 Unicode code points |
| search query handoff | 140 Unicode code points |
| conversation | 6 turns |
| selected source image | 5MB in browser |
| derived upload | 2MB after EXIF-removing JPEG conversion |
| API request | 3,000,000 UTF-8 bytes |
| OpenAI calls | at most 1 per turn, `store: false` |
| OpenAI timeout | 12 seconds |

서버는 전체 대화 이력을 받지 않는다. 각 요청은 현재 발화, 이전 서버 응답의
allowlisted 구조화 state, 선택적 이미지 1장만 포함한다. 응답과 오류에는 이미지,
Base64, provider 원문, prompt, secret을 포함하지 않는다. 최종 handoff는 기존 추천
validator를 다시 통과해야 하며, 그 뒤에도 기존 provider/runtime/origin/age/genre
필터와 final policy가 동일하게 적용된다.

턴별 모델 호출과 입력 크기는 제한하지만, client state의 6턴 상한은 배포 환경의
rate limit을 대신하지 않는다. 공개 상용 배포 전에는 원문이나 IP를 애플리케이션 DB에
저장하지 않는 edge rate limit을 별도로 적용한다.

# API 계약 점검표

이 문서는 프론트엔드가 기대하는 필드와 서버가 실제로 반환하는 필드를 맞춰 보기 위한 API 계약 리뷰 템플릿이다.

## 공통 확인 기준

- 성공 응답과 실패 응답을 분리해서 기록한다.
- 실패 응답에는 가능한 한 `requestId`가 포함되어야 한다.
- 브라우저 응답에 외부 API 원문, `raw`, `debug`, `detail`, `e.message`, stack trace가 노출되는지 확인한다.
- 프론트에서 쓰는 필드명과 서버 응답 필드명이 다르면 별도 이슈로 남긴다.

## API별 점검표

| API | 요청 파라미터 | 서버 응답 필드 | 프론트 기대 필드 | 불일치 여부 | 에러 응답 형태 | requestId 포함 여부 | raw/debug/e.message/detail 노출 여부 | 관련 테스트 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/config` |  |  |  |  |  |  |  |  |
| `/api/fetch` |  |  |  |  |  |  |  |  |
| `/api/analyze` |  |  |  |  |  |  |  |  |
| `/api/date/recommendations` |  |  |  |  |  |  |  |  |
| `/api/onbid/items` |  |  |  |  |  |  |  |  |
| `/api/onbid/detail` |  |  |  |  |  |  |  |  |
| `/api/location/geocode` |  |  |  |  |  |  |  |  |
| `/api/molit/trades` |  |  |  |  |  |  |  |  |
| `/api/molit/apt-trades` |  |  |  |  |  |  |  |  |
| `/api/health` |  |  |  |  |  |  |  |  |

## 우선 의심 지점

| 지점 | 확인할 내용 | 결과 |
| --- | --- | --- |
| `/api/analyze` | `result`와 `report` 중 프론트가 실제로 기대하는 필드가 무엇인지 확인 |  |
| `/api/fetch` | `rawApis` 또는 `debug` 성격의 원문 데이터가 브라우저에 노출되는지 확인 |  |
| `/api/onbid/items` | 프론트 요청 파라미터와 서버가 읽는 파라미터가 일치하는지 확인 |  |
| `/api/onbid/detail` | 상세 조회 파라미터와 프론트 필드명이 일치하는지 확인 |  |
| 온비드 에러 응답 | `detail`, `e.message`, 외부 API 원문이 사용자 응답에 포함되는지 확인 |  |

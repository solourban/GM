# API 계약 점검표

이 문서는 프론트엔드가 기대하는 API 계약과 서버 응답 계약을 맞추기 위한 리뷰 표다. 실제 구현 변경 전 요청 파라미터, 응답 필드, 에러 형식, 민감 정보 노출 여부를 먼저 확인한다.

## 공통 확인 항목

- 요청 파라미터가 프론트와 서버에서 같은 이름과 형식인지 확인한다.
- 서버 응답 필드와 프론트 기대 필드가 일치하는지 확인한다.
- 실패 응답에 `requestId`가 포함되는지 확인한다.
- `raw`, `debug`, `e.message`, `detail`, stack trace가 사용자 응답으로 노출되지 않는지 확인한다.
- 관련 테스트가 있으면 먼저 실행하고, 없으면 계약 보호 테스트를 추가한다.

## API별 점검표

| API endpoint | 요청 파라미터 | 서버 응답 필드 | 프론트 기대 필드 | 불일치 여부 | 에러 응답 형태 | requestId 포함 여부 | raw/debug/e.message/detail 노출 여부 | 관련 테스트 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/config | 없음 | hasKakaoRest, hasKakaoMap, hasMolit | 같은 boolean 필드 | 추후 확인 | `{ ok:false, error, requestId }` 기대 | 추후 확인 | 키 원문 노출 금지 | tests/server-security.test.js |
| /api/fetch | court, year, caseNo 등 | 추후 확인 | 추후 확인 | rawApis/debug 노출 가능성 점검 | 추후 확인 | 추후 확인 | 특히 점검 | tests/fetch-response-sanitization.test.js |
| /api/analyze | 사건 기본 정보 또는 fetch 결과 | result 또는 report 계약 확인 필요 | result/report 기대 필드 확인 필요 | 의심 지점 | 추후 확인 | 추후 확인 | detail 노출 금지 | tests/analyzer.test.js |
| /api/date/recommendations | court, date, region 등 | recommendations 계열 | 날짜 추천 UI 기대 필드 | 추후 확인 | 추후 확인 | 추후 확인 | 노출 금지 | tests/date-recommendations-regression.test.js |
| /api/onbid/items | 검색 조건 | items 목록 | 온비드 탭 목록 필드 | 파라미터 불일치 의심 | 추후 확인 | 추후 확인 | detail/e.message 노출 가능성 점검 | tests/onbid-contract.test.js |
| /api/onbid/detail | item id 계열 | detail | 상세 카드 기대 필드 | 파라미터 불일치 의심 | 추후 확인 | 추후 확인 | detail/e.message 노출 가능성 점검 | tests/onbid-contract.test.js |
| /api/location/geocode | address | lat, lng, address 계열 | 지도 카드 기대 필드 | 추후 확인 | sanitizing 필요 | 추후 확인 | e.message 노출 금지 | tests/server-security.test.js |
| /api/molit/trades | 지역, 기간, 면적 등 | trades 목록 | 실거래가 카드 기대 필드 | 추후 확인 | 추후 확인 | 추후 확인 | raw 노출 금지 | tests/external-api-proxy.test.js |
| /api/molit/apt-trades | 아파트 실거래 조건 | trades 목록 | 아파트 실거래 UI 기대 필드 | 추후 확인 | 추후 확인 | 추후 확인 | raw 노출 금지 | tests/external-api-proxy.test.js |
| /api/health | 없음 | ok/status 계열 | 상태 확인 | 추후 확인 | 추후 확인 | 추후 확인 | 민감 정보 금지 | 추후 확인 |

## 우선 의심 지점

- `/api/analyze`의 `result`와 `report` 응답 계약 불일치 가능성
- `/api/fetch`의 `rawApis` 또는 `debug` 노출 가능성
- 온비드 `items`와 `detail`의 프론트-서버 파라미터 불일치 가능성
- 온비드 에러 응답의 `detail` 또는 `e.message` 노출 가능성

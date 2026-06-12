# API 계약 점검표

기준일: 2026-06-12

현재 서버 라우트 기준으로 점검했습니다. 지시서에 적힌 `/api/date/recommendations`와 `/api/molit/apt-trades`는 현재 서버에 그대로 존재하지 않으며, 실제 구현은 각각 `/api/recommendations/by-date`, `/api/molit/trades`입니다.

## 계약 표

| API endpoint | 요청 파라미터 | 서버 응답 필드 | 프론트 기대 필드 | 불일치 여부 | 에러 응답 형태 | requestId 포함 여부 | raw/debug/e.message/detail 노출 여부 | 관련 테스트 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/config` | 없음 | `ok`, `hasKakaoRest`, `hasKakaoMap`, `hasMolit`, `hasOnbid`, `envNames`, `requestId` | service-status, location, onbid가 `has*`와 `envNames` 사용 | 큰 불일치 없음 | 일반 JSON errorBody 아님, 정상 route | 예 | 실제 key 값 미노출. env var 이름만 노출 | `server-security`, `external-api-proxy` |
| `/api/health` | 없음 | `ok`, `service`, `version`, `startedAt`, `uptimeSeconds`, `timestamp`, `requestId` | service-status가 health/config 동시 조회 | 큰 불일치 없음 | 공통 404/500 외 없음 | 예 | 내부 stack 미노출 | `renewal-regression` |
| `/api/fetch` | POST JSON `jiwonNm`, `saYear`, `saSer` | `ok`, `raw`, `elapsed`, `requestId` | core/bulk가 `data.raw`, `data.elapsed`, `data.error` 기대 | 해결됨 | `errorBody(req, '사건 조회 중 오류가 발생했습니다.')` | 예 | `rawApis`, `debug`, `_internalCsNo` 제거. catch에서 `e.message` 미노출 | `fetch-response-sanitization` |
| `/api/analyze` | POST JSON. core는 `{ raw, manual, region }`로 호출하고 bridge가 raw-like payload로 변환 | `ok`, `result`, `requestId` | core는 `data.report` 기대. analyze-bridge가 `report: result`를 추가 | 부분 불일치 남음 | `errorBody(req, '분석 중 오류가 발생했습니다.')` | 예 | `detail/e.message` 미노출 | `analyzer` |
| `/api/date/recommendations` | 지시서상 endpoint | 현재 route 없음 | 현재 프론트 사용 없음 | 문서명 불일치 | 404 공통 errorBody | 예 | 미해당 | 없음 |
| `/api/recommendations/by-date` | GET query `court`, `start`, `end`, `usage`, `maxBidRate`, `limit` | `ok`, `verified`, `court`, `start`, `end`, `count`, `items`, `debug`, `requestId` 또는 error | date 탭이 `data.items`, `data.court`, `data.start`, `data.end`, `data.error` 기대 | endpoint 이름만 지시서와 불일치 | 실패 시 `{ ...result, requestId }` 또는 generic 500 | 예 | `debug` 포함. 내부 attempt/error 축소 검토 필요 | `date-recommendations-regression` |
| `/api/onbid/items` | GET `keyword`/`query`, `lctnSdnm`/`sido`, `lctnSggnm`/`signgu`, `bidPrdYmdStart`, `bidPrdYmdEnd`, `pageNo`, `numOfRows` | `ok`, `count`, `totalCount`, `pageNo`, `numOfRows`, `items`, `requestId` | onbid 탭이 `items`, `totalCount`, `requestId` 기대 | 기존 의심 해결됨 | `errorBody(req, '온비드 목록 조회 중 오류가 발생했습니다.')` | 예 | `e.message/detail` 미노출. `numOfRows` 1-20 제한 | `onbid-contract`, `onbid-proxy` |
| `/api/onbid/detail` | GET `cltrNo`/`cltrMngNo`, `plnmNo`, `pbctNo`/`pbctCdtnNo` | `ok`, `count`, `item`, `detail`, `items`, `requestId` | onbid 탭이 `data.detail || data.item` 기대 | 기존 의심 해결됨 | `errorBody(req, '온비드 상세 조회 중 오류가 발생했습니다.')` | 예 | `e.message/detail` 미노출 | `onbid-contract`, `onbid-result-layout` |
| `/api/location/geocode` | GET `address` | `ok`, `query`, `count`, `documents`, `meta`, `requestId` | location이 `documents[0]`와 `meta` 기대 | 큰 불일치 없음 | generic 500. upstream 오류는 `upstream` diagnostic 포함 | 예 | key 미노출. upstream `message`는 180자로 제한 | `server-security`, `location-map-card` |
| `/api/kakao/maps-sdk.js` | 없음 | JavaScript loader | location이 script src로 사용 | 큰 불일치 없음 | key 없으면 JS Error text | 아니오(JSON 아님) | JS key는 서버 upstream 요청에만 사용. loader JS 안에는 upstream URL이 포함됨 | `server-security`, `location-map-card` |
| `/api/molit/trades` | GET `lawdCd`, `dealYmd`, `aptName`, `tradeType` | `ok`, `lawdCd`, `dealYmd`, `aptName`, `tradeTypes`, `rawCount`, `count`, `trades`, `requestId` | molit가 `trades`, `tradeTypes`, `count`, `rawCount` 기대 | 큰 불일치 없음 | generic 500 | 예 | 유형별 catch가 `tradeTypes.error = e.message`로 노출 가능. fetch timeout 없음 | `external-api-proxy` |
| `/api/molit/apt-trades` | 지시서상 endpoint | 현재 route 없음 | 현재 프론트 사용 없음 | route 없음 | 404 공통 errorBody | 예 | 미해당 | 없음 |

## 의심 지점 상태

| 의심 지점 | 현재 상태 | 판단 | 다음 조치 |
| --- | --- | --- | --- |
| `/api/analyze` `result/report` 불일치 | 서버는 `result`, 브라우저 bridge는 `report` 보정 | 부분 해결 | API 원계약을 `report`까지 포함할지 결정 |
| `/api/fetch` `rawApis/debug` 노출 가능성 | `sanitizeFetchCaseResult`가 `rawApis`, `debug`, `_internalCsNo` 제거 | 해결 | 테스트 유지 |
| 온비드 items/detail 파라미터 불일치 | 서버가 `keyword/lctnSdnm/lctnSggnm/cltrMngNo/pbctCdtnNo` alias 수용 | 해결 | 테스트 유지 |
| 온비드 에러 `detail/e.message` 노출 | catch는 generic errorBody만 반환 | 해결 | 테스트 유지 |
| 매각기일 endpoint 명칭 | 실제 route는 `/api/recommendations/by-date` | 문서/명칭 불일치 | rename 또는 호환 route 추가 검토 |
| 매각기일 `debug` 노출 | 성공/실패 result에 `debug` 포함 | 남음 | 운영 응답에서 debug 제거 또는 admin flag 처리 |
| MOLIT `e.message` 노출 | 유형별 부분 실패가 `tradeTypes.error`에 포함 가능 | 남음 | 사용자 메시지 일반화 검토 |

## 우선순위

1. `/api/analyze` 서버 응답에 `report` alias를 직접 추가할지 결정한다.
2. `/api/recommendations/by-date`의 `debug` 응답을 운영에서 제거할지 결정한다.
3. `/api/date/recommendations` 호환 route가 필요한지 결정한다.
4. MOLIT 부분 실패 메시지를 사용자용 안전 문구로 줄인다.

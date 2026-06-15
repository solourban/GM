# API 계약 점검표

기준일: 2026-06-15

현재 서버 라우트 기준으로 점검했습니다. 지시서에 적힌 `/api/date/recommendations`는 `/api/recommendations/by-date`와 같은 shared handler를 사용하는 호환 route로 제공하며, `/api/molit/apt-trades`도 `/api/molit/trades`와 같은 shared handler를 사용하는 아파트 전용 호환 route로 제공합니다.

## 계약 표

| API endpoint | 요청 파라미터 | 서버 응답 필드 | 프론트 기대 필드 | 불일치 여부 | 에러 응답 형태 | requestId 포함 여부 | raw/debug/e.message/detail 노출 여부 | 관련 테스트 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/config` | 없음 | `ok`, `hasKakaoRest`, `hasKakaoMap`, `hasMolit`, `hasOnbid`, `envNames`, `requestId` | service-status, location, onbid가 `has*`와 `envNames` 사용 | 큰 불일치 없음 | 일반 JSON errorBody 아님, 정상 route | 예 | 실제 key 값 미노출. env var 이름만 노출 | `server-security`, `external-api-proxy` |
| `/api/health` | 없음 | `ok`, `service`, `version`, `startedAt`, `uptimeSeconds`, `timestamp`, `requestId` | service-status가 health/config 동시 조회 | 큰 불일치 없음 | 공통 404/500 외 없음 | 예 | 내부 stack 미노출 | `renewal-regression` |
| `/api/fetch` | POST JSON `jiwonNm`, `saYear`, `saSer` | `ok`, `raw`, `elapsed`, `requestId` | core/bulk가 `data.raw`, `data.elapsed`, `data.error` 기대 | 해결됨 | `errorBody(req, '사건 조회 중 오류가 발생했습니다.')` | 예 | `rawApis`, `debug`, `_internalCsNo` 제거. catch에서 `e.message` 미노출 | `fetch-response-sanitization` |
| `/api/analyze` | POST JSON. core는 `{ raw, manual, region }`로 호출하고 bridge가 raw-like payload로 변환 | `ok`, `result`, `report`, `requestId` | core는 `data.report` 기대. 서버가 직접 `report: result` alias 제공 | 해결됨 | `errorBody(req, '분석 중 오류가 발생했습니다.')` | 예 | `detail/e.message` 미노출 | `analyzer`, `api-contract-hardening` |
| `/api/date/recommendations` | GET query `court`, `start`, `end`, `usage`, `maxBidRate`, `limit` | `ok`, `verified`, `court`, `start`, `end`, `count`, `items`, `requestId` 또는 error | 현재 프론트는 직접 사용하지 않지만 지시서/외부 문서 호환용 | 해결됨. `/api/recommendations/by-date`와 같은 shared handler 사용 | 실패 시 public result + `requestId` 또는 generic 500 | 예 | `debug`는 public response에서 제거 | `api-contract-hardening` |
| `/api/recommendations/by-date` | GET query `court`, `start`, `end`, `usage`, `maxBidRate`, `limit` | `ok`, `verified`, `court`, `start`, `end`, `count`, `items`, `requestId` 또는 error | date 탭이 `data.items`, `data.court`, `data.start`, `data.end`, `data.error` 기대 | 해결됨. 현재 프론트 canonical endpoint | 실패 시 public result + `requestId` 또는 generic 500 | 예 | `debug`는 public response에서 제거 | `date-recommendations-regression`, `api-contract-hardening` |
| `/api/onbid/items` | GET `keyword`/`query`, `lctnSdnm`/`sido`, `lctnSggnm`/`signgu`, `bidPrdYmdStart`, `bidPrdYmdEnd`, `pageNo`, `numOfRows` | `ok`, `count`, `totalCount`, `pageNo`, `numOfRows`, `keyword`, `items`, `requestId` | onbid 탭이 `items`, `totalCount`, `requestId` 기대 | 기존 의심 해결됨. `keyword`는 upstream `onbidCltrNm`으로 전달 | `errorBody(req, '온비드 목록 조회 중 오류가 발생했습니다.')` | 예 | `e.message/detail` 미노출. `numOfRows` 1-20 제한 | `onbid-contract`, `onbid-proxy` |
| `/api/onbid/detail` | GET `cltrNo`/`cltrMngNo`, `plnmNo`, `pbctNo`/`pbctCdtnNo` | `ok`, `count`, `item`, `detail`, `items`, `requestId` | onbid 탭이 `data.detail || data.item` 기대 | 기존 의심 해결됨 | `errorBody(req, '온비드 상세 조회 중 오류가 발생했습니다.')` | 예 | `e.message/detail` 미노출 | `onbid-contract`, `onbid-result-layout` |
| `/api/location/geocode` | GET `address` | `ok`, `query`, `count`, `documents`, `meta`, `requestId` | location이 `documents[0]`와 `meta` 기대 | 큰 불일치 없음 | generic 500. upstream 오류는 `upstream` diagnostic 포함 | 예 | key 미노출. upstream `message`는 180자로 제한 | `server-security`, `location-map-card` |
| `/api/kakao/maps-sdk.js` | 없음 | JavaScript loader | location이 script src로 사용 | 큰 불일치 없음 | key 없으면 JS Error text | 아니오(JSON 아님) | JS key는 서버 upstream 요청에만 사용. loader JS 안에는 upstream URL이 포함됨 | `server-security`, `location-map-card` |
| `/api/molit/trades` | GET `lawdCd`, `dealYmd`, `aptName`, `tradeType` | `ok`, `lawdCd`, `dealYmd`, `aptName`, `tradeTypes`, `rawCount`, `count`, `trades`, `requestId` | molit가 `trades`, `tradeTypes`, `count`, `rawCount` 기대 | 큰 불일치 없음 | generic 500 | 예 | 유형별 부분 실패도 사용자용 일반 문구만 노출. upstream 호출은 12초 타임아웃 적용 | `external-api-proxy`, `api-contract-hardening` |
| `/api/molit/apt-trades` | GET `lawdCd`, `dealYmd`, `aptName` | `ok`, `lawdCd`, `dealYmd`, `aptName`, `tradeTypes`, `rawCount`, `count`, `trades`, `requestId` | 현재 프론트 사용 없음. 지시서/외부 문서 호환용 | 해결됨. `/api/molit/trades` shared handler를 사용하되 `tradeType: apt`로 고정 | generic 500 | 예 | 유형별 부분 실패도 사용자용 일반 문구만 노출. upstream 호출은 12초 타임아웃 적용 | `external-api-proxy`, `api-contract-hardening`, `renewal-regression` |

## 의심 지점 상태

| 의심 지점 | 현재 상태 | 판단 | 다음 조치 |
| --- | --- | --- | --- |
| `/api/analyze` `result/report` 불일치 | 서버가 `result`와 `report`를 함께 반환 | 해결 | bridge는 하위호환 보정으로 유지 |
| `/api/fetch` `rawApis/debug` 노출 가능성 | `sanitizeFetchCaseResult`가 `rawApis`, `debug`, `_internalCsNo` 제거 | 해결 | 테스트 유지 |
| 온비드 items/detail 파라미터 불일치 | 서버가 `keyword/lctnSdnm/lctnSggnm/cltrMngNo/pbctCdtnNo` alias 수용 | 해결 | 테스트 유지 |
| 온비드 에러 `detail/e.message` 노출 | catch는 generic errorBody만 반환 | 해결 | 테스트 유지 |
| 매각기일 endpoint 명칭 | `/api/recommendations/by-date`와 `/api/date/recommendations`가 같은 shared handler 사용 | 해결 | 프론트 canonical endpoint는 현행 유지 |
| 매각기일 `debug` 노출 | 서버 route가 `publicDateRecommendationResult`로 `debug` 제거 | 해결 | 테스트 유지 |
| MOLIT `e.message` 노출 | 유형별 부분 실패는 일반 문구로 반환하고 실제 오류는 서버 로그에 기록 | 해결 | 테스트 유지 |
| MOLIT fetch timeout | upstream 유형별 호출에 `AbortController` 12초 타임아웃 적용 | 해결 | 프론트 월별 재시도 흐름 유지 |
| MOLIT `/api/molit/apt-trades` 호환 route | `/api/molit/trades`와 같은 shared handler를 사용하고 `tradeType: apt`로 고정 | 해결 | 외부 문서/호환 링크용으로 유지 |

## 우선순위

1. 현재 `index.html`에서 로드하지 않는 legacy patch 파일을 광고 심사 전 정리 대상으로 분리한다.
2. loaded v2 파일 중 정적 템플릿 중심 파일은 UI 회귀 테스트와 함께 낮은 우선순위로 유지한다.

# 경매 서비스 개선 v2 전수 리뷰표

기준 커밋: `b2d7441 Separate tab results from input panels`

이 문서는 수정 전 리뷰 산출물이다. 실제 로드되는 v2 파일과 서버/API 계약을 우선 검토했고, `public`에 남아 있는 미로드 legacy/patch 파일은 별도 정리 대상으로 분리했다.

## 1. 전체 파일 전수 리뷰표

### 1-1. 서버

| 파일 | 역할 | 주요 API/계약 | 위험도 | 메모 |
|---|---|---|---|---|
| `src/server.js` | Express 서버, API 프록시, 보안 헤더, rate limit | `/api/config`, `/api/fetch`, `/api/analyze`, `/api/location/geocode`, `/api/molit/trades`, `/api/onbid/*` | P0 | `/api/fetch` raw sanitization, 온비드 계약/에러 detail 노출, MOLIT timeout 부재 |
| `src/crawler.js` | 법원경매정보 직접 API 호출/정규화 | `fetchCase`, `listCourts` | P0 | `rawApis`, `debug`, 내부 `_internalCsNo`를 결과 객체에 포함 |
| `src/dateRecommendations.js` | 매각기일 목록 추천/법원 검증 | `findAuctionsByDate` | P1 | `debug` 포함 응답 가능. 기간/limit 제한은 추가 검토 필요 |
| `src/analyzer.js` | 권리분석 계산 | `analyzeCase` | P1 | 서버는 `result`, v2 코어는 `report` 기대. bridge가 보정하지만 API 계약은 불명확 |

### 1-2. 실제 로드되는 public v2 파일

| 파일 | 역할 | 생성/의존 DOM id | storage key | API | innerHTML | 위험도 |
|---|---|---|---|---|---:|---|
| `app-v2-request-id-bridge.js` | API 에러 requestId 표시 보정 | 없음 | 없음 | fetch patch | 0 | P1 |
| `app-v2-spec-extractor-parser.js` | 명세서 텍스트 후보 추출 parser | 없음 | 없음 | 없음 | 0 | P1 |
| `app-v2-core.js` | 상단 탭, 검색, 기본정보/Step2/권리분석 렌더 | `v2HomePanels`, `resultsSection`, `step2InputCard`, `analysisCard` | 없음 | `/api/courts`, `/api/fetch`, `/api/analyze` | 9 | P0 |
| `app-v2-analyze-bridge.js` | `/api/analyze` 요청/응답 bridge | 없음 | 없음 | `/api/analyze` | 0 | P0 |
| `app-v2-onbid-entry.js` | 온비드 탭/검색/상세 | `v2OnbidEntryPanel`, `v2OnbidResultArea`, `v2OnbidDetailCard` | 없음 | `/api/config`, `/api/onbid/items`, `/api/onbid/detail` | 1 | P0 |
| `app-v2-service-status.js` | 연동 상태 카드 | `v2ServiceStatusCard` | 없음 | `/api/health`, `/api/config` | 2 | P2 |
| `app-v2-validate.js` | Step2 분석 전 입력 경고 | `v2Step2GuardMessage`, `v2AnalyzeFailureKeepMessage` | 없음 | 없음 | 4 | P2 |
| `app-v2-allocation.js` | 배당 설명 카드 | `allocationExplainCard`, `analysisCard` | 없음 | 없음 | 1 | P2 |
| `app-v2-display-fix.js` | 분석/입찰 보조 카드 생성 | `v2BiddingSummaryCard`, `v2BidRangeCard`, `v2FundingReviewCard` | 없음 | 없음 | 1 | P1 |
| `app-v2-risk-brief.js` | 리스크 요약 | `v2RiskBriefCard` | 없음 | 없음 | 1 | P2 |
| `app-v2-copy-summary.js` | 복사용 판단 메모 | `v2CopySummaryCard` | bid/location/trade/candidate keys | 없음 | 1 | P1 |
| `app-v2-bid-plan.js` | 입찰가 간단 시뮬레이션 | `v2BidPlanCard`, `v2PlannedBidInput` | `auction-note:v2.2:bid-plan:` | 없음 | 1 | P0 |
| `app-v2-result-polish.js` | 결과 UI polish | 없음 | 없음 | 없음 | 2 | P2 |
| `app-v2-persist.js` | 사건별 Step2/분석 저장 | `v2PersistStatus`, `v2PersistResetBtn` | `auction-note:v2.2:case:` | 없음 | 0 | P1 |
| `app-v2-case-reset.js` | 사건 변경/현재 사건 초기화 | `v2CaseScopeNotice` | case/bid/spec/transient keys | 없음 | 1 | P1 |
| `app-v2-spec-extractor.js` | 명세서 붙여넣기 UI | `v2SpecExtractor*` | `auction-note:v2:spec-extraction:` | 없음 | 3 | P1 |
| `app-v2-property-types.js` | 물건종류 필터칩 | `v2PropertyTypeStyles` | 없음 | 없음 | 0 | P2 |
| `app-v2-date.js` | 매각기일 추천 입력/결과 | `v2DateResultCard`, `v2DateEmptyStateCard` | 없음 | `/api/recommendations/by-date` | 2 | P1 |
| `app-v2-date-source.js` | 날짜 후보 선택 안내/메모 | `v2DateSourceCard` | `selected-date-candidate`, memo prefix | 없음 | 2 | P1 |
| `app-v2-candidate-stack.js` | 임시 후보/랭킹/저장 승격 | `v2CandidateStackCard`, `v2CandidateRankingCard` | stack/saved/memo keys | 없음 | 2 | P1 |
| `app-v2-saved-tab.js` | 저장 후보 TOP 5 | `v2SavedTabControlsCard`, `v2SavedTabRuntimeCard` | saved/memo keys | 없음 | 2 | P1 |
| `app-v2-bulk-tab.js` | 여러 사건 일괄조회 | `v2BulkRuntimeCard`, `v2BulkResultCard` | bulk state/stack/saved keys | `/api/courts`, `/api/fetch` | 2 | P1 |
| `app-v2-location.js` | 카카오 주소/지도/주변시설 | `v2LocationCard` | `auction-note:v2:location-geocode` | `/api/location/geocode`, `/api/config`, `/api/kakao/maps-sdk.js` | 7 | P1 |
| `app-v2-molit-trades.js` | 국토부 실거래가 참고 | `v2MolitTradeCard` | location/trade keys | `/api/molit/trades` | 2 | P1 |
| `app-v2-final-judgment.js` | 최종 판단 | `v2FinalJudgmentCard` | final/location/trade keys | 없음 | 2 | P1 |
| `app-v2-external-checklist.js` | 외부검증 체크/메모 | `v2ExternalVerificationCard` | `auction-note:v2:external-verification:` | 없음 | 2 | P1 |
| `app-v2-confidence.js` | 판단 신뢰도 | `v2DecisionConfidenceCard` | final/location/trade keys | 없음 | 2 | P1 |
| `app-v2-case-sync-status.js` | 사건 동기화 상태 | `v2CaseSyncStatusCard` | case/transient keys | 없음 | 2 | P2 |
| `app-v2-final-copy-bridge.js` | 저장/복사 최종 메모 | `v2FinalCopyCard` | final/location/trade keys | 없음 | 2 | P1 |
| `app-v2-date-courts.js` | 매각기일 법원 select 보강 | `dateCourtV2`, `dateMessageV2` | 없음 | 없음 | 2 | P2 |
| `app-v2-workflow-shell.js` | 단계형 검토 쉘 | `v2WorkflowShell`, `v2WorkflowTabs` | 없음 | 없음 | 2 | P1 |
| `app-v2-essential-documents.js` | 필수문서 확인 카드 | `v2EssentialDocumentsCard` | 없음 | 공식 사이트 링크 | 1 | P1 |
| `app-v2-tab-scope-guard.js` | 탭별 카드 스코프 정리 | 후보/저장/서비스 카드 | 없음 | 없음 | 1 | P1 |
| `app-v2-positioning-copy.js` | 포지셔닝 안내 | `v2PositioningNote` | 없음 | 없음 | 0 | P2 |
| `app-v2-map-provider-guard.js` | 지도 제공자 문구 guard | `v2LocationCard` | 없음 | 없음 | 0 | P2 |
| `app-v2-result-order.js` | 결과 카드 순서 안정화 | `resultsSection` | 없음 | 없음 | 0 | P1 |

### 1-3. 테스트

| 파일 | 역할 | 위험도 |
|---|---|---|
| `analyzer.test.js` | 권리분석 계산 회귀 | P1 |
| `case-reset-safety.test.js` | 현재 사건 초기화 안전성 | P1 |
| `case-scope-regression.test.js` | 사건 A/B 데이터 분리 | P1 |
| `dependency-guard.test.js` | 의존성 추가 방지 | P1 |
| `external-api-proxy.test.js` | 외부 API 프록시/키 노출 guard | P1 |
| `external-checklist-regression.test.js` | 외부검증 카드 회귀 | P2 |
| `location-map-card.test.js` | 지도 카드/키 노출 guard | P1 |
| `onbid-proxy.test.js` | 온비드 라우트 존재 guard | P0 보강 필요 |
| `property-type-filters.test.js` | 물건종류 필터 guard | P2 |
| `public-scripts.test.js` | script 존재/순서 | P1 |
| `public-secrets.test.js` | public 비밀 노출 검사 | P1 |
| `renewal-regression.test.js` | v2 핵심 문구/구조 | P2 |
| `result-order-regression.test.js` | 결과 순서 guard | P1 |
| `server-security.test.js` | 서버 보안 header/config | P1 보강 필요 |
| `spec-extraction-*` | 명세서 추출 parser/UI | P1 |
| `tab-results-layout.test.js` | 초록/베이지 분리 guard | P1 |
| `tab-scope-guard.test.js` | 탭별 카드 스코프 guard | P1 |
| `workflow-shell-regression.test.js` | 단계형 shell | P1 |

### 1-4. 미로드 legacy/patch 파일

`index.html`에 로드되지 않는 legacy/patch JS가 다수 남아 있다. 직접 실행 위험은 낮지만, 검색/유지보수/보안 점검에서 잡음을 만든다. 삭제 전에는 참조 여부와 배포 히스토리를 확인해야 한다.

대표 예: `app.js`, `app-v2.js`, `app-v2-analyze.js`, `app-v2-candidates.js`, `*-patch.js`, `saved-cases.js`, `step1-enhance.js`.

## 2. 탭별 입력/결과 영역 배치표

| 영역 | 초록 영역 현재 | 베이지 결과 영역 현재 | 잘못 들어간 카드 | 이동 필요 | 수정 파일 |
|---|---|---|---|---|---|
| 물건 검색 | 법원/연도/사건번호/조회 | `resultsSection` 기본정보/분석/단계형 shell | 없음. 단, `v2DateSourceCard`는 최근 수정으로 결과 영역 이동됨 | 낮음 | `app-v2-core.js`, `app-v2-date-source.js` |
| 여러 사건 일괄조회 | 법원/사건 목록/실행/초기화 | `v2TabResultsSection` 결과표 | 없음 | 낮음 | `app-v2-bulk-tab.js` |
| 매각기일 추천 | 법원/기간/용도/조회 | `v2TabResultsSection` 빈 상태/결과/후보스택 | 없음 | 낮음 | `app-v2-date.js`, `app-v2-candidate-stack.js` |
| 저장 후보 TOP 5 | 제목/필터/안내 | `v2TabResultsSection` TOP 5 표 | 없음 | 낮음 | `app-v2-saved-tab.js` |
| 온비드 공매 | 검색 입력 + 현재 API 상태 | 없음 | `v2OnbidResultArea`가 입력 카드 내부 | 높음 P0 | `app-v2-onbid-entry.js`, `tests/onbid-result-layout.test.js` |
| 기본정보 단계 | 해당 없음 | workflow basic | 없음 | 낮음 | `app-v2-workflow-shell.js` |
| 내역입력 단계 | 해당 없음 | Step2/spec extractor | 없음 | 중간 | `app-v2-core.js`, `app-v2-spec-extractor.js` |
| 시세/입지 | 해당 없음 | location/molit | 없음 | 낮음 | `app-v2-location.js`, `app-v2-molit-trades.js` |
| 리스크 | 해당 없음 | analysis/risk/docs/external | 없음 | 낮음 | `app-v2-essential-documents.js`, `app-v2-external-checklist.js` |
| 입찰가 | 해당 없음 | bid summary/range/funding/checklist/bid plan | 계산표 부족 | 높음 P0 기능부족 | `app-v2-bid-plan.js` |
| 최종판단 | 해당 없음 | judgment/confidence | 입찰가 계산 요약 부족 | 중간 | `app-v2-final-judgment.js` |
| 저장/복사 | 해당 없음 | copy/final copy | 없음 | 낮음 | `app-v2-copy-summary.js`, `app-v2-final-copy-bridge.js` |

## 3. API 계약표

| API | 요청 파라미터 | 서버 응답 | 프론트 기대 | 불일치/위험 | 에러/requestId |
|---|---|---|---|---|---|
| `/api/config` | 없음 | key 존재 여부, envNames, requestId | hasKakao/hasMolit/hasOnbid | 실제 키 미노출 OK | OK |
| `/api/fetch` | `jiwonNm`, `saYear`, `saSer` | `{ ok, raw, elapsed, requestId }` | `raw.basic`, `raw.schedule`, `raw.interested` | `raw.rawApis`, `raw.debug`, `_internalCsNo` 노출 P0 | catch에서 `e.message` 노출 P0 |
| `/api/analyze` | 현재 bridge 후 raw-like payload | `{ ok, result, requestId }` | core는 `data.report` 기대, bridge가 `report` 보정 | API 직접 사용 시 계약 불명확 P0/P1 | 안전 메시지 |
| `/api/recommendations/by-date` | `court,start,end,usage,maxBidRate,limit` | `{ ok, items, debug?, requestId }` | items/meta | 실패/디버그 노출 가능. 기간/limit 상한 보강 필요 | requestId 있음 |
| `/api/onbid/items` | 서버는 `query,sido,pageNo,numOfRows` | `{ ok,count,items,requestId }` | 프론트는 `lctnSdnm,lctnSggnm,keyword,bidPrd...` 전송 | 계약 불일치 P0, `numOfRows` 상한 없음 | error detail 노출 P0 |
| `/api/onbid/detail` | 서버는 `cltrNo,plnmNo,pbctNo` | `{ ok,item,items,requestId }` | 프론트는 `cltrMngNo,pbctCdtnNo`, `data.detail` 기대 | 계약 불일치 P0 | error detail 노출 P0 |
| `/api/location/geocode` | `address` | normalized docs/meta/requestId | OK | upstream diagnostic 일부 노출은 제한적이나 검토 필요 | requestId 있음 |
| `/api/molit/trades` | `lawdCd,dealYmd,aptName,tradeType` | trades/type summary/requestId | OK | 외부 fetch timeout 없음 P1, per-type error message 포함 | requestId 있음 |
| `/api/molit/apt-trades` | 없음 | 없음 | 구버전 문서상 언급 | 실제 라우트 없음. 사용처 없어 영향 낮음 | 없음 |

## 4. storage key 목록

| key/prefix | 종류 | 사용 파일 | 범위/위험 |
|---|---|---|---|
| `auction-note:v2.2:case:` | localStorage | persist/case-reset/status | 사건별 Step2/분석. 공용 PC 안내 필요 |
| `auction-note:v2.2:bid-plan:` | localStorage | bid-plan/copy/case-reset | 입찰가 저장. 현재 간단 값만 저장 |
| `auction-note:v2:spec-extraction:` | sessionStorage | spec-extractor/case-reset | 사건별 draft. 사건 key 의존 |
| `auction-note:v2:active-case-key` | sessionStorage | case-reset/status | 사건 전환 감지 |
| `auction-note:v2:location-geocode` | sessionStorage | location/molit/final/confidence | transient. 사건 변경 시 제거 |
| `auction-note:v2:molit-trades` | sessionStorage | molit/final/confidence | transient. 사건 변경 시 제거 |
| `auction-note:v2:final-judgment` | sessionStorage | final/final-copy/confidence | transient. 사건 변경 시 제거 |
| `auction-note:v2:external-verification:` | localStorage | external-checklist | 사건별 외부검증 메모. 공용 PC 안내 필요 |
| `auction-note:v2:selected-date-candidate` | sessionStorage | date-source/copy | 검색 handoff 후보 |
| `auction-note:v2:date-candidate-stack` | sessionStorage | candidate-stack/bulk/copy | 임시 후보 |
| `auction-note:v2:saved-candidates` | localStorage | saved/bulk/candidate/copy | 저장 후보. 공용 PC 안내 필요 |
| `auction-note:v2:date-candidate-memo:` | local/session | date-source/saved/candidate/copy | 후보 메모 |
| `auction-note:v2:bulk-lookup-state` | sessionStorage | bulk-tab | 일괄조회 입력/결과 |

## 5. innerHTML/output sanitization 점검표

| 분류 | 상태 | 위험 |
|---|---|---|
| v2 활성 파일 대부분 | `esc()`를 사용한 template 생성 | 중간 |
| `app-v2-core.js` | 핵심 조회/분석 render에서 escape 사용 | 낮음 |
| `app-v2-onbid-entry.js` | escape 함수 있음. 다만 API 계약 불일치로 결과/상세 신뢰 낮음 | P0 계약 |
| `app-v2-location.js` | escape 사용. 지도 info template도 escape 확인됨 | 중간 |
| `app-v2-display-fix.js`, `app-v2-risk-brief.js`, `app-v2-bid-plan.js` | `esc()` 함수가 없거나 제한적. 주로 계산/내부 값이지만 확장 시 위험 | P1/P2 |
| legacy/patch 파일 | inline onclick/innerHTML raw 패턴 다수 | 미로드라 직접 위험 낮음, 유지보수 위험 P2 |
| href/URL | 공식 사이트/지도 링크는 대체로 고정/인코딩 | 낮음 |

## 6. OWASP LLM Top 10 기준 보안 점검표

| 항목 | 현재 상태 | 위험도 | 조치 |
|---|---|---|---|
| LLM01 Prompt Injection | 직접 LLM 없음. 명세서 원문은 parser 데이터로만 사용 | 낮음 | 향후 LLM 도입 시 데이터/명령 분리 |
| LLM02 Sensitive Disclosure | `/api/fetch` rawApis/debug, onbid detail error 노출 가능 | P0 | sanitize 응답/일반 메시지+requestId |
| LLM03 Supply Chain | Pretendard CDN 사용, 의존성 제한 guard 있음 | P1 | CDN/SRI 또는 self-host 검토 |
| LLM04 Data Poisoning | 외부 API/사용자 입력을 참고지표로 표시 | P1 | 확정 표현 금지 유지 |
| LLM05 Output Handling | innerHTML 많음. 대부분 esc 있으나 일부 보강 필요 | P1 | output sanitization test 추가 |
| LLM06 Excessive Agency | API 프록시는 allowlist. onbid params 상한/timeout 미흡 | P1 | numOfRows/기간 제한/timeout |
| LLM07 Prompt Leakage | 직접 prompt 없음 | 낮음 | 향후 서버 관리 |
| LLM08 Vector Weakness | 벡터/RAG 없음 | 낮음 | 향후 사건별 분리 |
| LLM09 Misinformation | 권리/대출/세금 단정 표현 지속 점검 필요 | P1 | 신뢰도/확인필요 문구 유지 |
| LLM10 Unbounded Consumption | rate limit 있음. bulk 10건, onbid numOfRows 상한 없음, MOLIT timeout 없음 | P1 | 자원 제한 guard 추가 |

## 7. 입찰가 산정 현재 구현 vs 요구사항

| 항목 | 현재 구현 | 요구사항 | 상태 |
|---|---|---|---|
| 입찰가 | `v2PlannedBidInput` | 필요 | 있음 |
| 입찰보증금 | 입찰가 * 보증금률 | 필요 | 있음 |
| 입찰가+인수 | 있음 | 필요 | 일부 |
| 최저가/감정가 대비 | 있음 | 필요 | 일부 |
| 취득세/지방세 | 없음 | 필요 | 미구현 |
| 등기비/법무비 | 없음 | 필요 | 미구현 |
| 미납관리비/수리비/명도비 | 없음 | 필요 | 미구현 |
| 대출금액/LTV/방공제 | 없음 | 필요 | 미구현 |
| 월 이자/보유기간 이자/중도상환수수료 | 없음 | 필요 | 미구현 |
| 총 취득비용/필요현금 | 없음 | 필요 | 미구현 P0 |
| 예상 매도가/세전수익/매도비용 | 없음 | 필요 | 미구현 |
| 과세표준/양도세/지방세 | 없음 | 필요 | 미구현 |
| 세후수익/수익률 | 없음 | 필요 | 미구현 P0 |
| 대출/세금 확인 필요 안내 | 일부 일반 안내 | 필수 | 보강 필요 |

## 8. P0/P1/P2 문제 목록

### P0

1. `/api/fetch`가 `rawApis`, `debug`, `_internalCsNo` 등 내부 수집 정보를 그대로 `raw`에 포함할 수 있음.
2. `/api/fetch` 실패 시 `e.message`를 사용자 응답에 그대로 전달.
3. 온비드 프론트/서버 목록 파라미터 불일치: 프론트 `lctnSdnm/lctnSggnm/keyword/bidPrd*`, 서버 `query/sido`.
4. 온비드 상세 파라미터/응답 불일치: 프론트 `cltrMngNo/pbctCdtnNo`, 서버 `cltrNo/plnmNo/pbctNo`, 서버는 `item`인데 프론트는 `detail` 기대.
5. 온비드 결과가 `v2OnbidResultArea`로 초록 입력 카드 내부에 남음.
6. 온비드 에러 응답이 `{ detail: e.message }`를 노출.
7. 입찰가 산정 탭이 필요현금/대출/세후수익 계산표 요구사항에 크게 부족.

### P1

1. `/api/analyze` 계약이 서버 `result`, 프론트 `report`로 나뉘고 bridge에 의존.
2. MOLIT/Onbid fetch timeout 일관성 부족.
3. Onbid `numOfRows` 상한이 문자열 sanitize뿐이라 실질 상한 없음.
4. `dateRecommendations` 실패 응답에 debug가 포함될 수 있음.
5. localStorage 저장 후보/메모/외부검증 데이터의 공용 PC 잔존 안내가 부족.
6. guard 테스트가 문자열 검사 위주라 실제 계약/렌더링 오류를 일부 놓침.
7. setInterval 렌더러가 많아 성능/순서 경쟁 가능성.

### P2

1. 미로드 legacy/patch 파일이 많아 유지보수 노이즈 큼.
2. 서버 책임이 `server.js`에 집중됨.
3. 일부 UI 문구가 설명형으로 길어질 위험.
4. CSS 전체 모바일/접근성 검증은 아직 제한적.

## 9. 첫 번째 최소 수정 제안

첫 수정은 P0 중 서로 연결된 항목을 작게 묶는 것이 안전하다.

1. `/api/fetch` 응답 sanitize: `rawApis`, `debug`, `_internalCsNo` 제거, 실패 메시지는 일반화.
2. 온비드 계약 정리: 프론트 파라미터를 서버가 받거나 서버 alias 허용, 목록 item에 프론트가 쓰는 id를 맞춤, 상세 응답에 `detail` alias 추가.
3. 온비드 결과 영역 이동: `v2OnbidResultArea`를 `v2TabResultsSection`으로 분리.
4. 온비드 detail/error/numOfRows guard 테스트 추가.

입찰가 계산표는 별도 두 번째 수정으로 분리한다. 계산 필드와 저장 구조가 커서 P0이지만, 온비드/응답계약과 한 PR에 섞으면 검증 범위가 커진다.

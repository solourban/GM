# Codex 전체 코드 리뷰표

기준일: 2026-06-17

범위는 `public/index.html`에서 실제 로드되는 v2 스크립트와 서버 핵심 파일입니다. `public/*-patch.js`, legacy `public/app.js`, `public/app-v2.js`, `public/app-v2-analyze.js` 등 현재 `index.html`에서 로드하지 않는 파일은 `legacy/public-js/`로 이동해 정적 운영 노출 대상에서 분리했습니다.

## 핵심 파일 점검표

| 파일명 | 역할 | 생성하는 DOM id | 의존하는 DOM id | 사용하는 storage key | 사용하는 API endpoint | innerHTML 사용 여부 | escape 처리 여부 | 관련 테스트 | 위험도 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/server.js` | Express 서버, 정적 파일, API 라우트 | 해당 없음 | 해당 없음 | 해당 없음 | 전체 `/api/*` | 아니오 | 서버 응답 sanitize 일부 | `server-security`, `fetch-response-sanitization`, `onbid-contract`, `external-api-proxy`, `api-contract-hardening`, `renewal-regression` | 높음 | API 계약 변경 시 프론트 전체 영향 |
| `src/crawler.js` | 법원 사건 기본정보 수집 | 해당 없음 | 해당 없음 | 해당 없음 | 외부 법원 API | 아니오 | 서버 route에서 내부 필드 제거 | `fetch-response-sanitization`, `analyzer` | 높음 | `rawApis/debug/_internalCsNo` 제거는 server에서 보장 |
| `src/analyzer.js` | 권리분석 계산 | 해당 없음 | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | 해당 없음 | `analyzer` | 높음 | `/api/analyze` result 계약의 원천 |
| `src/dateRecommendations.js` | 매각기일 추천 후보 수집/검증 | 해당 없음 | 해당 없음 | 해당 없음 | 외부 법원 API | 아니오 | clean 함수 사용 | `date-recommendations-regression`, `api-contract-hardening` | 중 | module 내부 debug는 유지하되 public route 응답에서는 제거 |
| `public/index.html` | 앱 진입 HTML, script load order | `resultsSection` | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | 해당 없음 | `public-scripts`, `static-pages` | 중 | script 순서 변경 주의 |
| `legacy/public-js/*` | 운영에서 로드하지 않는 과거 public JS archive | 해당 없음 | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | 해당 없음 | `legacy-public-cleanup` | 낮음 | 운영 정적 경로에서는 제외. 복구 시 index script/test 동시 갱신 필요 |
| `public/app-v2-request-id-bridge.js` | fetch requestId 헤더 보강 | 없음 | `window.fetch` | 없음 | 전체 fetch | 아니오 | 해당 없음 | `public-scripts` | 중 | 모든 API 요청에 간접 영향 |
| `public/app-v2-spec-extractor-parser.js` | 명세서 텍스트 파서 | 없음 | 없음 | 없음 | 없음 | 아니오 | DOM 접근 없음 | `spec-extractor-parser` | 중 | parser는 브라우저 API 사용 금지 테스트 있음 |
| `public/app-v2-core.js` | 홈 탭, 검색, Step1/Step2/권리분석 기본 렌더 | `v2HomePanels`, `v2TabResultsSection`, `step2InputCard`, `analysisCard` | `resultsSection`, `.hero-inner`, `.header-inner` | 없음 | `/api/courts`, `/api/fetch`, `/api/analyze` | 예 | `esc`, `textContent` 혼합 | `public-scripts`, `tab-results-layout`, `case-scope-regression`, `innerhtml-escape-guard`, `home-layout` | 높음 | 화면 구조의 중심. 홈 화면 여백/hero와 모바일 줄바꿈도 여기서 제어 |
| `public/app-v2-analyze-bridge.js` | `/api/analyze` 요청/응답 bridge | 없음 | `window.fetch` | 없음 | `/api/analyze` | 아니오 | 해당 없음 | `analyzer`, `public-scripts`, `api-contract-hardening` | 높음 | 서버도 `report` alias를 내려주며 bridge는 하위호환 보정으로 유지 |
| `public/app-v2-onbid-entry.js` | 온비드 공매 탭/목록/상세 | `v2OnbidEntryPanel`, `v2OnbidResultCard`, `v2OnbidResultArea`, `v2OnbidDetailCard` | `v2HomePanels`, `v2TabResultsSection` | 없음 | `/api/config`, `/api/onbid/items`, `/api/onbid/detail` | 예 | `esc` 사용 | `onbid-contract`, `onbid-result-layout`, `onbid-proxy` | 높음 | 결과는 green input card 밖 `v2TabResultsSection`에 표시 |
| `public/app-v2-service-status.js` | 연동 상태 카드 | `v2ServiceStatusCard` | `v2HomePanels` | 없음 | `/api/health`, `/api/config` | 예 | `esc` 사용 | `server-security`, `external-api-proxy` | 중 | API 키 값은 노출하지 않고 설정 여부만 표시 |
| `public/app-v2-validate.js` | Step2/분석 경고 유지 | `v2Step2GuardMessage`, `v2Analyze*Message` | `step2InputCard`, `analysisCard` | 없음 | 없음 | 예 | `esc` 사용 | `case-reset-safety`, `innerhtml-escape-guard` | 중 | 분석 실패/경고 메시지 HTML escape 적용 |
| `public/app-v2-allocation.js` | 배당/인수 설명 보강 | `allocationExplainCard` | `analysisCard` | 없음 | 없음 | 예 | `esc` 확인 완료 | `innerhtml-escape-guard` | 중 | 분석 카드 후속 보강 |
| `public/app-v2-display-fix.js` | 결과 카드 표시 보정 | `v2MissingAmountNotice` 등 | `analysisCard`, bid/funding cards | 없음 | 없음 | 예 | `esc` 사용 | `result-order-regression`, `innerhtml-escape-guard` | 중 | 표시 순서와 충돌 가능 |
| `public/app-v2-risk-brief.js` | 위험 요약 카드 | `v2RiskBriefCard` | `v2BiddingSummaryCard` | 없음 | 없음 | 예 | `esc` 확인 완료 | `external-checklist-regression`, `innerhtml-escape-guard` | 중 | 최종 판단 카드들과 순서 의존 |
| `public/app-v2-copy-summary.js` | 최종 복사용 요약 | `v2CopySummaryCard`, `v2CopySummaryBtn` | bid/funding/checklist cards | `auction-note:v2.2:bid-plan:`, 후보/위치/실거래 storage | 없음 | 예 | textarea/copy API와 `textContent` 중심 | `bid-plan-calculation`, `innerhtml-escape-guard` | 중 | 저장 후보/입찰가 snapshot 연결 |
| `public/app-v2-bid-plan.js` | 입찰가·자금 계산 카드 | `v2BidPlanCard`, `v2PlannedBidInput`, `v2BidPlan_*` | `v2PreBidChecklistCard`, `v2FundingReviewCard`, `v2BidRangeCard` | `auction-note:v2.2:bid-plan:` | 없음 | 예 | `esc`, `textContent` 사용 | `bid-plan-calculation`, `innerhtml-escape-guard` | 높음 | 계산 상세 UI와 계산식 테스트 적용 |
| `public/app-v2-result-polish.js` | 결과 표시 polish | 없음 | 결과 카드들 | 없음 | 없음 | 예 | `esc` 사용 | `result-order-regression`, `innerhtml-escape-guard` | 낮음 | 시각 보정 |
| `public/app-v2-persist.js` | 사건별 입력/분석 저장 | `v2PersistStatus`, `v2PersistResetBtn` | `step2InputCard` | `auction-note:v2.2:case:` | 없음 | 아니오 | `textContent` 사용 | `case-reset-safety`, `case-scope-regression` | 높음 | 공용 PC 잔존 안내 필요 |
| `public/app-v2-case-reset.js` | 사건 전환/초기화 안전장치 | `v2CaseScopeNotice` | 검색 input, Step2 | `auction-note:v2.2:case:`, `auction-note:v2.2:bid-plan:`, transient session keys | 없음 | 예 | 정적 템플릿 위주 | `case-reset-safety`, `case-scope-regression` | 높음 | 사건 스코프 오염 방지 핵심 |
| `public/app-v2-spec-extractor.js` | 매각물건명세서 텍스트 추출 UI | `v2SpecExtractor*` | `v2SpecExtractorMount`, `resultsSection` | `auction-note:v2:spec-extraction:` | 없음 | 예 | parser 결과 escape 확인 필요 | `spec-extractor-regression`, `spec-extraction-design` | 높음 | 원문은 sessionStorage 한정 원칙 |
| `public/app-v2-property-types.js` | 물건 유형 필터 | `v2PropertyTypeStyles` | date/saved/bulk lists | 없음 | 없음 | 아니오 | `textContent` 사용 | `property-type-filters` | 낮음 | 공통 필터 helper |
| `public/app-v2-date.js` | 매각기일 추천 탭/결과 | `v2DateResultCard`, `v2DateEmptyStateCard`, `v2DateSortControls` | `v2TabResultsSection`, 검색 input | 없음 | `/api/recommendations/by-date` | 예 | `esc` 사용 | `date-recommendations-regression`, `tab-results-layout`, `api-contract-hardening`, `innerhtml-escape-guard` | 높음 | `/api/date/recommendations` 호환 route 제공, 프론트 canonical은 현행 endpoint 유지 |
| `public/app-v2-date-source.js` | 날짜 후보를 검색 탭으로 handoff | `v2DateSourceCard`, memo controls | `resultsSection`, search panel | `auction-note:v2:selected-date-candidate`, `auction-note:v2:date-candidate-memo:` | 없음 | 예 | `esc`, textarea, `textContent` 사용 | `case-scope-regression`, `innerhtml-escape-guard` | 중 | 후보 메모 저장 |
| `public/app-v2-candidate-stack.js` | 임시/저장 후보 stack | `v2CandidateStackCard`, `v2SavedTopFiveCard` | `v2TabResultsSection`, search input | `auction-note:v2:date-candidate-stack`, `auction-note:v2:saved-candidates`, memo key | 없음 | 예 | `esc` 사용 | `case-scope-regression`, `innerhtml-escape-guard` | 중 | localStorage 저장 후보 |
| `public/app-v2-saved-tab.js` | 저장 후보 TOP 5 탭 | `v2SavedTabControlsCard`, `v2SavedTabRuntimeCard`, `v2SavedMobileCards` | `v2TabResultsSection` | `auction-note:v2:saved-candidates`, memo key | 없음 | 예 | `esc` 사용 | `tab-results-layout`, `innerhtml-escape-guard` | 중 | 저장 후보 목록/검색 handoff |
| `public/app-v2-bulk-tab.js` | 여러 사건 일괄조회 | `v2Bulk*` | `v2TabResultsSection`, search input | `auction-note:v2:bulk-lookup-state`, candidate/saved keys | `/api/courts`, `/api/fetch` | 예 | `esc` 사용 | `tab-results-layout` | 높음 | 여러 `/api/fetch` 호출과 후보 저장 |
| `public/app-v2-location.js` | 위치/카카오 지도/좌표 | `v2LocationCard` | `resultsSection` | `auction-note:v2:location-geocode` | `/api/location/geocode`, `/api/config`, `/api/kakao/maps-sdk.js` | 예 | `esc` 사용, 주소 재검색 시도 escape 적용 | `location-map-card`, `server-security`, `innerhtml-escape-guard` | 높음 | Kakao JS key는 서버 프록시 경유 |
| `public/app-v2-molit-trades.js` | 국토부 실거래가 카드 | `v2MolitTradeCard` | `v2LocationCard` | `auction-note:v2:location-geocode`, `auction-note:v2:molit-trades` | `/api/molit/trades` | 예 | render helper escape 사용 | `external-api-proxy`, `api-contract-hardening`, `innerhtml-escape-guard` | 중 | 서버 MOLIT fetch timeout 적용. `/api/molit/apt-trades`는 외부 문서용 아파트 전용 호환 route |
| `public/app-v2-final-judgment.js` | 최종 판단 카드 | `v2FinalJudgmentCard` | 위치/실거래/입찰가/checklist cards | `auction-note:v2:final-judgment`, 위치/실거래 keys | 없음 | 예 | `esc` 사용 | `bid-plan-calculation`, `innerhtml-escape-guard` | 중 | bid-plan snapshot 반영 |
| `public/app-v2-external-checklist.js` | 외부 확인 체크리스트 | `v2ExternalVerification*` | `resultsSection`, risk/location/trade/final cards | `auction-note:v2:external-verification:` | 없음 | 예 | `esc`, `textContent` 혼합 | `external-checklist-regression`, `innerhtml-escape-guard` | 중 | 사건별 localStorage 메모 |
| `public/app-v2-confidence.js` | 판단 신뢰도 카드 | `v2DecisionConfidenceCard` | final/location/trade cards | final/location/trade keys | 없음 | 예 | `esc` 사용 | `result-order-regression`, `innerhtml-escape-guard` | 중 | final 카드와 순서 의존 |
| `public/app-v2-case-sync-status.js` | 사건 동기화 상태 | `v2CaseSyncStatusCard` | final/molit/confidence cards | case/final/location/trade/active keys | 없음 | 예 | `esc` 사용 | `case-scope-regression`, `innerhtml-escape-guard` | 중 | 사건 변경 시 stale data 감지 |
| `public/app-v2-final-copy-bridge.js` | 최종 복사 bridge | final copy card ids | copy/final/molit cards | final/location/trade keys | 없음 | 예 | textarea escape, `textContent` 사용 | `result-order-regression`, `innerhtml-escape-guard` | 낮음 | 복사용 텍스트 생성 |
| `public/app-v2-date-courts.js` | 매각기일 법원 목록 helper | 없음 | `dateCourtV2`, `dateMessageV2` | 없음 | 없음 | 예 | `esc` 사용 | `date-recommendations-regression`, `innerhtml-escape-guard` | 낮음 | date panel 보조 |
| `public/app-v2-workflow-shell.js` | 검색 결과 workflow wrapper | `v2WorkflowShell*` | `resultsSection`, `step2InputCard`, `analysisCard` | 없음 | 없음 | 예 | `esc` 사용 | `workflow-shell-regression`, `innerhtml-escape-guard` | 중 | 결과 카드 wrapping 영향 |
| `public/app-v2-essential-documents.js` | 필수 서류 체크 카드 | `v2EssentialDocumentsCard` | `resultsSection`, `analysisCard`, `step2InputCard` | 없음 | 없음 | 예 | `esc`, `textContent` 혼합 | `external-checklist-regression` | 중 | 외부검증 anchor |
| `public/app-v2-tab-scope-guard.js` | 탭별 결과 오염 방지 | 없음 | `v2TabResultsSection`, `resultsSection`, tab/cards | 없음 | 없음 | 예 | 정적 메시지 | `tab-scope-guard` | 높음 | search 결과와 다른 탭 결과 분리 |
| `public/app-v2-positioning-copy.js` | 탭별 안내 문구 | `v2PositioningNote` | `v2HomePanels` | 없음 | 없음 | 아니오 | `textContent` 사용 | 없음 | 낮음 | copy only |
| `public/app-v2-map-provider-guard.js` | 지도 provider 안내 보정 | 없음 | `v2LocationCard` | 없음 | 없음 | 아니오 | `textContent` 사용 | `location-map-card` | 낮음 | Kakao map fallback copy |
| `public/app-v2-result-order.js` | 결과 카드 순서 고정 | 없음 | `resultsSection` | 없음 | 없음 | 아니오 | 해당 없음 | `result-order-regression` | 중 | 카드 id 순서 계약 |

## Storage key 점검표

| key | 저장소 | 주요 사용 파일 | 용도 | 위험도 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `auction-note:v2.2:case:` | localStorage | persist, case-reset, case-sync | 사건별 Step2/분석 저장 | 높음 | 공용 PC 잔존 안내 필요 |
| `auction-note:v2.2:bid-plan:` | localStorage | bid-plan, copy-summary, case-reset | 입찰가/비용 입력 저장 | 높음 | 숫자 비용 정보 저장 |
| `auction-note:v2:spec-extraction:` | sessionStorage | spec-extractor, case-reset | 명세서 추출 draft | 높음 | 원문/근거는 sessionStorage 한정 원칙 |
| `auction-note:v2:active-case-key` | sessionStorage | case-reset, case-sync | 활성 사건 감지 | 중 | stale data 방지 |
| `auction-note:v2:location-geocode` | sessionStorage | location, molit, final, confidence | 좌표/주소 변환 결과 | 중 | 사건 전환 시 제거 대상 |
| `auction-note:v2:molit-trades` | sessionStorage | molit, final, confidence | 실거래가 조회 결과 | 중 | 사건 전환 시 제거 대상 |
| `auction-note:v2:final-judgment` | sessionStorage | final, confidence, final-copy | 최종 판단 snapshot | 중 | 사건 전환 시 제거 대상 |
| `auction-note:v2:external-verification:` | localStorage | external-checklist | 외부검증 체크/메모 | 중 | 사용자가 직접 입력한 메모 |
| `auction-note:v2:selected-date-candidate` | sessionStorage | date, date-source, copy-summary | 매각기일 후보 handoff | 낮음 | 검색 탭 연결 |
| `auction-note:v2:date-candidate-stack` | sessionStorage | date/candidate/bulk | 임시 후보 목록 | 낮음 | 저장 전 후보 |
| `auction-note:v2:saved-candidates` | localStorage | saved/candidate/bulk/copy | 저장 후보 TOP 5 | 중 | 개인정보성 메모와 결합 가능 |
| `auction-note:v2:date-candidate-memo:` | localStorage/sessionStorage | candidate/saved/copy/date-source | 후보 메모 | 중 | 공용 PC 안내 필요 |
| `auction-note:v2:bulk-lookup-state` | sessionStorage | bulk-tab | 여러 사건 일괄조회 입력/결과 | 중 | 여러 사건번호 포함 |

## 남은 리뷰 포인트

- `/api/analyze`, 매각기일 `debug`, MOLIT 부분 실패 메시지, MOLIT timeout은 `api-contract-hardening` 계열 테스트로 해결 상태를 고정했다.
- `/api/molit/apt-trades`는 `/api/molit/trades` shared handler를 사용하고 `tradeType: apt`로 고정하는 호환 route로 제공한다.
- `innerHTML` 사용이 많은 구조라 `innerhtml-escape-guard`로 core/date/date-courts/date-source/candidate-stack/saved/copy/final/molit/confidence/case-sync/validate/allocation/display-fix/result-polish/workflow-shell/risk/onbid/bid-plan/location/spec/external/bulk/essential/service의 핵심 escape 계약을 고정했다.
- `public`에는 `index.html`이 실제 로드하는 JS만 남기고, 과거 patch/legacy JS 46개는 `legacy/public-js/`로 이동했다. `legacy-public-cleanup` 테스트로 재유입을 방지한다.
- 홈/결과 카드의 모바일 탭 2컬럼 배치, 버튼 줄바꿈, 긴 값 줄바꿈, body 가로 overflow 방지는 `home-layout` 테스트로 1차 고정했다.
- 애드센스는 승인 전 광고 스크립트와 가짜 `public/ads.txt`를 넣지 않고, `ADSENSE_PUBLISHER_ID` 환경변수 설정 시 `/ads.txt`가 동적으로 노출되는 구조로 준비했다. `adsense-readiness` 테스트로 고정한다.
- 홈과 정적 페이지 헤더는 공통 `public/assets/nakchalnote-logo.png` 로고 이미지를 사용하며, 크기/비율/경로 계약은 `header-logo` 테스트로 고정한다.
- 남은 loaded v2 파일 중 positioning-copy/map-provider-guard/result-order처럼 DOM textContent 또는 순서 제어 중심 파일은 낮은 우선순위로 유지한다.
- 홈 화면의 큰 green hero 높이와 빈 영역은 `app-v2-core.js`의 과거 `.hero { min-height:660px; }`와 hero copy hidden 구조가 원인이었다. UI 패치에서 hero 높이, empty results 영역, 모바일 줄바꿈을 축소/보강했다.

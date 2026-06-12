# 탭별 입력/결과 영역 배치표

기준일: 2026-06-12

현재 홈 화면은 `public/app-v2-core.js`가 header 탭과 green hero 안 입력 패널을 만들고, 검색 외 탭 결과는 hero 아래 `v2TabResultsSection`에 분리해 표시합니다.

## 공통 레이아웃 계약

| 영역 | DOM id/class | 생성 파일 | 역할 | 비고 |
| --- | --- | --- | --- | --- |
| 상단 헤더 | `.site-header`, `.header-inner` | `index.html`, `app-v2-core.js` | 브랜드와 탭 nav | header는 sticky |
| 탭 nav | `.v2-tabs`, `.v2-tab[data-tab]` | `app-v2-core.js`, `app-v2-onbid-entry.js` | `search`, `bulk`, `date`, `saved`, `onbid` 전환 | onbid 탭은 별도 파일이 append |
| 홈 입력 패널 묶음 | `v2HomePanels` | `app-v2-core.js` | green hero 안 탭별 입력 카드 | hero 높이를 `clamp(360px,45vh,480px)`로 축소 |
| 검색 결과 영역 | `resultsSection` | `index.html` | 물건 검색 결과와 후속 카드 | search 탭 전용에 가까움 |
| 다른 탭 결과 영역 | `v2TabResultsSection` | `app-v2-core.js` | bulk/date/saved/onbid 결과 | hero 바로 아래 삽입, 탭 변경 시 비움 |

## 탭별 배치

| 탭 | 입력 영역 | 결과 영역 | 주요 생성 카드 | 결과 위치 상태 | 관련 테스트 |
| --- | --- | --- | --- | --- | --- |
| 물건 검색 `search` | `v2HomePanels` 안 `data-panel="search"` | `resultsSection` | Step1 기본정보, 일정, 이해관계인, Step2, 분석 | 정상. 검색 결과는 green hero 아래 기존 결과 영역 | `tab-results-layout`, `workflow-shell-regression`, `result-order-regression` |
| 여러 사건 일괄조회 `bulk` | core placeholder 후 `app-v2-bulk-tab.js`가 패널 보강 | `v2TabResultsSection` | `v2BulkRuntimeCard`, `v2BulkResultCard`, mobile cards | 정상. search 결과와 분리 | `tab-results-layout` |
| 매각기일 추천 `date` | core placeholder 후 `app-v2-date.js`가 패널 보강 | `v2TabResultsSection` | `v2DateResultCard`, `v2DateEmptyStateCard`, 정렬/필터 | 정상. 후보 선택 시 search 탭 handoff | `date-recommendations-regression`, `tab-results-layout` |
| 저장 후보 TOP 5 `saved` | core placeholder 후 `app-v2-saved-tab.js`가 패널 보강 | `v2TabResultsSection` | `v2SavedTabControlsCard`, `v2SavedTabRuntimeCard` | 정상. 저장 후보 선택 시 search 탭 handoff | `tab-results-layout` |
| 온비드 공매 `onbid` | `app-v2-onbid-entry.js`가 tab/button/panel 추가 | `v2TabResultsSection` | `v2OnbidResultCard`, `v2OnbidResultArea`, `v2OnbidDetailCard` | 정상. 결과가 입력 카드 안으로 들어가지 않음 | `onbid-result-layout`, `onbid-contract` |

## 검색 탭 결과 카드 순서

`app-v2-result-order.js`와 관련 카드들이 기대하는 흐름입니다.

1. Step1 기본정보
2. 현황 요약
3. 진행일정 / 매각기일
4. 이해관계인
5. 다음 단계
6. Step2 입력
7. 권리분석 결과
8. 필수 서류/외부검증/위치/실거래/입찰가/최종판단 계열 보강 카드

## 현재 홈 화면 이슈

| 이슈 | 원인 | 영향 | 제안 |
| --- | --- | --- | --- |
| green hero가 지나치게 큼 | 기존 `app-v2-core.js` injected CSS의 `.hero { min-height:660px; }` | 검색 카드 아래 빈 공간이 크게 보였음 | `clamp(360px,45vh,480px)`와 tablet `min-height:auto`로 축소 |
| hero copy가 숨겨짐 | `.hero-copy { display:none; }` | 상단 공간의 의미가 약함 | 검색 카드 중심 화면이면 hero 높이를 줄이고, 설명 copy는 카드 내부/하단으로 충분 |
| 결과가 없을 때 하단이 비어 보임 | `resultsSection`은 idle이면 빈 문자열 | 첫 화면에서 정보 밀도가 낮음 | static page 링크, 서비스 상태, 최근 후보 등을 과하지 않게 배치 검토 |
| 탭 버튼이 많아짐 | onbid가 동적으로 탭 추가 | 모바일에서 탭 줄바꿈/압축 가능 | 이미 media query 있음. 실제 모바일 스크린샷 확인 필요 |

## 다음 UI 패치 최소 범위 제안

- `app-v2-core.js`의 hero min-height는 1차 축소 완료. 실제 브라우저 확인 후 더 줄일지 결정한다.
- 첫 화면에서 결과가 없을 때 `resultsSection:empty`가 공간을 차지하지 않도록 1차 반영 완료.
- 검색 카드와 탭 nav는 유지하고, script 로딩 순서는 바꾸지 않는다.
- functional API, 온비드, 입찰가 계산 로직은 건드리지 않는다.

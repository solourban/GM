# Codex 전체 코드 리뷰 체크리스트

이 문서는 낙찰노트 v2 전체 코드를 전수 리뷰할 때 파일별로 기록할 점검표다. 기능 수정 전 의존성, DOM 계약, 저장소 키, API 사용, XSS 위험을 먼저 확인한다.

## 리뷰 원칙

- 파일을 수정하기 전에 역할과 의존 대상을 먼저 적는다.
- 생성하는 DOM id와 의존하는 DOM id를 분리해서 기록한다.
- `innerHTML` 사용 위치는 escape 처리 여부를 반드시 확인한다.
- 서버 API, 브라우저 storage key, 전역 객체 의존성은 변경 전후 계약을 따로 기록한다.
- 위험도가 높은 파일은 수정 전에 관련 테스트를 먼저 확인한다.

## 파일별 점검표

| 파일명 | 역할 | 생성하는 DOM id | 의존하는 DOM id | 사용하는 storage key | 사용하는 API endpoint | innerHTML 사용 여부 | escape 처리 여부 | 관련 테스트 | 위험도 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public/index.html | 앱 진입 HTML, 스크립트 로딩 순서 | resultsSection | 없음 | 없음 | 없음 | 아니오 | 해당 없음 | tests/public-scripts.test.js | 높음 | 스크립트 순서 변경 주의 |
| public/app-v2-core.js | 핵심 조회 및 분석 흐름 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 높음 | 별도 전수 리뷰 필요 |
| public/app-v2-bid-plan.js | 입찰가 산정 탭 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | 추후 리뷰 | tests/bid-plan-calculation.test.js | 높음 | 계산식 계약 변경 금지 |
| src/server.js | API 라우팅 및 외부 API 프록시 | 해당 없음 | 해당 없음 | 해당 없음 | 전체 서버 API | 해당 없음 | 서버 응답 sanitizing 확인 | tests/server-security.test.js | 높음 | raw/debug/detail 노출 주의 |

## 추가 확인 필요 항목

- public/app-v2-date.js의 매각기일 추천 DOM 계약
- public/app-v2-onbid-entry.js의 온비드 요청 파라미터 계약
- public/app-v2-location.js의 지도/주소 변환 계약
- public/app-v2-molit-trades.js의 실거래가 응답 필드 계약
- 저장 후보, 임시 후보, 입찰가 산정 입력값의 storage key 목록
- 결과 카드 렌더링에서 사용자 입력값 escape 처리 여부

# Codex 전체 코드 전수 리뷰표

이 문서는 낙찰노트 v2 코드를 전수 점검할 때 파일별 의존성과 위험 지점을 빠짐없이 기록하기 위한 템플릿이다.

## 리뷰 원칙

- 기능 수정 전에 파일 역할과 의존 관계를 먼저 기록한다.
- DOM id, storage key, API endpoint처럼 화면과 서버를 연결하는 계약은 추정하지 말고 실제 코드 기준으로 적는다.
- `innerHTML` 사용 지점은 입력값 escape 처리 여부와 함께 확인한다.
- 위험도는 `P0`, `P1`, `P2`, `P3` 중 하나로 표시한다.

## 파일별 점검표

| 파일명 | 역할 | 생성하는 DOM id | 의존하는 DOM id | 사용하는 storage key | 사용하는 API endpoint | innerHTML 사용 여부 | escape 처리 여부 | 관련 테스트 | 위험도 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `public/index.html` | 앱 진입 HTML, 스크립트 로딩 순서 | `resultsSection` | 없음 | 없음 | 없음 | 아니오 | 해당 없음 | `tests/public-scripts.test.js`, `tests/static-pages.test.js` |  |  |
| `public/app-v2-core.js` | v2 홈 탭, 기본 렌더링, 분석 결과 루트 |  |  |  |  |  |  |  |  |  |
| `public/app-v2-date.js` | 매각기일 추천 탭 |  |  |  |  |  |  |  |  |  |
| `public/app-v2-onbid-entry.js` | 온비드 진입/조회 탭 |  |  |  |  |  |  |  |  |  |
| `public/app-v2-bid-plan.js` | 입찰가 산정 탭 |  |  |  |  |  |  |  |  |  |
| `src/server.js` | Express 서버와 API 라우트 | 해당 없음 | 해당 없음 | 해당 없음 | 외부 API | 해당 없음 | 해당 없음 |  |  |  |

## 추가 확인 메모

| 확인 항목 | 결과 | 비고 |
| --- | --- | --- |
| 화면에서 같은 DOM id를 중복 생성하는지 |  |  |
| 탭 간 결과 영역이 서로 덮어쓰는지 |  |  |
| requestId가 사용자 확인 가능한 오류에 포함되는지 |  |  |
| 외부 API 원문, debug, stack, `e.message`가 브라우저 응답에 노출되는지 |  |  |
| 광고 코드가 승인 전 삽입되어 있지 않은지 |  |  |

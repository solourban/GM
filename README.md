# 낙찰노트

법원 경매 물건의 기본정보, 권리분석, 시세·입지, 입찰가·자금 검토를 한 화면에서 정리하는 입찰 검토 도구입니다.

Node.js/Express 서버가 법원 경매정보와 공공데이터 API를 호출하고, 정적 프론트엔드를 함께 제공합니다. 현재 구현은 Chromium이나 브라우저 자동화를 사용하지 않습니다.

## 파일 구조

```text
/
├── Dockerfile          ← Railway 실행 이미지
├── package.json
├── package-lock.json   ← 재현 가능한 의존성 설치 기준
├── railway.json
├── src/
│   ├── server.js       ← Express 서버와 API
│   ├── crawler.js      ← 법원 경매정보 API 연동
│   ├── dateRecommendations.js
│   ├── dataGovernance.js
│   └── analyzer.js     ← 권리분석 엔진
├── public/             ← 운영 프론트엔드
├── legacy/public-js/   ← 운영에서 제외된 이전 스크립트
└── tests/              ← 회귀·보안 검사
```

## 로컬 실행과 검사

Node.js 24 기준입니다.

```bash
npm ci
npm test
npm start
```

실행 후 `http://localhost:3000`에서 확인합니다.

Docker로 확인하려면:

```bash
docker build -t nakchalnote .
docker run --rm -p 3000:3000 nakchalnote
```

## Railway 배포

Railway가 저장소의 `Dockerfile`을 사용해 이미지를 빌드하고 `npm start`로 서버를 실행합니다. 외부 API 키와 운영 설정은 저장소가 아니라 Railway Variables에 둡니다.

## 설계 문서

- [매각물건명세서 원문 붙여넣기 후보 추출 설계](docs/auction-specification-text-extraction-design.md)

# 목장 자막 (ai-audio-capture)

목장 모임용 실시간 자막 웹앱. 한국어와 영어를 같이 받아적고, 영어는 바로 한국어 번역을 붙여 보여줘요. 2분마다 Claude가 요약하고, 요약과 전체 자막을 Google Drive 파일 하나에 자동 저장해요.

주소: https://bakhoon.github.io/ai-audio-capture/

## 키는 내 폰에만

서버가 없어요. API 키는 앱 설정 화면에서 넣고, 그 폰의 그 앱 안에만 저장돼요. 다른 사람이 주소로 들어와도 키가 없어서 쓸 수 없어요.

| 키 | 어디서 | 없으면 |
|---|---|---|
| Soniox API 키 (필수) | console.soniox.com | 데모 모드만 가능 |
| Anthropic API 키 | console.anthropic.com | 데모 요약 |
| Google 클라이언트 ID | 아래 Drive 설정 | 이 폰에만 저장 |

폰을 잃어버리면 Soniox, Anthropic 콘솔에서 키를 바로 삭제하세요.

## iPhone 에서 쓰는 순서

1. Safari(또는 크롬)에서 주소 열기
2. 공유 > 홈 화면에 추가
3. 홈 화면 아이콘으로 앱을 열고, 거기서 키 입력 (홈 화면 앱은 브라우저와 저장 공간이 따로라서 꼭 아이콘에서 입력)
4. 시작 누르고 마이크 허용

웹앱이라 화면이 켜져 있고 앱이 맨 앞에 있을 때만 들어요. 모임 중엔 폰을 테이블 가운데 세워두세요.

## Google Drive 설정 (한 번만, 선택)

1. Google Cloud Console 에서 프로젝트 만들기
2. "Google Drive API" 사용 설정
3. OAuth 동의 화면 만들기 (외부, 테스트 사용자에 내 Gmail 추가)
4. 사용자 인증 정보 > OAuth 클라이언트 ID > 웹 애플리케이션
5. 승인된 자바스크립트 원본: `https://bakhoon.github.io`
6. 나온 클라이언트 ID 를 앱 설정 화면에 입력

권한은 `drive.file` 이라 이 앱이 만든 파일만 건드려요. 로그인은 1시간쯤 지나면 풀리는데, 그땐 "지금 저장"을 한 번 누르면 다시 연결돼요.

## 개발

```bash
npm install
npm run dev
```

`main` 에 푸시하면 GitHub Actions 가 빌드해서 `gh-pages` 브랜치로 배포해요.

## 파일

- `src/App.jsx`: 화면, 녹음, 2분 요약, 자동 저장 흐름
- `src/Settings.jsx`, `src/keys.js`: 키 입력 화면과 폰 저장
- `src/captions.js`: Soniox 토큰을 줄로 묶고 번역 붙이기, 데모 대화
- `src/summarize.js`: Claude 요약 (요약 규칙은 여기 `SYSTEM`)
- `src/drive.js`: Google Drive 로그인과 저장
- 요약 주기는 `App.jsx` 의 `SUMMARY_EVERY_MS`

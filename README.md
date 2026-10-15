# 파티 게임즈 🎲

친구들과 링크/초대코드로 함께 노는 실시간 파티 게임 (Node.js + Socket.IO, 모바일 웹).

게임: 마니또 · 라이어 게임 · 바보 라이어 · 스피드 퀴즈

## 로컬 실행
```bash
npm install
npm start          # http://localhost:3000
```
AI(Gemini)를 쓰려면 환경변수 `GEMINI_API_KEY` 설정 (없으면 내장 주제 목록 사용).
PowerShell: `$env:GEMINI_API_KEY="키"; npm start`

## Render 무료 배포
1. GitHub에 push → Render > New > Blueprint (`render.yaml` 자동 인식)
2. 환경변수 `GEMINI_API_KEY` 입력
3. 발급된 URL이 곧 초대 링크 (`https://xxx.onrender.com/?room=코드`)
4. 무료 플랜은 15분 무접속 시 잠들고 재시작되면 방이 사라져요.
   UptimeRobot 등으로 `/healthz` 를 5분마다 호출하면 잠들지 않아요.

## 재접속
- 기기에 {방코드, 토큰} 저장 → 새로고침/앱 전환/네트워크 끊김 후 자동으로 같은 자리 복귀
- 저장소가 날아가도 같은 이름으로 입장하면 오프라인 자리를 되찾음
- 방장이 90초 이상 자리를 비우면 자동 위임, 돌아오면 일반 참가자로 복귀

## 게임 추가 방법
`server/games/index.js` 상단 주석 참고 (서버 모듈 1개 + 클라이언트 렌더러 1개).

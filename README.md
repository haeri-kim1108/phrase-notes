# 표현 복습 노트

매일 배운 영어 표현을 기록하고, 망각 곡선에 맞춰 1·3·7·14·30일 간격으로 복습하는 앱입니다.
앱은 GitHub Pages에서 열리고, 기록은 내 Firebase(Firestore)에 저장됩니다.

## Firebase 설정 (처음 한 번)

1. https://console.firebase.google.com 에서 **프로젝트 추가** (Google Analytics는 꺼도 됩니다).
2. **Authentication** > 시작하기 > 로그인 방법 > **Google** 사용 설정.
3. **Authentication** > 설정 > **승인된 도메인**에 `haeri-kim1108.github.io` 추가.
4. **Firestore Database** (Realtime Database 아님) > 데이터베이스 만들기 > 위치 `nam5 (미국 멀티 리전)` > **프로덕션 모드**.
5. Firestore > **규칙** 탭에 `firestore.rules` 내용을 붙여 넣고 게시.
6. 프로젝트 설정(톱니바퀴) > 내 앱 > **웹 앱 추가(</>)** > 표시되는 `firebaseConfig` 값을 `firebase-config.js`에 붙여 넣기.

## 기록 옮기기

앱에서 로그인한 뒤 **오늘 > 계정과 백업 > 백업 파일 불러오기**로 백업 JSON 파일을 선택하세요.
같은 메뉴의 **백업 파일 내려받기**로 언제든 전체 기록을 파일로 받을 수 있습니다.

## 데이터 구조

```
users/{uid}/cards/{cardId}   표현 하나 (뜻, 예문, 복습 단계, 다음 복습일, 기록)
users/{uid}/meta/stats       날짜별 추가·복습 개수
users/{uid}/meta/settings    하루 목표, 복습 방향
```

## 복습 알림 (처음 한 번)

매일 정한 시간에 GitHub Actions(`.github/workflows/reminders.yml`)가 `reminders/send.js`를 실행해 알림을 보냅니다.

1. Firebase 콘솔 > 프로젝트 설정 > **클라우드 메시징** > 웹 푸시 인증서 > **키 쌍 생성** → 공개 키를 `firebase-config.js`의 `FIREBASE_VAPID_KEY`에 넣기.
2. Firebase 콘솔 > 프로젝트 설정 > **서비스 계정** > **새 비공개 키 생성** → JSON 파일 다운로드.
3. GitHub 저장소 > Settings > Secrets and variables > Actions > **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: 2번 JSON 파일 내용 전체
   - 이 키는 비밀번호와 같습니다. 저장소 파일이나 채팅에 붙여 넣지 마세요.
4. 앱 > 오늘 > **복습 알림**에서 시간을 고르고 **이 기기에서 알림 켜기**.
5. 확인: GitHub 저장소 > Actions > Review reminders > **Run workflow** 를 누르면 모든 기기에 테스트 알림이 갑니다.

- iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있습니다 (iOS 16.4 이상).
- GitHub 예약 작업은 몇 분 늦게 실행될 수 있습니다.
- 저장소에 60일 동안 변경이 없으면 GitHub가 예약 작업을 멈춥니다. 그때는 Actions 탭에서 다시 켜 주세요.

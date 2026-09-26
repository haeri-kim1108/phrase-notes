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

# 꼬마 오목 선생님

AI와 함께하는 오목 게임 프로젝트입니다. 초등학생을 위한 친근하고 재미있는 오목 게임을 제공합니다.

## 주요 기능

- **혼자하기 모드**: AI와 대전하는 싱글플레이어 모드
  - 4가지 난이도: 쉬움, 보통, 어려움, 마스터
  - AI가 오목 전략을 이해하고 적절한 수를 둡니다
- **같이하기 모드**: 친구와 함께하는 멀티플레이어 모드
  - 실시간 WebSocket 통신
  - 대기방 목록 및 방 생성/참여
  - 차례 관리 및 동기화
- **AI 코멘트**: GPT-4o-mini를 활용한 친근한 AI 코멘트
- **게임 기록**: 승패 기록 저장 및 조회 (OMOK 게임 타입만)
- **음성 메시지**: 멀티플레이어 모드에서 음성 메시지 전송 (Web Speech API)
- **재촉하기**: 상대방에게 재촉 메시지 전송
- **PWA 지원**: Progressive Web App으로 모바일에서도 설치 가능

## 기술 스택

### Backend
- Spring Boot 3.2.0
- Spring Data JPA
- Spring WebSocket (STOMP)
- MariaDB
- OpenAI GPT-4o-mini API

### Frontend
- HTML5, CSS3, JavaScript (jQuery)
- Web Speech API (TTS & Speech Recognition)
- SockJS & STOMP.js

## 데이터베이스 설정

이 프로젝트는 여러 게임(OMOK, CHESS, OTHELLO, GO)을 위한 공유 데이터베이스 `games`를 사용합니다.

1. MariaDB 데이터베이스가 이미 존재하는 경우:
   - `game_history`와 `game_rooms` 테이블의 `game_type` ENUM에 `OMOK`가 포함되어 있어야 합니다.
   - 포함되지 않은 경우 다음 SQL을 실행하세요:
   ```sql
   USE games;
   
   ALTER TABLE game_history 
   MODIFY COLUMN game_type ENUM('CHESS','OTHELLO','GO','OMOK') NOT NULL;
   
   ALTER TABLE game_rooms 
   MODIFY COLUMN game_type ENUM('CHESS','OTHELLO','GO','OMOK') NOT NULL;
   ```

2. JPA의 `ddl-auto: update` 설정을 사용하므로 테이블은 자동으로 생성/업데이트됩니다.

## 환경 변수 설정

### 방법 1: application-local.yml 파일 사용 (권장)

1. `src/main/resources/application-local.yml.example` 파일을 복사하여 `application-local.yml` 생성:
```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
```

2. `application-local.yml` 파일에 실제 값 입력:
```yaml
spring:
  datasource:
    url: jdbc:mariadb://your-host:3306/games
    username: your-username
    password: your-password

openai:
  api:
    key: your-openai-api-key
    url: https://api.openai.com/v1/chat/completions
```

### 방법 2: 환경 변수로 설정

환경 변수로 설정:
- `DATASOURCE_URL`: 예) `jdbc:mariadb://localhost:3306/games`
- `DATASOURCE_USERNAME`: 데이터베이스 사용자명
- `DATASOURCE_PASSWORD`: 데이터베이스 비밀번호
- `OPENAI_API_KEY`: OpenAI API 키

## 실행 방법

1. 프로젝트 클론:
```bash
git clone <repository-url>
cd "20251229_꼬마 오목"
```

2. Maven 빌드:
```bash
mvn clean install
```

3. 애플리케이션 실행:
```bash
mvn spring-boot:run
```

4. 브라우저에서 접속:
```
http://localhost:8080
```

## 게임 규칙

- 15x15 오목판에서 진행됩니다.
- 흑색이 먼저 시작합니다.
- 가로, 세로, 대각선으로 5개를 연속으로 놓으면 승리합니다.
- 보드가 가득 차면 무승부입니다.

## AI 난이도 설명

- **🌱 쉬움**: 기본적인 방어와 공격만 수행
- **🌟 보통**: 열린 3목/4목 인식, 수의 가치 평가
- **🔥 어려움**: 더 정확한 수 선택, 주변에 두기 전략
- **👑 마스터**: 최적의 수 선택, 높은 승률

## 주의사항

- 이 프로젝트는 `games` 데이터베이스를 사용하며, `game_type`이 `OMOK`인 데이터만 처리합니다.
- 다른 게임 타입(CHESS, OTHELLO, GO)의 데이터는 영향을 받지 않습니다.
- 데이터베이스의 `game_type` ENUM에 `OMOK`가 포함되어 있어야 합니다.

## 프로젝트 구조

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── omok/
│   │           └── ai/
│   │               ├── config/          # 설정 클래스
│   │               ├── controller/      # REST & WebSocket 컨트롤러
│   │               ├── dto/            # 데이터 전송 객체
│   │               ├── entity/         # JPA 엔티티
│   │               ├── listener/       # WebSocket 이벤트 리스너
│   │               ├── repository/     # JPA 리포지토리
│   │               └── service/        # 비즈니스 로직
│   └── resources/
│       ├── static/
│       │   ├── css/                    # 스타일시트
│       │   ├── js/                     # JavaScript 파일
│       │   │   ├── app.js              # 메인 게임 로직
│       │   │   ├── single-player.js   # 싱글플레이어 AI 로직
│       │   │   └── multiplayer.js     # 멀티플레이어 로직
│       │   ├── index.html              # 메인 페이지
│       │   ├── waiting-rooms.html      # 대기방 목록 페이지
│       │   └── manifest.json           # PWA 매니페스트
│       ├── application.yml             # 애플리케이션 설정
│       └── application-local.yml.example  # 로컬 설정 예시 파일
└── pom.xml                              # Maven 의존성
```

## 라이선스

이 프로젝트는 개인 프로젝트입니다.

## 제작자

소희, 선우 아빠 ❤️


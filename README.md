# SOOP 댓글 좋아요 랭킹

SOOP(구 아프리카TV) 방송국 게시글의 댓글을 전부 불러와, **키워드 그룹별로 나누고 그룹
안에서 좋아요 순위를 매기는** 도구입니다.

"1·2·3번 전형 중 하나를 적고 신청, 선발은 100% 좋아요 수, 각 전형 TOP 33" 같은 공지에서
누가 컷 안에 들었는지 한눈에 보려고 만들었습니다. 그룹 기준은 자유롭게 바꿀 수 있어
전형 구분이 없는 글에도 씁니다.

## 실행

```bash
npm install
npm run dev
```

http://localhost:5173 에서 게시글 주소를 붙여넣고 **불러오기**를 누릅니다.

```
https://www.sooplive.com/station/ecvhao/post/203249055
```

`ecvhao/203249055` 형태로 방송국 ID와 글 번호만 넣어도 됩니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (5173) |
| `npm run build` | 정적 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint |

## 배포

`main`에 push하면 [GitHub Actions](.github/workflows/deploy.yml)가 빌드해서 GitHub Pages에
올립니다. 서버가 필요 없는 순수 정적 파일이라 다른 정적 호스팅에도 `dist/`를 그대로
올리면 됩니다.

`vite.config.js`의 `base: './'` 때문에 자산 경로가 상대 경로로 나옵니다. 도메인 루트든
`/저장소이름/` 하위 경로든 설정을 고치지 않고 그대로 동작합니다.

## 동작 방식

브라우저가 SOOP 공개 API를 직접 호출합니다. 로그인·토큰이 필요 없고 응답에
`Access-Control-Allow-Origin`이 요청 origin으로 되돌아오기 때문에 프록시 없이 붙습니다.

```
GET https://api-channel.sooplive.com/v1.1/channel/{bjId}/post/{postNo}
GET https://api-channel.sooplive.com/v1.1/channel/{bjId}/post/{postNo}/comment
    ?page={n}&orderBy=like_cnt&cCommentNo=0
```

앞의 것이 본문(`content.content`에 HTML), 뒤의 것이 댓글입니다.

- 페이지당 30개 고정 → `meta.lastPage`까지 순회해 전부 모읍니다.
- BEST 댓글은 1페이지 앞에 따로 붙어 오는데 본문 목록과 겹치지 않습니다. 그래도 안전하게
  `pCommentNo` 기준으로 중복을 제거합니다.
- **원댓글만** 다룹니다. 답글(`cComment`)은 세지 않으므로 화면의 "원댓글" 수와 SOOP이
  표시하는 댓글 수(답글 포함)가 다를 수 있습니다.
- 본문은 HTML 이스케이프된 채로 오므로(`&quot;` → `"`) 받는 즉시 디코딩합니다.
  화면에는 텍스트로만 넣기 때문에 이렇게 풀어도 안전합니다.

### 비공식 API를 쓴다는 것

SOOP은 방송국 게시글 댓글에 대한 공개 API를 제공하지 않습니다. 위 주소는 사이트가 내부적으로
쓰는 것이라 언제든 예고 없이 바뀔 수 있고, 그건 막을 방법이 없습니다. 대신 **깨졌을 때
조용히 틀린 답을 내놓지 않도록** 두 가지를 해 뒀습니다.

**1. 실패를 구분해서 알립니다.** 특히 세 번째가 중요합니다 — 예전에는 필드명만 바뀌어도
에러 없이 "댓글 0개"로 보였습니다. 선발 기준이 좋아요 수인 글에서 그건 틀린 답을 자신 있게
내놓는 상태라, 지금은 실패로 끊습니다.

| 깨지는 방식 | 화면에 나오는 말 |
|---|---|
| 연결 실패 (CORS 차단·오프라인) | 인터넷 연결이 끊겼거나 SOOP이 외부 접근을 막았을 수 있다 |
| 댓글 주소만 404 (본문은 정상) | 게시글은 찾았는데 댓글 주소가 응답하지 않는다 → API 변경 |
| 200인데 응답 모양이 다름 | 어느 필드가 없어졌는지 짚어서 알림 |

**2. 매일 자동으로 찔러 봅니다.** [`scripts/check-api.mjs`](scripts/check-api.mjs)가 CORS
헤더·본문·댓글 수집·필드·분류 적중률을 확인하고,
[워크플로](.github/workflows/api-health.yml)가 매일 06:20(KST) 돌려서 실패하면 이슈를
엽니다(이미 열린 이슈가 있으면 댓글만 답니다). 직접 돌려볼 수도 있습니다:

```bash
node scripts/check-api.mjs
```

표본 글은 [`src/lib/sample.js`](src/lib/sample.js) 한 곳에 있습니다. 그 글이 삭제되면
헬스체크가 그렇게 알려 주니 다른 글로 바꾸면 됩니다.

API 주소 자체가 바뀌었을 땐 [`src/lib/soop.js`](src/lib/soop.js)의 `API_BASE`만 고치면
됩니다.

## 분류는 게시글이 정한다

그룹 규칙을 손으로 쓰지 않습니다. 본문을 읽어서 분류를 찾아내고, 못 찾으면 그냥 좋아요
순으로 한 줄 세웁니다.

**1. 후보 찾기** — 본문의 `<ol>` 번호 목록을 먼저 봅니다. 없으면 `1. xxx` / `1번 xxx`가
1부터 연달아 나오는 줄을 찾습니다.

**2. 검색어 만들기** — 후보 이름들을 서로 비교해 그 이름에만 나오는 낱말을 뽑고, 옆 낱말을
붙여 구를 만듭니다. `인기 남자 버튜버 TOP 33` / `인기 여자 버튜버 TOP 33` → `남자 버튜버` /
`여자 버튜버`. 여기에 `2번`, `②`, `/^\s*2[\s.,)]/`(→ `2.`, `2 `, `2)`)를 더해 검색어로 씁니다.
이름에 `TOP 33`이 있으면 뽑을 인원수도 같이 가져옵니다.

**3. 진짜 분류인지 검증** — 방송국 글은 합격자 명단이나 신청 양식도 번호 목록으로 씁니다.
그런 걸로 그룹을 만들면 안 되므로, 후보로 실제 댓글을 분류해 보고 **적중률이 40% 미만이거나
중복 매칭이 60%를 넘으면 버립니다.** 실측하면 갈리는 폭이 큽니다:

| 게시글 | 목록 | 적중률 | 판정 |
|---|---|---|---|
| 배틀그라운드 인기 3종 세트 | 3개 전형 | 98.9% | 분류로 사용 |
| 구독 이모티콘 작가 구인 | 5개 기재 항목 | 0% | 버림 |
| 스모오라 합격자 발표 | 4명 명단 | 0% | 버림 |

버려지면 분류 패널 자체가 뜨지 않고, 탭 없이 좋아요 순 한 줄로만 나옵니다.

### 분류 세부 규칙

- **공백은 무시합니다.** `여자 버튜버`는 `인기여자버튜버`에도 걸립니다.
- **여러 분류에 걸리면 본문에서 먼저 나온 쪽이 이깁니다.** 그 댓글에는 `중복` 배지가 붙습니다.
- **댓글 전문을 검사합니다.** 한때 "앞부분 N자만" 옵션을 뒀지만, 실측해 보니 대부분의
  댓글이 1000자 안쪽이라 분류율·중복률이 똑같아서(배정 1건 차이) 없앴습니다.
- 어디에도 안 걸리면 **미분류** 탭으로 갑니다. 각 댓글 하단 셀렉트로 **수동 지정**할 수
  있고, 수동 지정 내역은 게시글별로 브라우저에 저장됩니다.

예시 글 기준으로 댓글 179개 중 177개가 자동 분류되고 2개만 미분류로 남습니다.

## 순위와 닉네임 추출

순위는 좋아요 내림차순, 동점이면 **먼저 쓴 댓글이 위**입니다.

**닉네임 추출** 버튼을 누르면 분류별로 상위 N명의 닉네임만 뽑아 줍니다. N은 이름에서 읽은
`TOP 33`이 기본값이고 직접 고칠 수 있습니다. 줄바꿈/쉼표, 순위·좋아요 표시 여부를 고른 뒤
분류별로 또는 한 번에 복사합니다.

N번째와 N+1번째의 좋아요가 같으면 **동점 경고**가 뜹니다. 거기서 자르는 건 자의적이므로
직접 판단해야 합니다.


## 개인 증가량 그래프 (기록 서버)

화면 안에서 쌓는 증가량은 창을 닫으면 사라집니다. **개인별 좋아요 추이**를 오래 보려면
누군가 계속 SOOP을 찔러 기록해야 합니다. 그 역할을 VM의 수집기가 맡고, 저장은 Firebase
Realtime Database에 합니다.

```
VM (systemd 타이머, 1분)          Firebase RTDB (무료 Spark)        GitHub Pages
collector/collect.mjs  ──쓰기──▶  posts/{bjId}_{postNo}/  ──읽기──▶  개인 증가량 그래프
                                    meta / comments / points
```

**Firebase 무료 한도 안에서 돌아갑니다.** 단 스케줄러는 Firebase 밖에 두어야 합니다 —
Cloud Functions는 배포 자체가 Blaze(카드 등록) 요금제를 요구하기 때문입니다. 수집기를 VM에서
돌리면 Firebase는 Spark 그대로 씁니다. RTDB Spark 한도는 저장 1GB / 월 다운로드 10GB이고,
연산당 과금이 없어 1분 간격 쓰기에 적합합니다. 게시글 하나에 하루 약 15MB가 쌓이므로,
하루 지난 구간은 수집기가 5분 간격만 남기고 솎아냅니다.

### Firebase 쪽 준비 (한 번만)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들거나 고릅니다.
2. **Realtime Database**를 만듭니다. 지역은 아무거나. 만들 때 "잠금 모드"를 고릅니다.
3. 규칙에 이 저장소의 [`database.rules.json`](database.rules.json) 내용을 붙여넣습니다.
   브라우저는 읽기만 되고 쓰기는 전부 막힙니다 (수집기는 서비스 계정이라 규칙을 우회합니다).
   규칙에는 주석을 넣지 마세요 — 점으로 시작하지 않는 키는 전부 하위 경로 이름으로
   해석돼서 `"//": "설명"` 같은 줄은 저장이 거부됩니다.
4. 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**으로 JSON을 내려받습니다.
   이 파일은 비밀입니다. 저장소에 넣지 마세요 (`.gitignore`에 이미 있습니다).
5. 저장소 Settings → Secrets and variables → Actions → **Variables**에
   `RTDB_URL` 을 데이터베이스 주소(`https://...firebaseio.com`)로 추가합니다.
   넣지 않으면 배포본에서 이 그래프만 조용히 꺼진 채로 나갑니다.

### VM 쪽 준비

```bash
# Node 22 (없다면)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

git clone https://github.com/a-ka1128/soop-comment-rank.git
cd soop-comment-rank

cp collector.env.example collector.env
nano collector.env            # RTDB 주소와 서비스 계정 JSON 경로
# 4번에서 받은 키를 service-account.json 으로 올려 둔다

node collector/collect.mjs    # 한 번 수동 실행해서 기록되는지 확인
```

수집할 게시글은 [`collector/tracked.json`](collector/tracked.json)에 적습니다. 여기 적은
글만 수집하므로 부하가 예측 가능합니다.

수집기는 상주하지 않고 1분마다 한 번 실행되고 끝납니다. 죽은 프로세스를 지키는 것보다
못 돈 1분이 낫습니다. 1분마다 깨우는 방법은 두 가지입니다.

**상주 루프 (sudo 도 cron 도 없을 때)**

이 저장소가 실제로 도는 GCP VM 이 그런 경우다. sudo 가 아예 없어 cron 설치도
`loginctl enable-linger` 도 막힌다. systemd 사용자 타이머는 로그아웃 **8분 뒤** 사용자
매니저와 함께 정리됐다(실측). 대신 logind 의 `KillUserProcesses` 기본값이 `no` 라,
세션에서 떼어 낸 프로세스는 살아남는다.

```bash
setsid nohup ~/soop-comment-rank/deploy/loop-collector.sh >/dev/null 2>&1 &
```

확인·중지:
```bash
tail -f ~/soop-comment-rank/collector.log
kill $(cat ~/soop-comment-rank/collector.pid)
```

재부팅까지 견디지는 못한다. 그건 root 가 있어야 하고, GCP 라면 콘솔에서 VM 메타데이터에
`startup-script` 로 `loginctl enable-linger 사용자` 를 넣어 두는 방법이 있다.

**cron (설치돼 있고 쓸 수 있을 때)**

```bash
crontab -e
```
```cron
* * * * * /home/사용자이름/soop-comment-rank/deploy/run-collector.sh
```

[`deploy/run-collector.sh`](deploy/run-collector.sh)가 `collector.env`를 읽고 node 경로를
찾아 줍니다 — cron은 `.bashrc`를 읽지 않아서 PATH가 비어 있기 때문입니다. 홈에 풀어 둔
node도 자동으로 찾습니다. 로그는 `collector.log`에 쌓이고 5000줄이 넘으면 알아서 잘립니다.

```bash
tail -f ~/soop-comment-rank/collector.log
```

**systemd (root 권한이 있을 때)**

```bash
sudo cp deploy/soop-collector.* /etc/systemd/system/
sudo nano /etc/systemd/system/soop-collector.service   # User/경로를 실제에 맞게
sudo systemctl daemon-reload
sudo systemctl enable --now soop-collector.timer

systemctl list-timers soop-collector.timer   # 다음 실행 시각 확인
journalctl -u soop-collector.service -f      # 기록 로그
```

### 그래프

`개인 증가량 그래프` 버튼에서 최대 5명까지 고르면 선이 그려집니다. 기본은 **구간 증가분**입니다 —
1위(6천)와 100위(80)를 같은 축에 누적값으로 놓으면 아래쪽 선이 바닥에 붙어 보이지 않기
때문에, 구간 시작을 0으로 맞춰 서로 비교되게 합니다. 누적값도 토글로 볼 수 있습니다.

화면은 1분마다 고른 사람 **전원**의 기록을 다시 읽습니다. 처음엔 아직 안 받아 온 사람만
받았는데, 그러면 한 번 받은 사람이 그 시점에 멈춰서 선들의 끝 시각이 서로 어긋났습니다.

선 색은 화면의 올리브·갈색 팔레트를 쓰지 않습니다. 한 계열이라 선끼리 구분되지 않고
색약에서는 더 붙어 버립니다. 검증을 통과한 다섯 색을 여기만 따로 쓰고, 선 끝마다 닉네임을
직접 붙여 색만으로 구분하지 않아도 되게 했습니다.

## 구조

```
scripts/check-api.mjs            SOOP API가 아직 기대대로인지 확인 (매일 자동 실행)
src/
  App.jsx                        화면 전체 상태 (불러오기, 실시간 갱신, 탭, 검색)
deploy/loop-collector.sh         sudo·cron 없이 1분마다 도는 상주 루프
  lib/sample.js                  예시 글 (앱과 헬스체크가 공유)
  lib/soop.js                    URL 파싱 · API 순회 · 실패 구분 · 엔티티 디코딩
  lib/categories.js              본문에서 분류 감지 + 검색어 생성
  lib/groups.js                  분류 · 검증 · 순위 · 상위 N명
  components/GroupPanel.jsx      감지된 분류 표시 (못 찾으면 아예 안 뜸)
  hooks/useFlipReorder.js        순위 변동 시 줄이 미끄러지는 효과
  components/NicknameExport.jsx  상위 N명 닉네임 추출
  components/CommentCard.jsx     댓글 카드 + 수동 분류 지정
  components/PersonChart.jsx     개인별 좋아요 추이 (기록 서버)
  lib/history.js                 RTDB 읽기 (SDK 없이 REST)
collector/collect.mjs            1분마다 SOOP을 찍어 RTDB에 기록 (VM)
deploy/                          systemd 유닛
```

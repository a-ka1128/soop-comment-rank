# SOOP 댓글 좋아요 랭킹 · 확정 명단

SOOP(구 아프리카TV) 방송국 게시글의 댓글을 전부 불러와 **좋아요 순으로 세우고, 선발이
끝나면 그 순위를 굳혀 명단으로 발표하는** 사이트입니다.

"신청은 댓글로, 선발은 100% 좋아요 수, 상위 120명" 같은 공지에서 누가 컷 안에 들었는지
보려고 만들었습니다. 서버가 없습니다. 브라우저가 SOOP API를 직접 부르는 정적 사이트라
GitHub Pages에 그대로 올라갑니다.

**지금 `main`은 와우 포에버 우왁굳 길드 사전 신청을 보여 주는 선발 중 화면입니다**
(2026-10-28~). `live-ranking` 화면을 꺼내 `wow-forever` 브랜치에서 고친 뒤 합쳤습니다.
아래 "두 개의 화면" 표의 선발 중 화면에 다음이 더해졌습니다.

| 무엇 | 어디 |
|---|---|
| 분류를 본문 번호 목록 대신 **와우 직업 9개**로 고정. 댓글의 '직업' 뒤에 처음 나온 직업으로 나눈다 | `src/lib/wow.js` `pickClass` |
| 자동 분류가 틀린 사람 고정 (모든 방문자에게 적용) | `src/lib/wow.js` `CLASS_FIXES` |
| 본인이 적은 경력 꼬리표 — 와튜버 데뷔 · 와점기 70렙 · 하코 출신 · 공대장 · 와우 처음 … | `src/lib/wow.js` `SELF_TAGS` |
| 확인된 크루 (userId → 크루 이름). **비어 있음** — 공개된 명단이 없어 직접 채운다 | `src/lib/crews.js` |
| 두 번째 글 「리얼 뉴 와튜버 데뷔 하기」를 따로 탭으로 | `src/lib/target.js` `DEBUT_POST` |
| 즐찾 수 옆에 SOOP 방송국 가입일 (데뷔일과 다를 수 있음) | `src/lib/soop.js` `fetchStation` |
| 신청 조건(즐찾 1000)으로 처음부터 걸러 둠. 데뷔 탭엔 안 건다 | `src/App.jsx` `MIN_FANS_RULE` |

아래 "새 이벤트로 갈아끼우기"는 이 화면이 끝난 뒤의 이야기입니다. 지난 이벤트(아르마3
랜덤고지전3)의 명단과 편성은 커밋 히스토리에 남아 있고 `git log -- src/lib/roster.js` 로
꺼낼 수 있습니다.

---

## 이 저장소에는 두 개의 화면이 있습니다

선발은 두 단계로 갑니다. 화면도 둘입니다.

| | **선발 중** | **선발 후 (지금 `main`)** |
|---|---|---|
| 어디에 있나 | `live-ranking` 태그 | `main` |
| 순위 | 좋아요 따라 실시간으로 움직임 | 굳어 있음 |
| 화면 | 한 줄 목록, 펼치면 댓글 | 팀별 열 · 고른 사람 댓글 |
| 있는 기능 | 10초 자동 갱신, 순위 변동 화살표, 검색, 애청자 수 필터, 닉네임 추출(CSV), 개인 증가량 그래프, 컷 라인 | 없음 |

**`main`에는 선발용 기능이 없습니다.** 끝난 뒤에 다 걷어냈습니다. 다음 시즌을 시작할 땐
지우고 다시 만드는 게 아니라 태그에서 꺼내 옵니다.

```bash
git checkout live-ranking
```

---

## 실행

```bash
npm install
npm run dev
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (5173) |
| `npm run build` | 정적 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 (4173) |
| `npm run lint` | oxlint |

`main`에 push하면 [GitHub Actions](.github/workflows/deploy.yml)가 빌드해서 GitHub Pages에
올립니다. `vite.config.js`의 `base: './'` 덕분에 도메인 루트든 `/저장소이름/` 하위든
설정을 고치지 않고 동작합니다.

---

## 새 이벤트로 갈아끼우기

### 1. 선발 시작 — 실시간 랭킹 화면 꺼내기

```bash
git checkout -b season4 live-ranking
```

[`src/lib/target.js`](src/lib/target.js) 한 곳만 고치면 대상이 바뀝니다.

```js
export const TARGET_POST = { bjId: '방송국주소', postNo: '게시글번호', url: '...' }
export const CUT_RANK = 119
```

`CUT_RANK`는 그 순위 아래에 컷 라인을 긋습니다. `null`이면 안 긋습니다. 비워 두면
`HAS_TARGET`이 `false`가 되고, 화면은 API를 부르지 않고 스크립트는 일찍 멈춥니다.

간판은 [`src/lib/event.js`](src/lib/event.js) 한 곳에 모여 있습니다.

```js
export const EVENT = {
  title: '확정 명단',
  description: '이름을 누르면 그 사람의 댓글이 보입니다.',
  logo: null,                                    // './logo.png' 처럼. null 이면 자리를 비운다
  roles: {
    leader: { label: '리더', mark: '★' },
    commander: { label: '부리더', mark: '☆' },
  },
}
```

`mark`는 명단 줄에 붙는 한 글자입니다. 열이 좁아 글자로 쓰면 이름을 밀어내서 표식 하나로
줄였습니다. `label`은 댓글 칸과 팀 머리말에 글자로 나옵니다.

여기서 못 고치는 것도 있습니다.

| 무엇 | 어디 | 왜 |
|---|---|---|
| 브라우저 탭 제목 | `index.html`의 `<title>` | 빌드 전 정적 파일이라 `event.js` 값을 못 가져갑니다 |
| 파비콘 | `public/favicon.svg` 교체 | 지금 건 자리 지킴이입니다 |
| 색 | `src/index.css`의 `:root` | 지금은 중립 다크. 열 줄만 바꾸면 화면 전체가 따라옵니다 |
| 배경 이미지 | `src/index.css`의 `body` | 주석에 되살리는 법을 적어 뒀습니다 |

기록 서버(개인 증가량 그래프)까지 쓸 거면 [`collector/tracked.json`](collector/tracked.json)도
같은 글을 가리키게 하세요. 안 쓰면 그래프 버튼만 "기록 없음"으로 뜹니다.

### 2. 선발 끝 — 명단 굳히기

좋아요는 마감 뒤에도 계속 들어옵니다. 그대로 두면 발표한 것과 다른 명단이 됩니다.
[`scripts/freeze-roster.mjs`](scripts/freeze-roster.mjs)가 그 순간의 순위를
[`src/lib/roster.js`](src/lib/roster.js)로 박아 넣습니다.

그냥 상위 N명이면:

```bash
node scripts/freeze-roster.mjs --top 120
```

발표한 이미지처럼 정해진 순서가 따로 있으면 닉네임 배열 JSON을 주세요.
[`scripts/roster-order.json`](scripts/roster-order.json)이 그 자리입니다(지금은 비어 있습니다).

```bash
node scripts/freeze-roster.mjs --order scripts/roster-order.json --fixed 방송국주소=닉네임 --commander "A,B,C"
```

- `--fixed id=닉` — 댓글 없이 맨 앞에 세울 사람(방송인 본인 등). 좋아요 자리는 `—`로 비고,
  없는 댓글로 가는 링크도 안 겁니다.
- `--commander` — `--fixed` 다음 자리로 끌어올릴 사람들.

> **이름을 눈으로 옮기지 마세요.** 스크립트가 모든 닉네임을 실제 댓글과 대조해서, 하나라도
> 안 맞거나 같은 닉이 둘이면 멈춥니다. 지난 시즌에 116개 이름을 옮겼는데 이 검증을 통과하는
> 걸 확인하고 나서야 넣었습니다.

굳힌 뒤 다듬고 확인합니다.

```bash
npx prettier --write --single-quote --no-semi --print-width 100 src/lib/roster.js
```

`roster.js`가 차 있으면 **명단이 먼저고 댓글이 나중입니다.** 순서도 인원도 이 파일이 정하고,
SOOP에서 가져오는 건 본문과 최신 좋아요뿐입니다. API가 죽어도 명단은 굳힌 값으로 그대로
뜹니다. 명단에 있는 사람이 댓글을 지워도 자리를 지킵니다.

### 3. 팀 나누기

편성이 나오면 [`scripts/team-order.json`](scripts/team-order.json)에 팀별 닉네임을 순서대로
적고 돌립니다. 지금은 A팀·B팀 두 칸짜리 빈 틀이 들어 있습니다.

```bash
node scripts/build-teams.mjs
```

[`src/lib/teams.js`](src/lib/teams.js)가 나옵니다. 사람 정보(순위·좋아요·userId)는 확정
명단에서 그대로 가져오고, 이 파일은 **누가 어느 팀 몇 번째인지만** 정합니다. 팀이 몇 개든
화면이 그만큼 열을 만듭니다(`--team-count`).

`leader`와 `commander`는 팀마다 닉네임으로 지정합니다. 화면에 뭐라고 나올지는
`event.js`의 `roles`가 정합니다.

```json
{ "id": "a", "name": "A팀", "faction": null, "color": "#7f8b9e",
  "leader": "닉네임", "commander": "닉네임", "order": ["...", "..."] }
```

`faction`은 팀 이름 옆에 붙는 작은 부제입니다. `null`이면 안 그립니다.

여기서도 손으로 옮기다 나는 실수 세 가지를 검사하고, 하나라도 걸리면 파일을 쓰지 않습니다.

| 검사 | 걸리는 경우 |
|---|---|
| 명단에 없는 이름 | 닉네임을 잘못 옮겼다 |
| 두 팀에 있는 사람 | 옮기다 한 줄을 두 번 넣었다 |
| 어느 팀에도 없는 사람 | 한 명을 빠뜨렸다 |

`color`는 그 팀 열의 강조색입니다. 열 위쪽 띠, 줄 왼쪽 선, 순번 숫자에 쓰입니다.

### 4. 선발용 기능 걷어내기 (선택)

발표만 남길 거면 `main`이 그 모습입니다. 무엇을 지웠는지는 `git show 5851bdf --stat`으로
볼 수 있습니다.

---

## 시즌 배지

[`src/lib/season1.js`](src/lib/season1.js) · [`src/lib/season2.js`](src/lib/season2.js)에
지난 시즌 참가자를 담아 두면 명단에 배지가 붙습니다. **지금은 둘 다 비어 있어 배지가 안
붙습니다.**

```js
export const SEASON2_USER_IDS = new Set(['collet11', '243000'])
export const SEASON2_UNRESOLVED = ['닉네임A', '닉네임B']
```

**닉네임이 아니라 userId로 들고 있습니다.** 닉네임은 수시로 바뀌고 장식이 붙지만
(`마린보이7` ↔ `마린보이_`) userId는 그대로입니다.

`UNRESOLVED`에 남은 이름은 [`src/lib/season.js`](src/lib/season.js)가 화면에서 실시간으로
대조합니다. 명단에 있던 사람이 뒤늦게 댓글을 달면 그때 배지가 붙습니다. 대조는 장식을 떼고
**완전 일치만** 인정합니다.

```
징버거☆  →  징버거    ○
히키☆    →  히키      ×  '히키킹9' 과 다름
제로!    →  제로      ×  '제로콜라학살자' 와 다름
```

접두·포함 일치는 일부러 안 넣었습니다. 그게 예전에 `히키킹9`을 `히키☆`(실제로는
히키comori)에 붙였던 규칙인데, 실시간으로 돌면 사람이 걸러 줄 수가 없습니다. 편집거리 같은
유사도는 더 나빴습니다 — 0.5 근처에서 `아이네`와 `에이레네` 같은 남남이 붙습니다.

애매한 건 자동으로 붙이지 말고 파일 주석에 이유를 남겨 두세요. 나중에 "왜 이건 안 붙였지"
하며 되살리는 걸 막습니다.

---

## 동작 방식

브라우저가 SOOP 공개 API를 직접 호출합니다. 로그인·토큰이 필요 없고 응답의
`Access-Control-Allow-Origin`이 요청 origin으로 되돌아오기 때문에 프록시 없이 붙습니다.

```
GET /v1.1/channel/{bjId}/post/{postNo}
GET /v1.1/channel/{bjId}/post/{postNo}/comment?page={n}&orderBy=like_cnt&cCommentNo=0
GET /v1.1/channel/{userId}/station          → upd.fanCnt 가 애청자 수
```

호스트는 `https://api-channel.sooplive.com` 입니다.

- 페이지당 30개 고정 → `meta.lastPage`까지 순회해 전부 모읍니다.
- **원댓글만** 다룹니다. 답글(`cComment`)은 세지 않으므로 SOOP이 표시하는 댓글 수(답글 포함)와
  다를 수 있습니다.
- 본문은 HTML 이스케이프된 채로 옵니다. 받는 즉시 풉니다.
- 애청자 수는 사람마다 요청이 하나씩 붙습니다. 200명에 약 1.3초(동시 4). 선발 화면에서만
  쓰고 localStorage에 6시간 캐시합니다.

### 비공식 API를 쓴다는 것

SOOP은 방송국 게시글 댓글에 대한 공개 API를 제공하지 않습니다. 위 주소는 사이트가 내부적으로
쓰는 것이라 예고 없이 바뀔 수 있고, 그건 막을 방법이 없습니다. 대신 **깨졌을 때 조용히 틀린
답을 내놓지 않도록** 두 가지를 해 뒀습니다.

**1. 실패를 구분해서 알립니다.** 특히 세 번째가 중요합니다 — 예전에는 필드명만 바뀌어도
에러 없이 "댓글 0개"로 보였습니다. 선발 기준이 좋아요 수인 글에서 그건 틀린 답을 자신 있게
내놓는 상태라, 지금은 실패로 끊습니다.

| 깨지는 방식 | 화면에 나오는 말 |
|---|---|
| 연결 실패 (CORS 차단·오프라인) | 인터넷이 끊겼거나 SOOP이 외부 접근을 막았을 수 있다 |
| 댓글 주소만 404 (본문은 정상) | 게시글은 찾았는데 댓글 주소가 응답하지 않는다 → API 변경 |
| 200인데 응답 모양이 다름 | 어느 필드가 없어졌는지 짚어서 알림 |

**2. 매일 자동으로 찔러 봅니다.** [`scripts/check-api.mjs`](scripts/check-api.mjs)가 CORS
헤더·본문·댓글 수집·필드를 확인하고, [워크플로](.github/workflows/api-health.yml)가 매일
06:20(KST) 돌려서 실패하면 이슈를 엽니다(이미 열린 이슈가 있으면 댓글만 답니다).

```bash
node scripts/check-api.mjs
```

대상 글은 `src/lib/target.js`를 그대로 씁니다. **지금처럼 대상 글이 비어 있으면 헬스체크는
조용히 통과합니다** — 찔러 볼 데가 없는데 매일 실패해서 이슈를 열면 알림이 무의미해집니다.
API 주소 자체가 바뀌었을 땐 [`src/lib/soop.js`](src/lib/soop.js)의 `API_BASE`만 고치면 됩니다.

---

## 기록 서버 (지금 꺼져 있음)

개인 증가량 그래프는 1분마다 좋아요를 찍어 둔 기록이 있어야 그려집니다. GCP VM의 수집기가
Firebase Realtime Database에 쌓는 구조였고, **선발이 끝나 2026-08-22에 껐습니다.**

다시 켤 일이 있으면 [`collector/`](collector/)와 [`deploy/`](deploy/)가 그대로 있습니다.
VM에서:

```bash
cd ~/soop-comment-rank && git pull && setsid nohup deploy/loop-collector.sh >/dev/null 2>&1 &
```

- `collector/tracked.json`의 `posts`가 비어 있으면 수집할 게 없습니다. 먼저 채우세요.
- `collector.env`에 `SOOP_RTDB_URL`, `SOOP_SERVICE_ACCOUNT`(서비스 계정 JSON 경로)가 필요합니다.
  **둘 다 gitignore 대상입니다. 커밋하지 마세요.**
- 프런트는 `.env`의 `VITE_RTDB_URL`을 봅니다. 비어 있으면 그래프 기능만 조용히 꺼집니다.
- RTDB 규칙은 [`database.rules.json`](database.rules.json) — `posts/*`만 읽기 공개, 쓰기는
  서비스 계정만. **규칙 파일에는 주석을 쓸 수 없습니다.** `"//"` 같은 키를 넣으면 하위 경로로
  해석돼 배포가 거부됩니다.
- 쓰기는 **좁은 경로로** 해야 합니다. RTDB는 "쓰는 위치에 이미 있는 데이터"의 크기로 한계를
  거는데, 예전에 루트에 PATCH했다가 데이터가 커지자 하루 만에 거부당했습니다
  (`Data to write exceeds the maximum size`). 지금은 사람별 경로로 나눠 씁니다.
- Cloud Functions는 Blaze(유료) 플랜이 필요해서 스케줄러를 Firebase 안에 둘 수 없습니다.
  그래서 VM에서 돌립니다.

수집기를 멈추려면:

```bash
systemctl --user disable --now soop-collector.timer; pkill -9 -f loop-collector; pkill -9 -f run-collector; pkill -9 -f collect.mjs; rm -f ~/soop-comment-rank/collector.pid
```

그다음 `ps -ef | grep -E 'collector|collect.mjs' | grep -v grep`에 아무것도 안 나오면 끝입니다.
부팅할 때 되살아나게 걸어 뒀다면 GCP 콘솔 → VM 인스턴스 → 수정 → 메타데이터에서
`startup-script`를 지워야 합니다.

---

## 파일 지도

`[*]`는 새 이벤트로 갈아끼울 때 손대는 파일입니다. `[비어 있음]`은 지금 뼈대만 남은 파일.

```
src/
  App.jsx              화면 전체. 팀별로 열을 세우고 오른쪽에 댓글 칸을 둔다
  components/
    RosterRow.jsx      명단 한 줄
    CommentDetail.jsx  고른 사람의 댓글을 크게 보여 주는 칸
  lib/
    event.js       [*] 간판 — 제목·설명·로고·역할 이름. 갈아끼울 때 첫 번째로 고칠 파일
    target.js      [*] 어느 글을 다루는지          [비어 있음]
    roster.js      [*] 확정 명단. freeze-roster.mjs 가 만든다. 손으로 고치지 말 것  [비어 있음]
    teams.js       [*] 팀 편성. build-teams.mjs 가 만든다. 손으로 고치지 말 것      [비어 있음]
    soop.js            API 클라이언트. 실패를 kind 로 구분해 던진다
    season.js          시즌 배지 판정 (userId + 닉네임 실시간 대조)
    season1.js     [*] 지난 시즌 명단                                              [비어 있음]
    season2.js     [*] 지난 시즌 명단                                              [비어 있음]
    categories.js      본문에서 분류를 찾아낸다 — 지금 화면에선 안 쓴다
    groups.js          분류·순위·닉네임 추출 — 헬스체크와 live-ranking 이 쓴다
scripts/
  freeze-roster.mjs    [*] 명단 굳히기
  roster-order.json    발표된 순서를 적는 자리                                     [비어 있음]
  build-teams.mjs      [*] 팀 나누기
  team-order.json      팀 편성을 적는 자리 (A팀·B팀 빈 틀)                         [비어 있음]
  check-api.mjs        API 헬스체크. 대상 글이 없으면 건너뛴다
public/
  favicon.svg          자리 지킴이. 로고가 생기면 갈아끼운다
collector/, deploy/    기록 서버 (지금 꺼짐)
```

`categories.js`와 `groups.js`는 지금 화면이 쓰지 않지만 지우지 마세요. 매일 도는 헬스체크가
이걸로 응답 형식을 검사하고, `live-ranking` 화면이 통째로 의존합니다.

---

## 갈아끼울 때 밟을 순서

```
1. git checkout -b season4 live-ranking
2. src/lib/target.js       게시글 주소
3. src/lib/event.js        제목 · 역할 이름 · 로고
   index.html              탭 제목,  public/favicon.svg  파비콘
   src/index.css           색 (필요하면)
4. src/lib/season*.js      지난 시즌 배지 (필요하면)
5. (선발 진행)
6. node scripts/freeze-roster.mjs --top N
7. scripts/team-order.json 채우고  node scripts/build-teams.mjs
8. npm run build && git push
```

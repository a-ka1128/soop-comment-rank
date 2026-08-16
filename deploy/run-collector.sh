#!/bin/sh
# cron 에서 수집기를 돌리기 위한 껍데기.
#
# cron 은 .bashrc 를 읽지 않아 PATH 도 환경변수도 비어 있다. 그래서 여기서
# collector.env 를 직접 읽고 node 경로를 찾아 준다. crontab 한 줄에 다 밀어넣는 것보다
# 이렇게 두면 나중에 경로가 바뀌어도 crontab 을 건드릴 일이 없다.
#
#   crontab -e
#   * * * * * /home/사용자/soop-comment-rank/deploy/run-collector.sh

set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

set -a
. ./collector.env
set +a

# 홈에 풀어 둔 node 를 먼저 찾고, 없으면 시스템 node 를 쓴다.
NODE=$(command -v node 2>/dev/null || true)
for candidate in "$HOME"/node-v*/bin/node; do
  [ -x "$candidate" ] && NODE="$candidate" && break
done
if [ -z "$NODE" ]; then
  echo "node 를 찾지 못했습니다." >&2
  exit 127
fi

LOG="$ROOT/collector.log"
"$NODE" collector/collect.mjs >>"$LOG" 2>&1
status=$?

# 로그가 무한정 자라지 않게 최근 것만 남긴다 (하루 1440줄쯤 쌓인다).
if [ "$(wc -l <"$LOG")" -gt 5000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

exit $status

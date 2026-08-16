#!/bin/sh
# systemd 타이머도 cron도 못 쓸 때 쓰는 방식. 그냥 계속 도는 프로세스 하나다.
#
# 이 VM 계정에는 sudo 가 없어서 cron 설치도, loginctl enable-linger 도 막혀 있다.
# systemd 사용자 타이머는 로그아웃 몇 분 뒤 사용자 매니저와 함께 정리된다(실측: 8분).
# 반면 logind 의 KillUserProcesses 기본값이 no 라, 세션에서 떼어 낸 프로세스는 살아남는다.
#
#   setsid nohup ~/soop-comment-rank/deploy/loop-collector.sh >/dev/null 2>&1 &
#
# 재부팅까지 견디지는 못한다. 그건 root 가 있어야 한다.

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PIDFILE="$ROOT/collector.pid"

# 이미 돌고 있으면 두 개가 되지 않게 한다.
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "이미 실행 중입니다 (pid $(cat "$PIDFILE"))."
  exit 0
fi
echo $$ >"$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT INT TERM

while true; do
  "$ROOT/deploy/run-collector.sh" || true
  # 분 경계에 맞춰 자서 기록 간격이 밀리지 않게 한다.
  sleep $((60 - $(date +%-S)))
done

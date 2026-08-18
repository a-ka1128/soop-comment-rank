#!/bin/bash
#
# GCP VM 메타데이터의 startup-script 에 넣는 내용. 부팅할 때마다 root 로 실행된다.
# 콘솔 → Compute Engine → VM 인스턴스 → 수정 → 메타데이터 →
#   키: startup-script   값: 이 파일 내용 전체
#
# VM 안에 sudo 가 없어도 된다. 메타데이터는 콘솔 권한으로 넣는 것이고,
# 실행은 root 가 대신 해 준다.
set -u

USER_NAME=acku165
APP="/home/$USER_NAME/soop-comment-rank"

# 로그인 세션이 없어도 사용자 systemd 가 살아 있게 한다.
# 지금은 루프로 돌지만, 나중에 사용자 타이머로 바꿀 때 이게 있어야 한다.
loginctl enable-linger "$USER_NAME" || true

# 수집 루프를 사용자 권한으로 띄운다.
# 스크립트 안에 중복 실행 방지가 있어서 이미 돌고 있으면 그냥 빠진다.
runuser -l "$USER_NAME" -c "setsid nohup '$APP/deploy/loop-collector.sh' >/dev/null 2>&1 &" || true

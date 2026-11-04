/**
 * '버튜버만' 거르기 기준. 신청자는 전원 버튜버로 보고, 어드민이 카드를 펼쳐 '버튜버 아님'을
 * 체크한 사람(라벨의 notVtuber)만 뺀다. 라벨은 Firebase 에 저장돼 모든 방문자에게 바로 적용된다.
 */
export function isVtuber(label) {
  return label?.notVtuber !== true
}

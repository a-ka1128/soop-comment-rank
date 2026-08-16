import { useLayoutEffect, useRef } from 'react'

const DURATION = 420
const EASING = 'cubic-bezier(.2,.8,.2,1)'

/**
 * 목록이 다시 정렬됐을 때 각 칸이 예전 자리에서 새 자리로 미끄러지게 한다.
 * 2열 배치라 가로·세로 양쪽을 다 따라간다.
 *
 * FLIP 방식이다. 브라우저가 이미 새 위치로 그려 놓은 뒤에, 옛 위치로 되돌리는
 * transform을 걸고 곧바로 그걸 풀어 준다. 레이아웃은 한 번만 확정되므로
 * 줄이 백 개가 넘어도 부담이 없다.
 *
 * requestAnimationFrame으로 되돌리지 않는 이유: 창이 가려져 있으면 rAF 콜백이
 * 아예 실행되지 않아 줄이 어긋난 채로 굳어 버린다(실제로 27줄이 그렇게 멈췄다).
 * 대신 강제 리플로우 한 번으로 시작점을 확정시키고 같은 프레임에서 되돌린다.
 *
 * 위치는 매 렌더마다 기록하되 애니메이션은 shouldAnimate가 참일 때만 건다.
 * 탭을 옮기거나 검색해서 목록이 통째로 갈릴 때까지 미끄러지면 정신없다.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {() => boolean} takeAnimateFlag 애니메이션 여부를 한 번 소비하는 함수
 */
export function useFlipReorder(containerRef, takeAnimateFlag) {
  const positions = useRef(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const wanted = takeAnimateFlag()
    const nodes = [...container.querySelectorAll('[data-flip-id]')]

    // 앞선 실행이 남긴 인라인 스타일을 먼저 걷어낸다. 이게 없으면 도중에 렌더가
    // 한 번 더 일어났을 때 옮겨진 채로 남는다. transform은 레이아웃에 영향을 주지
    // 않으므로 아래 offsetTop 측정과는 무관하다.
    for (const node of nodes) {
      if (node.style.transform || node.style.transition) {
        node.style.transform = ''
        node.style.transition = ''
        node.classList.remove('is-moving')
      }
    }

    const animate =
      wanted &&
      !document.hidden &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const next = new Map()
    const moved = []

    for (const node of nodes) {
      const id = node.dataset.flipId
      // 2열이 되면서 가로 이동도 생겼다. offsetTop/Left 는 이미 계산된 값이라
      // 읽어도 리플로우가 생기지 않는다.
      const spot = { top: node.offsetTop, left: node.offsetLeft }
      next.set(id, spot)

      const before = positions.current.get(id)
      if (animate && before && (before.top !== spot.top || before.left !== spot.left)) {
        moved.push([node, before.left - spot.left, before.top - spot.top])
      }
    }
    positions.current = next

    if (moved.length === 0) return

    for (const [node, dx, dy] of moved) {
      node.classList.add('is-moving')
      node.style.transition = 'none'
      node.style.transform = `translate(${dx}px, ${dy}px)`
    }

    // 여기서 한 번만 레이아웃을 확정시켜 위 transform이 출발점으로 인정되게 한다.
    void container.offsetHeight

    for (const [node] of moved) {
      node.style.transition = `transform ${DURATION}ms ${EASING}`
      node.style.transform = ''
    }

    const done = setTimeout(() => {
      for (const [node] of moved) {
        node.style.transition = ''
        node.classList.remove('is-moving')
      }
    }, DURATION + 60)

    return () => clearTimeout(done)
  })
}

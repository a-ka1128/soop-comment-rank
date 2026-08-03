import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 상대 경로로 뽑아 두면 도메인 루트든 /저장소이름/ 하위 경로든 그대로 동작한다.
  // 클라이언트 라우팅이 없는 단일 페이지라 이걸로 충분하다.
  base: './',
})

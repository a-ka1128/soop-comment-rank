/**
 * 이 PC 에서 방송 중 목록을 만들어 live-data 브랜치에 올린다. watch-live.yml 과 같은 일을 하되,
 * GitHub 예약 실행이 밀릴 때를 대비해 작업 스케줄러가 5분마다 부른다.
 *
 *   node scripts/publish-live.mjs
 *
 * 푸시 권한은 gh 에 로그인된 a-ka1128 계정의 토큰을 그때그때 꺼내 쓴다. 활성 계정이 바뀌어
 * 있어도 영향받지 않고, 토큰은 파일에 남기지 않는다.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = 'a-ka1128/soop-comment-rank'
const root = resolve(import.meta.dirname, '..')
const work = mkdtempSync(join(tmpdir(), 'soop-live-'))
const git = (args, opts = {}) => execFileSync('git', args, { cwd: work, stdio: 'pipe', ...opts })

try {
  execFileSync('node', [join(root, 'scripts/watch-live.mjs'), join(work, 'live.json')], {
    cwd: root,
    stdio: 'inherit',
  })
  const token = execFileSync('gh', ['auth', 'token', '--user', 'a-ka1128'], { encoding: 'utf8' }).trim()
  git(['init', '-q', '-b', 'live-data'])
  git(['config', 'user.name', 'local-live-publisher'])
  git(['config', 'user.email', 'a-ka1128@users.noreply.github.com'])
  git(['add', 'live.json'])
  git(['commit', '-q', '-m', `live ${new Date().toISOString()}`])
  git(['push', '-q', '--force', `https://x-access-token:${token}@github.com/${REPO}.git`, 'live-data'])
  console.log('live-data 에 올렸습니다.')
} finally {
  rmSync(work, { recursive: true, force: true })
}

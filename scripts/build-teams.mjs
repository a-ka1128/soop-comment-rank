/**
 * 팀 편성(src/lib/teams.js)을 만든다.
 *
 *   node scripts/build-teams.mjs [--in scripts/team-order.json] [--out src/lib/teams.js]
 *
 * 입력은 팀별 닉네임 배열이다. 확정 명단(src/lib/roster.js)과 대조해서
 *
 *   - 명단에 없는 이름이 있으면            → 멈춘다
 *   - 같은 사람이 두 팀에 들어가 있으면     → 멈춘다
 *   - 명단에 있는데 어느 팀에도 없으면      → 멈춘다
 *
 * 세 가지 다 손으로 옮기다 나는 실수라, 통과하기 전에는 파일을 쓰지 않는다.
 * 순위·좋아요·userId 는 명단에서 그대로 가져온다. 여기서 새로 정하지 않는다.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { FROZEN_ROSTER } from '../src/lib/roster.js'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const inPath = arg('in', 'scripts/team-order.json')
const outPath = arg('out', 'src/lib/teams.js')

const teams = JSON.parse(await readFile(inPath, 'utf8'))

const byNick = new Map()
for (const entry of FROZEN_ROSTER) {
  if (byNick.has(entry.nick)) throw new Error(`명단에 '${entry.nick}' 이 둘 있습니다.`)
  byNick.set(entry.nick, entry)
}

const used = new Map()
const built = []

for (const team of teams) {
  const members = team.order.map((nick, i) => {
    const entry = byNick.get(nick)
    if (!entry) throw new Error(`[${team.name}] '${nick}' 은 확정 명단에 없습니다.`)
    if (used.has(nick)) throw new Error(`'${nick}' 이 ${used.get(nick)} 와 ${team.name} 양쪽에 있습니다.`)
    used.set(nick, team.name)

    const role =
      nick === team.leader ? 'leader' : nick === team.commander ? 'commander' : null
    return { seat: i + 1, ...entry, role }
  })

  if (team.leader && !used.has(team.leader)) throw new Error(`[${team.name}] 총지휘관이 명단에 없습니다.`)
  built.push({ ...team, members })
}

const left = FROZEN_ROSTER.filter((e) => !used.has(e.nick))
if (left.length > 0) {
  throw new Error(`어느 팀에도 없는 사람 ${left.length}명: ${left.map((e) => e.nick).join(', ')}`)
}

const q = (s) => JSON.stringify(s)
const member = (m) =>
  `      { seat: ${m.seat}, rank: ${m.rank}, id: ${typeof m.id === 'string' ? q(m.id) : m.id},` +
  ` userId: ${q(m.userId)}, nick: ${q(m.nick)}, likes: ${m.likes === null ? 'null' : m.likes}` +
  `${m.role ? `, role: ${q(m.role)}` : ''} },`

const block = (t) =>
  [
    '  {',
    `    id: ${q(t.id)},`,
    `    name: ${q(t.name)},`,
    `    faction: ${q(t.faction)},`,
    `    color: ${q(t.color)},`,
    '    members: [',
    t.members.map(member).join('\n'),
    '    ],',
    '  },',
  ].join('\n')

const body = [
  '/**',
  ` * 팀 편성. ${built.map((t) => `${t.name} ${t.members.length}명`).join(' · ')}.`,
  ' *',
  ' * scripts/build-teams.mjs 가 만든 파일이다. 손으로 고치지 말고 다시 돌릴 것.',
  ' * 편성은 scripts/team-order.json 에 있고, 사람 정보는 확정 명단에서 그대로 가져온다.',
  ' *',
  ' *   rank  전체 확정 명단에서의 순위',
  ' *   seat  팀 안에서의 자리',
  ' *   role  leader 총지휘관 · commander 지휘관',
  ' */',
  'export const TEAMS = [',
  built.map(block).join('\n'),
  ']',
  '',
  '/** 팀을 가로지르는 전체 인원. */',
  'export const ALL_MEMBERS = TEAMS.flatMap((t) => t.members)',
  '',
].join('\n')

await writeFile(outPath, body, 'utf8')
console.log(`${outPath} 에 적었습니다.`)
for (const t of built) {
  const leader = t.members.find((m) => m.role === 'leader')
  const commander = t.members.find((m) => m.role === 'commander')
  console.log(
    `  ${t.name} (${t.faction}) ${t.members.length}명` +
      ` — 총지휘관 ${leader?.nick ?? '없음'} · 지휘관 ${commander?.nick ?? '없음'}`
  )
}
console.log(`  합계 ${built.reduce((n, t) => n + t.members.length, 0)}명 / 명단 ${FROZEN_ROSTER.length}명`)

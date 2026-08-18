import { createSign } from 'node:crypto'

/**
 * Realtime Database에 서비스 계정으로 쓰기 위한 최소 클라이언트.
 *
 * firebase-admin을 쓰지 않는다. 하는 일이 "토큰 받아서 PATCH" 뿐이라 SDK 하나를
 * 통째로 들이는 대신 표준 라이브러리로 끝낸다. VM에 npm install 할 것이 없어진다.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPES = [
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function signJwt({ client_email, private_key }, now) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: client_email,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  )
  const body = `${header}.${claim}`
  const signature = createSign('RSA-SHA256').update(body).sign(private_key)
  return `${body}.${b64url(signature)}`
}

export class Rtdb {
  /**
   * @param {string} databaseUrl 예: https://프로젝트-default-rtdb.firebaseio.com
   * @param {{client_email: string, private_key: string}} serviceAccount
   */
  constructor(databaseUrl, serviceAccount) {
    this.base = databaseUrl.replace(/\/$/, '')
    this.account = serviceAccount
    this.token = null
    this.tokenExpiry = 0
  }

  async accessToken() {
    const now = Math.floor(Date.now() / 1000)
    // 만료 1분 전에 미리 갈아 끼운다.
    if (this.token && now < this.tokenExpiry - 60) return this.token

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signJwt(this.account, now),
      }),
    })
    if (!res.ok) {
      throw new Error(`구글 토큰 발급 실패 (HTTP ${res.status}): ${await res.text()}`)
    }
    const body = await res.json()
    this.token = body.access_token
    this.tokenExpiry = now + (body.expires_in ?? 3600)
    return this.token
  }

  async request(method, path, payload) {
    const token = await this.accessToken()
    const res = await fetch(`${this.base}/${path}.json`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })
    if (!res.ok) {
      throw new Error(`RTDB ${method} ${path} 실패 (HTTP ${res.status}): ${await res.text()}`)
    }
    return res.status === 204 ? null : res.json()
  }

  /**
   * 여러 경로를 한 번에 갱신한다. 키가 깊은 경로여도 된다.
   *
   * 주의: RTDB는 "쓰는 위치에 있는 데이터 크기"로 한계를 건다. 그래서 루트에 PATCH를
   * 보내면 보내는 양이 작아도 데이터베이스 전체가 커지는 순간 거부된다
   * ("Data to write exceeds the maximum size that can be modified with a single request").
   * 실제로 하루치가 쌓이자 그렇게 멈췄다. 항상 좁은 경로에 쓸 것.
   */
  update(path, values) {
    if (!path) throw new Error('루트에 PATCH하지 말 것 — 좁은 경로를 지정해야 한다.')
    return this.request('PATCH', path, values)
  }

  put(path, value) {
    return this.request('PUT', path, value)
  }

  /** 여러 요청을 동시에 몇 개씩만 굴린다. 순차로 하면 171개가 30초를 넘긴다. */
  static async inBatches(items, size, run) {
    for (let i = 0; i < items.length; i += size) {
      await Promise.all(items.slice(i, i + size).map(run))
    }
  }

  get(path) {
    return this.request('GET', path)
  }

  remove(path) {
    return this.request('DELETE', path)
  }
}

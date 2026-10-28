import { useEffect, useState } from 'react'
import { labelsEnabled } from './labels.js'

/**
 * 어드민 로그인. 주소 끝이 #admin 일 때만 켜진다.
 *
 * Firebase Auth SDK 는 수백 KB 라 방문자 대부분에게는 필요 없다. #admin 으로 들어온
 * 때에만 불러온다(동적 import) — 일반 화면 번들에는 들어가지 않는다.
 *
 * 설정값(apiKey, authDomain)은 비밀이 아니다. Firebase 웹 설정은 원래 페이지에 그대로
 * 실리는 값이고, 쓰기를 막는 건 database.rules.json 이다.
 */
const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
}

export const adminConfigured = () => Boolean(CONFIG.apiKey && CONFIG.authDomain && labelsEnabled())

// 팝업 로그인이 실패할 때 화면에 띄울 말. 앱 안 브라우저처럼 팝업을 막는 곳에서는 조용히 실패한다.
const SIGN_IN_ERRORS = {
  'auth/popup-blocked': '로그인 팝업이 막혔습니다. 크롬 같은 일반 브라우저에서 팝업을 허용하고 다시 누르세요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 눌러 주세요.',
  'auth/cancelled-popup-request': '로그인 창이 닫혔습니다. 다시 눌러 주세요.',
  'auth/unauthorized-domain': '이 주소는 Firebase 승인된 도메인에 없습니다. Authentication → 설정에서 추가하세요.',
  'auth/operation-not-allowed': 'Firebase Authentication 에서 Google 로그인이 꺼져 있습니다.',
}

const isAdminRoute =() => window.location.hash === '#admin'

let authPromise = null

function loadAuth() {
  authPromise ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(
    ([appMod, authMod]) => {
      const app = appMod.initializeApp(CONFIG)
      return { auth: authMod.getAuth(app), mod: authMod }
    },
  )
  return authPromise
}

/**
 * @returns {{
 *   route: boolean,       #admin 으로 들어왔는지
 *   configured: boolean,  Firebase 설정이 들어 있는지
 *   user: null | {uid: string, email: string},
 *   signIn: () => Promise<void>,
 *   signOut: () => Promise<void>,
 *   getToken: () => Promise<string>,
 * }}
 */
export function useAdmin() {
  const [route, setRoute] = useState(isAdminRoute)
  const [user, setUser] = useState(null)
  const configured = adminConfigured()

  useEffect(() => {
    const onHash = () => setRoute(isAdminRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!route || !configured) return
    let unsubscribe = () => {}
    let alive = true
    loadAuth().then(({ auth, mod }) => {
      if (!alive) return
      unsubscribe = mod.onAuthStateChanged(auth, (u) =>
        setUser(u ? { uid: u.uid, email: u.email ?? '' } : null),
      )
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [route, configured])

  return {
    route,
    configured,
    user: route ? user : null,
    signIn: async () => {
      const { auth, mod } = await loadAuth()
      try {
        await mod.signInWithPopup(auth, new mod.GoogleAuthProvider())
      } catch (e) {
        throw new Error(SIGN_IN_ERRORS[e.code] ?? `로그인 실패: ${e.code ?? e.message}`)
      }
    },
    signOut: async () => {
      const { auth, mod } = await loadAuth()
      await mod.signOut(auth)
    },
    getToken: async () => {
      const { auth } = await loadAuth()
      if (!auth.currentUser) throw new Error('로그인이 풀렸습니다. 다시 로그인하세요.')
      return auth.currentUser.getIdToken()
    },
  }
}

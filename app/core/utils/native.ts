/**
 * 安卓离线版（Capacitor）专用的小工具。
 * 网页版构建时 __TW_APP__ 为 false，这里的逻辑全部不生效。
 */
import { get as idbGet, set as idbSet, keys as idbKeys } from 'idb-keyval'

export const IS_APP: boolean = typeof __TW_APP__ !== 'undefined' && __TW_APP__

/** 官方资源站：APP 里没内置的词典/音频，联网时从这里下载 */
export const ONLINE_RESOURCE_URL = 'https://files.typewords.cc'

const DICT_CACHE_PREFIX = 'tw-app-dict-cache:'

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export function isNativeAndroid(): boolean {
  if (!IS_APP || typeof window === 'undefined') return false
  const cap = (window as any).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** 文章音频：内置的走本地，其余联网走官方资源站 */
export function resolveSoundUrl(src: string): string {
  if (!IS_APP || !src) return src
  if (/^(https?:|blob:|data:)/.test(src)) return src
  const bundled = typeof __TW_BUNDLED_SOUNDS__ !== 'undefined' ? __TW_BUNDLED_SOUNDS__ : []
  if (!src.startsWith('/sound/article/')) return src
  let decoded = src
  try {
    decoded = decodeURI(src)
  } catch {}
  if (bundled.includes(src) || bundled.includes(decoded)) return src
  return ONLINE_RESOURCE_URL + encodeURI(decoded)
}

/**
 * 读取词典 JSON：先读 APP 内置文件，再读本机缓存，最后联网下载并缓存（下载过一次以后就能离线用）。
 */
export async function fetchDictJson(localUrl: string, resourcePath: string): Promise<any> {
  if (!IS_APP) return fetch(localUrl).then(r => r.json())
  // 1. APP 内置
  try {
    const r = await fetch(localUrl)
    if (r.ok) {
      const text = await r.text()
      // 找不到文件时，SPA 会回退成 index.html，这里要排除
      if (!text.trimStart().startsWith('<')) return JSON.parse(text)
    }
  } catch {}
  // 2. 本机缓存
  const cacheKey = DICT_CACHE_PREFIX + resourcePath
  try {
    const cached = await idbGet(cacheKey)
    if (cached) return cached
  } catch {}
  // 3. 联网下载
  let data: any
  try {
    if (!isOnline()) throw new Error('offline')
    const r = await fetch(ONLINE_RESOURCE_URL + resourcePath)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    data = await r.json()
  } catch (e) {
    const msg = '这本没有内置在 APP 里，需要联网下载一次，之后就能离线使用'
    import('@/base').then(m => m.Toast?.warning?.(msg, { duration: 5000 } as any)).catch(() => {})
    throw e
  }
  try {
    await idbSet(cacheKey, data)
  } catch {}
  return data
}

/** 已下载缓存到本机的词典路径 */
export async function listCachedDicts(): Promise<string[]> {
  try {
    const all = await idbKeys()
    return all.map(String).filter(k => k.startsWith(DICT_CACHE_PREFIX)).map(k => k.slice(DICT_CACHE_PREFIX.length))
  } catch {
    return []
  }
}

let ttsPlugin: any = null
async function getTts() {
  if (!isNativeAndroid()) return null
  if (!ttsPlugin) {
    const mod = await import('@capacitor-community/text-to-speech')
    ttsPlugin = mod.TextToSpeech
  }
  return ttsPlugin
}

/** 用手机自带的语音引擎朗读（不需要联网） */
export async function nativeSpeak(
  text: string,
  options: { lang?: string; rate?: number; volume?: number; pitch?: number } = {}
): Promise<boolean> {
  const tts = await getTts()
  if (!tts) return false
  try {
    await tts.stop().catch(() => {})
    await tts.speak({
      text,
      lang: options.lang ?? 'en-US',
      rate: Math.min(Math.max(options.rate ?? 1, 0.1), 2),
      volume: options.volume ?? 1,
      pitch: options.pitch ?? 1,
      category: 'playback',
      queueStrategy: 0,
    })
    return true
  } catch (e) {
    console.warn('[tts]', e)
    return false
  }
}

export function nativeStopSpeak() {
  if (!isNativeAndroid()) return
  void getTts().then(t => t?.stop().catch(() => {}))
}

import { IS_APP } from '@/core/utils/native'

// 安卓离线版：打开 APP 直接进“单词”页，不显示官网首页
export default defineNuxtPlugin(nuxtApp => {
  if (!IS_APP) return
  document.documentElement.classList.add('tw-app')
  const router = useRouter()
  router.beforeEach(to => {
    if (to.path === '/' || to.path === '/index.html') return { path: '/words', replace: true }
  })
})

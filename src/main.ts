import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

/**
 * uni-app Vue3 入口。必须导出 `createApp` 工厂，由框架调用（SSR/多端共用同一份代码）。
 * Pinia 挂在这里而不是 App.vue 里，保证任何页面 `useXxxStore()` 都能拿到同一个实例。
 */
export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}

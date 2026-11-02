import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  // GitHub Pages 把站点挂在 /interview-box/ 子路径下，产物里的资源就必须带这个前缀，
  // 否则 /assets/*.js 会 404。只有部署时才设 UNI_H5_BASE，本地预览与小程序构建仍是 '/'。
  base: process.env.UNI_H5_BASE || '/',
  plugins: [uni()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
})

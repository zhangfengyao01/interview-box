<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'

/**
 * 应用入口：只做一件事 —— 把数据库拉起来。
 *
 * 失败不弹窗轰炸用户：`bootstrap()` 内部已经把 SQLite 失败降级成 storage，
 * 真正抛出来说明 storage 也不可用（极端情况），此时给一次提示即可。
 */
onLaunch(() => {
  const app = useAppStore()
  app.bootstrap().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    uni.showToast({ title: `数据初始化失败：${message}`, icon: 'none', duration: 3000 })
  })
})

onShow(() => {
  /* 预留：切回前台时刷新汇总数字 */
})
</script>

<style lang="scss">
@use '@/styles/global.scss' as *;
</style>

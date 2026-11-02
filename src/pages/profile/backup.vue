<template>
  <view class="screen">
    <NavBar title="备份与恢复" />

    <view class="overview card">
      <text class="ov-title">当前数据</text>
      <view class="ov-grid">
        <view class="ov-item">
          <text class="ov-num">{{ info.questions }}</text>
          <text class="ov-label">题目</text>
        </view>
        <view class="ov-item">
          <text class="ov-num">{{ info.categories }}</text>
          <text class="ov-label">分类</text>
        </view>
        <view class="ov-item">
          <text class="ov-num">{{ info.tags }}</text>
          <text class="ov-label">标签</text>
        </view>
        <view class="ov-item">
          <text class="ov-num">{{ info.logs }}</text>
          <text class="ov-label">复习记录</text>
        </view>
      </view>
      <text class="ov-foot">存储引擎：{{ info.engine }} · 约 {{ info.bytes }} KB</text>
    </view>

    <view class="section">
      <text class="t-section">导出</text>
      <text class="section-right">{{ lastBackup ? '上次导出 ' + lastBackup : '尚未导出' }}</text>
    </view>

    <view class="actions">
      <view class="act tap" @tap="copyJson">
        <AppIcon name="copy" :size="34" color="#5B50F5" />
        <text class="act-text">复制备份 JSON</text>
      </view>
      <view class="act tap" @tap="saveFile">
        <AppIcon name="download" :size="34" color="#5B50F5" />
        <text class="act-text">保存为文件</text>
      </view>
    </view>

    <view class="section">
      <text class="t-section">恢复</text>
      <text class="section-right">粘贴备份内容后校验</text>
    </view>

    <view class="import-box">
      <textarea
        v-model="importText"
        class="import-input"
        placeholder="把备份 JSON 粘贴到这里"
        placeholder-class="ph"
        :maxlength="-1"
        auto-height
      />
    </view>

    <view class="mode">
      <view class="mode-item" :class="{ on: mode === 'replace' }" @tap="mode = 'replace'">
        <text class="mode-radio">{{ mode === 'replace' ? '●' : '○' }}</text>
        <view class="mode-main">
          <text class="mode-title">覆盖恢复</text>
          <text class="mode-desc">用备份内容替换当前全部数据</text>
        </view>
      </view>
      <view class="mode-item" :class="{ on: mode === 'merge' }" @tap="mode = 'merge'">
        <text class="mode-radio">{{ mode === 'merge' ? '●' : '○' }}</text>
        <view class="mode-main">
          <text class="mode-title">合并恢复</text>
          <text class="mode-desc">只补充本地没有的题目，不覆盖已改内容</text>
        </view>
      </view>
    </view>

    <view class="btn-wrap">
      <view class="btn-primary tap" @tap="doRestore">
        <text>校验并恢复</text>
      </view>
    </view>

    <view class="warn">
      <AppIcon name="info" :size="26" color="#A9AEC2" />
      <text class="warn-text">备份包含题目、答案、笔记、标签与复习记录；图片原图在 APP 端另存于沙箱目录，换机恢复时需一并拷贝。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import { backupService } from '@/services/backup'
import { useAppStore } from '@/stores/app'
import { fileAdapter } from '@/adapters/file'
import { dbEngine } from '@/adapters/database'
import { formatDateTime } from '@/utils/date'

/**
 * 备份与恢复。
 *
 * 恢复的顺序是「先校验、再确认、最后写」：
 * 1. `validate()` 会核对 app 标识、schema 版本、题目数组、条数校验和，
 *    半截文件直接挡掉（比恢复一半再报错好）；
 * 2. 覆盖模式会二次确认，并把题量念出来；
 * 3. merge 模式按主键跳过已存在记录，绝不覆盖用户新写的内容。
 */
const app = useAppStore()

const info = ref({ questions: 0, categories: 0, tags: 0, logs: 0, engine: 'storage', bytes: '0' })
const importText = ref('')
const mode = ref<'replace' | 'merge'>('replace')
const lastBackup = ref('')

onShow(async () => {
  await refreshInfo()
  const t = uni.getStorageSync('interview_box_last_backup')
  lastBackup.value = t ? formatDateTime(Number(t)) : ''
})

async function refreshInfo(): Promise<void> {
  const stats = await backupService.stats()
  const payload = await backupService.exportPayload()
  // 用序列化长度估算备份体积：比只数条数更接近用户真实的「这个文件多大」
  const sizeKb = Math.max(1, Math.round(JSON.stringify(payload).length / 1024))
  info.value = {
    questions: stats.questions,
    categories: stats.categories,
    tags: stats.tags,
    logs: stats.logs,
    engine: dbEngine() === 'sqlite' ? 'SQLite' : '本地快照（降级）',
    bytes: String(sizeKb)
  }
}

async function markBackup(): Promise<void> {
  await uni.setStorage({ key: 'interview_box_last_backup', data: Date.now() })
  lastBackup.value = formatDateTime(Date.now())
}

async function copyJson(): Promise<void> {
  const text = await backupService.exportText()
  uni.setClipboardData({
    data: text,
    success: async () => {
      await markBackup()
      uni.showToast({ title: '已复制到剪贴板', icon: 'none' })
    }
  })
}

async function saveFile(): Promise<void> {
  const text = await backupService.exportText()
  if (!fileAdapter.isPersistentSupported()) {
    await copyJson()
    return
  }
  try {
    const path = await fileAdapter.writeText(backupService.fileName(), text)
    await markBackup()
    uni.showModal({ title: '已保存', content: `文件位于应用私有目录：${path}`, showCancel: false })
  } catch {
    await copyJson()
  }
}

async function doRestore(): Promise<void> {
  if (!importText.value.trim()) {
    uni.showToast({ title: '请先粘贴备份内容', icon: 'none' })
    return
  }
  const check = backupService.validate(importText.value)
  if (!check.ok || !check.payload) {
    uni.showModal({ title: '校验未通过', content: check.message, showCancel: false })
    return
  }
  const count = check.payload.tables.questions.length
  uni.showModal({
    title: mode.value === 'replace' ? '覆盖恢复' : '合并恢复',
    content:
      mode.value === 'replace'
        ? `将用备份中的 ${count} 道题替换当前全部数据，确定继续？`
        : `将合并备份中的 ${count} 道题，已存在的题目跳过。`,
    success: async (res) => {
      if (!res.confirm) return
      const r = await backupService.restore(importText.value, mode.value)
      if (!r.ok) {
        uni.showModal({ title: '恢复失败', content: r.message, showCancel: false })
        return
      }
      await app.refresh()
      await refreshInfo()
      importText.value = ''
      uni.showToast({ title: r.message, icon: 'none' })
    }
  })
}
</script>

<style scoped>
.overview {
  margin: 20rpx 32rpx 0;
  padding: 30rpx 32rpx;
  border-radius: 31rpx;
  background-color: #f8f8fd;
  box-shadow: none;
}

.ov-title {
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2233;
}

.ov-grid {
  margin-top: 24rpx;
  display: flex;
  flex-direction: row;
}

.ov-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ov-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2233;
}

.ov-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #8a8fa3;
}

.ov-foot {
  display: block;
  margin-top: 24rpx;
  font-size: 20rpx;
  color: #a9aec2;
}

.section {
  margin: 38rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section-right {
  font-size: 20rpx;
  color: #a9aec2;
}

.actions {
  margin: 20rpx 32rpx 0;
  display: flex;
  flex-direction: row;
}

.act {
  flex: 1;
  height: 140rpx;
  margin-right: 20rpx;
  border-radius: 27rpx;
  background-color: #eaebfd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.act:last-child {
  margin-right: 0;
}

.act-text {
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #5b50f5;
}

.import-box {
  margin: 20rpx 32rpx 0;
  border-radius: 27rpx;
  /* 页面底是 #f5f5fe，#f8f8fd 比它还亮，框会整块消失 */
  background-color: #ededf6;
  padding: 24rpx 26rpx;
}

.import-input {
  width: 100%;
  min-height: 220rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: #3c4157;
}

.ph {
  color: #a9aec2;
}

.mode {
  margin: 20rpx 32rpx 0;
}

.mode-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 24rpx 26rpx;
  border-radius: 24rpx;
  border: 2rpx solid #ededf5;
  margin-bottom: 16rpx;
}

.mode-item.on {
  border-color: #5b50f5;
  background-color: #faf9ff;
}

.mode-radio {
  font-size: 26rpx;
  color: #5b50f5;
  margin-right: 14rpx;
  line-height: 1.4;
}

.mode-main {
  flex: 1;
}

.mode-title {
  display: block;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2233;
}

.mode-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

.btn-wrap {
  margin: 32rpx 32rpx 0;
}

.warn {
  margin: 24rpx 32rpx 40rpx;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.warn-text {
  flex: 1;
  margin-left: 10rpx;
  font-size: 20rpx;
  line-height: 1.6;
  color: #a9aec2;
}
</style>

<template>
  <view class="screen">
    <NavBar title="设置" />

    <view class="group">
      <text class="group-title">学习</text>
      <view class="group-body">
        <view class="row tap" @tap="editGoal">
          <text class="row-label">每日学习目标</text>
          <text class="row-value">{{ settings.dailyGoal }} 题</text>
          <AppIcon name="chevronRight" :size="24" color="#C3C7D6" />
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">识别</text>
      <view class="group-body">
        <view class="row">
          <view class="row-main">
            <text class="row-label">启用云端 OCR 兜底</text>
            <text class="row-desc">只在本地识别失败且你确认后才会上传图片</text>
          </view>
          <switch :checked="settings.cloudOcrEnabled" color="#5B50F5" @change="onCloudSwitch" />
        </view>

        <view v-if="settings.cloudOcrEnabled" class="row row--input">
          <text class="row-label">服务端地址</text>
          <input
            v-model="settings.cloudOcrEndpoint"
            class="row-input"
            placeholder="https://your-proxy.example.com"
            placeholder-class="ph"
            @blur="save"
          />
        </view>

        <view class="row">
          <view class="row-main">
            <text class="row-label">本地 OCR 能力</text>
            <text class="row-desc">{{ localOcrText }}</text>
          </view>
        </view>

        <view class="row">
          <view class="row-main">
            <text class="row-label">云端上传授权</text>
            <text class="row-desc">{{ cloudConsentText }}</text>
          </view>
          <view class="mini-btn" @tap="revokeConsent">
            <text class="mini-btn-text">撤销</text>
          </view>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">AI 答案助手</text>
      <view class="group-body">
        <view class="row">
          <view class="row-main">
            <text class="row-label">启用 AI 生成参考答案</text>
            <text class="row-desc">生成结果先作为草稿，需你确认后才写入</text>
          </view>
          <switch :checked="settings.aiEnabled" color="#5B50F5" @change="onAiSwitch" />
        </view>
        <view v-if="settings.aiEnabled" class="row row--input">
          <text class="row-label">服务端地址</text>
          <input
            v-model="settings.aiEndpoint"
            class="row-input"
            placeholder="https://your-proxy.example.com"
            placeholder-class="ph"
            @blur="save"
          />
        </view>
        <view v-if="settings.aiEnabled" class="row row--input">
          <text class="row-label">访问令牌</text>
          <input
            v-model="settings.aiToken"
            class="row-input"
            placeholder="代理设了令牌才需要填"
            placeholder-class="ph"
            password
            @blur="save"
          />
        </view>
        <view v-if="settings.aiEnabled" class="row row--hint">
          <text class="row-desc">
            令牌填的是你自建代理的 PROXY_TOKEN，不是模型厂商的 Key
            —— 厂商 Key 只存在服务端，客户端拿到就等于公开
          </text>
        </view>
        <view class="row">
          <text class="row-label">答案风格</text>
          <picker :range="styleNames" :value="styleIndex" @change="onStyle">
            <view class="picker">
              <text class="picker-text">{{ styleNames[styleIndex] }}</text>
              <AppIcon name="chevronDown" :size="22" color="#8A8FA3" />
            </view>
          </picker>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">数据</text>
      <view class="group-body">
        <view class="row tap" @tap="goBackup">
          <text class="row-label">备份与恢复</text>
          <AppIcon name="chevronRight" :size="24" color="#C3C7D6" />
        </view>
        <view class="row tap" @tap="reseed">
          <view class="row-main">
            <text class="row-label">重置示例数据</text>
            <text class="row-desc">会清空当前数据并重新写入内置示例</text>
          </view>
          <AppIcon name="chevronRight" :size="24" color="#C3C7D6" />
        </view>
        <view class="row">
          <!-- 这行的说明特别长（含降级原因），右侧再放一个值会互相挤，
               索性把引擎名并进说明，独占整行宽度换行 -->
          <view class="row-main">
            <text class="row-label">存储引擎</text>
            <text class="row-desc">{{ app.engine }} · {{ engineText }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">隐私</text>
      <view class="group-body">
        <view class="row row--column">
          <text class="privacy-text">题目、答案、笔记默认只保存在本机。云端 OCR 与 AI 均需你主动触发，且客户端不保存任何服务商密钥——所有调用都经你的服务端代理转发。</text>
        </view>
      </view>
    </view>

    <text class="version">面试题匣 v{{ app.version }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import { ocrService } from '@/services/ocr'
import { backupService } from '@/services/backup'
import { seedIfEmpty } from '@/data/seed'
import { db } from '@/adapters/database'
import { LATEST_VERSION } from '@/adapters/database/schema'
import { eventChecked, eventIndex } from '@/utils/event'
import type { AnswerStyle } from '@/types/ai'

/**
 * 设置：学习目标 / 云端 OCR / AI 助手 / 数据 / 隐私。
 *
 * 这一页承担「能力开关与知情同意」：
 * - 云端 OCR 默认关，开了才谈上传；上传前还会再确认一次，且这里能撤销授权；
 * - AI 默认关，生成结果只做草稿；
 * - 存储引擎如实显示（SQLite 还是降级快照 + 降级原因），不糊弄用户。
 */
const STYLES: { key: AnswerStyle; label: string }[] = [
  { key: 'interview', label: '简洁面试版' },
  { key: 'detailed', label: '详细原理版' },
  { key: 'project', label: '项目实战版' }
]

const app = useAppStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.state


const styleNames = STYLES.map((s) => s.label)

const styleIndex = computed(() => {
  const i = STYLES.findIndex((s) => s.key === settings.aiStyle)
  return i < 0 ? 0 : i
})

const localOcrText = computed(() => {
  const cap = ocrService.capabilities(settings)
  return cap.local.supported
    ? `本机识别可用（${cap.local.engine}）`
    : cap.local.reason || '当前环境没有本地识别能力'
})

const cloudConsentText = computed(() => {
  const consent = ocrService.consent()
  return consent.granted ? '已授权上传图片用于云端识别，可随时撤销' : '尚未授权，图片不会上传'
})

const engineText = computed(() =>
  app.engine === 'sqlite'
    ? 'SQLite（plus.sqlite，推荐）'
    : `本地键值快照（降级）：${app.fallbackReason || '当前平台无 SQLite'}`
)

const schemaText = computed(() => `v${LATEST_VERSION}`)

onShow(async () => {
  await app.refresh()
})

function save(): void {
  settingsStore.save()
  uni.showToast({ title: '已保存', icon: 'none' })
}

function editGoal(): void {
  uni.showModal({
    title: '每日学习目标',
    editable: true,
    content: String(settings.dailyGoal),
    success: (res) => {
      if (!res.confirm) return
      const n = parseInt(String(res.content || ''), 10)
      if (!n || n <= 0 || n > 200) {
        uni.showToast({ title: '请输入 1-200 的数字', icon: 'none' })
        return
      }
      settingsStore.patch({ dailyGoal: n })
      save()
    }
  })
}

function onCloudSwitch(e: Event): void {
  const on = eventChecked(e)
  settingsStore.patch({ cloudOcrEnabled: on })
  // 关掉云端兜底等于撤销授权：不留下「已同意上传」的残留状态
  if (!on) ocrService.revokeConsent()
  save()
}

function onAiSwitch(e: Event): void {
  settingsStore.patch({ aiEnabled: eventChecked(e) })
  save()
}

function onStyle(e: Event): void {
  settingsStore.patch({ aiStyle: STYLES[eventIndex(e)].key })
  save()
}

function revokeConsent(): void {
  ocrService.revokeConsent()
  uni.showToast({ title: '已撤销上传授权', icon: 'none' })
}

function goBackup(): void {
  uni.navigateTo({ url: '/pages/profile/backup' })
}

function reseed(): void {
  uni.showModal({
    title: '重置示例数据',
    content: `将清空当前数据并重新写入内置示例（schema ${schemaText.value}）。确定继续？`,
    success: async (res) => {
      if (!res.confirm) return
      await backupService.clearAll()
      await seedIfEmpty(db())
      await app.refresh()
      uni.showToast({ title: '已重置', icon: 'none' })
    }
  })
}
</script>

<style scoped>
.mini-btn {
  height: 54rpx;
  padding: 0 22rpx;
  border-radius: 27rpx;
  background-color: #f2f2f8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-btn-text {
  font-size: 21rpx;
  color: #6b7186;
}

.group {
  margin: 30rpx 32rpx 0;
}

.group-title {
  display: block;
  margin-left: 8rpx;
  margin-bottom: 14rpx;
  font-size: 21rpx;
  color: #a9aec2;
}

.group-body {
  border-radius: 27rpx;
  background-color: #ffffff;
  border: 1px solid #f1f1f8;
  padding: 4rpx 28rpx;
}

.row {
  min-height: 108rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.row--input {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  padding: 16rpx 0;
}

.row--column {
  flex-direction: column;
  align-items: stretch;
  padding: 20rpx 0 26rpx;
}

/* 纯说明文字行：不撑到 .row 的 108rpx 最小高度，紧贴上一行显示 */
.row--hint {
  min-height: 0;
  padding: 0 0 24rpx;
}

.row-main {
  flex: 1;
  padding-right: 20rpx;
}

.row-label {
  /* 没有 .row-main 包裹的行是 label|value|chevron 三段，
     label 吃掉剩余宽度，右侧的值和箭头才会贴右而不是浮在中间 */
  flex: 1;
  font-size: 25rpx;
  color: #1f2233;
}

.row-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.5;
  color: #a9aec2;
}

.row-value {
  /* 长描述会把值挤到换行，甚至挤到文字流中间（存储引擎那行就是这样塌的） */
  flex-shrink: 0;
  margin-left: 20rpx;
  margin-right: 8rpx;
  font-size: 22rpx;
  color: #8a8fa3;
  white-space: nowrap;
}

.row-input {
  margin-top: 12rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background-color: #f5f5fb;
  padding: 0 24rpx;
  font-size: 22rpx;
  color: #1f2233;
}

.ph {
  color: #b4b9ca;
}

.picker {
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 30rpx;
  background-color: #f5f5fb;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.picker-text {
  font-size: 22rpx;
  color: #1f2233;
  margin-right: 8rpx;
}

.privacy-text {
  font-size: 21rpx;
  line-height: 1.7;
  color: #8a8fa3;
}

.version {
  display: block;
  margin: 50rpx 0 60rpx;
  text-align: center;
  font-size: 20rpx;
  color: #b4b9ca;
}
</style>

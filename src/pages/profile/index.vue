<template>
  <view class="screen screen--tabbar">
    <NavBar title="更多" :show-back="false" />

    <view class="profile" @longpress="rename">
      <!-- 卡通头像：纯 CSS 拼，不引位图，任何端一致 -->
      <view class="avatar">
        <view class="av-shoulder"></view>
        <view class="av-neck"></view>
        <view class="av-face">
          <view class="av-hair"></view>
          <view class="av-eye av-eye--l"></view>
          <view class="av-eye av-eye--r"></view>
          <view class="av-mouth"></view>
        </view>
      </view>
      <view class="profile-main">
        <text class="name">{{ nickname }}</text>
        <text class="slogan">加油，持续突破 ⭐</text>
      </view>
    </view>

    <view class="statline">
      <view class="statline-item">
        <text class="statline-num">{{ app.stats.total }}</text>
        <text class="statline-label">题</text>
      </view>
      <view class="statline-sep"></view>
      <view class="statline-item">
        <text class="statline-num">{{ app.stats.masteryRate }}%</text>
        <text class="statline-label">掌握率</text>
      </view>
      <view class="statline-sep"></view>
      <view class="statline-item">
        <text class="statline-num">{{ app.streak }}</text>
        <text class="statline-label">连续天数</text>
      </view>
    </view>

    <view class="menu card">
      <view v-for="(m, i) in menus" :key="m.key" class="menu-row tap" @tap="onMenu(m.key)">
        <AppIcon :name="m.icon" :size="34" color="#6B7186" />
        <text class="menu-text">{{ m.title }}</text>
        <text v-if="m.value" class="menu-value">{{ m.value }}</text>
        <AppIcon name="chevronRight" :size="24" color="#C3C7D6" />
        <view v-if="i < menus.length - 1" class="menu-line"></view>
      </view>
    </view>

    <view class="footer">
      <text class="footer-text">面试题匣 v{{ app.version }} · 本地优先，数据只存在你的设备</text>
    </view>
  </view>

  <TabBar active="profile" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import TabBar from '@/components/TabBar.vue'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import { backupService } from '@/services/backup'
import { questionRepo } from '@/repositories/question'
import { fileAdapter } from '@/adapters/file'

/**
 * 更多：备份导出、清空、关于、设置入口。
 *
 * 「清空数据」是唯一不可逆的破坏性操作，所以做了两道确认，第二道还把当前题量念出来
 * —— 让用户在最后一秒意识到自己要删的是 200 道题，而不是 2 道。
 */
const app = useAppStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.state

/** 菜单项：value 用于右侧灰字（题量/版本），留空则不渲染 */
interface MenuItem {
  key: string
  icon: string
  title: string
  value?: string
}

const menus: MenuItem[] = [
  { key: 'backup', icon: 'database', title: '数据备份与恢复' },
  { key: 'export', icon: 'download', title: '导出题库' },
  { key: 'clear', icon: 'trash', title: '清空数据' },
  { key: 'about', icon: 'info', title: '关于我们' },
  { key: 'settings', icon: 'gear', title: '设置' }
]

const nickname = computed(() => settings.nickname || '张凤垚')

onShow(async () => {
  await app.refresh()
})

function rename(): void {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '输入你的昵称',
    content: nickname.value,
    success: (res) => {
      if (!res.confirm) return
      const name = String(res.content || '').trim()
      if (!name) return
      settingsStore.patch({ nickname: name.slice(0, 12) })
      uni.showToast({ title: '已保存', icon: 'none' })
    }
  })
}

function onMenu(key: string): void {
  if (key === 'backup') uni.navigateTo({ url: '/pages/profile/backup' })
  if (key === 'settings') uni.navigateTo({ url: '/pages/profile/settings' })
  if (key === 'export') void exportData()
  if (key === 'clear') confirmClear()
  if (key === 'about') about()
}

/** 导出：APP 写沙箱文件，其它平台退到剪贴板（不假装成功） */
async function exportData(): Promise<void> {
  const text = await backupService.exportText()
  if (fileAdapter.isPersistentSupported()) {
    try {
      const name = backupService.fileName()
      const path = await fileAdapter.writeText(name, text)
      await uni.setStorage({ key: 'interview_box_last_backup', data: Date.now() })
      uni.showModal({ title: '已导出', content: `备份文件已写入：${path}`, showCancel: false })
      return
    } catch {
      /* 落到剪贴板 */
    }
  }
  uni.setClipboardData({
    data: text,
    success: () =>
      uni.showModal({
        title: '已复制备份内容',
        content: '当前平台不支持写文件，备份 JSON 已复制到剪贴板。题量大时建议用「数据备份与恢复」页。',
        showCancel: false
      })
  })
}

async function confirmClear(): Promise<void> {
  const total = await questionRepo.count()
  uni.showModal({
    title: '清空全部数据',
    content: '将删除所有题目、标签和复习记录，且无法恢复。建议先导出备份。',
    confirmText: '开始清空',
    confirmColor: '#EF4444',
    success: (res) => {
      if (!res.confirm) return
      uni.showModal({
        title: '再次确认',
        content: `当前共 ${total} 道题，清空后不可恢复。`,
        confirmText: '确认清空',
        confirmColor: '#EF4444',
        success: async (r2) => {
          if (!r2.confirm) return
          await backupService.clearAll()
          await app.refresh()
          uni.showToast({ title: '已清空', icon: 'none' })
        }
      })
    }
  })
}

function about(): void {
  uni.showModal({
    title: '关于面试题匣',
    content: `版本 v${app.version}\n\n本地优先的面试题知识库：无账号即可使用，题目、答案、笔记和图片都保存在本机。云端 OCR 与 AI 只有在你主动确认后才会调用。`,
    showCancel: false
  })
}
</script>

<style scoped>
.profile {
  margin: 26rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.avatar {
  position: relative;
  width: 112rpx;
  height: 112rpx;
  border-radius: 56rpx;
  background-image: linear-gradient(160deg, #e8f2ff, #dbeafe);
  overflow: hidden;
}

/* 肩：浅蓝半圆，压住脸的下半部分 */
.av-shoulder {
  position: absolute;
  left: 50%;
  bottom: -34rpx;
  margin-left: -52rpx;
  width: 104rpx;
  height: 74rpx;
  border-radius: 52rpx 52rpx 0 0;
  background-color: #cfe3ff;
}

.av-neck {
  position: absolute;
  left: 50%;
  bottom: 26rpx;
  margin-left: -12rpx;
  width: 24rpx;
  height: 20rpx;
  background-color: #f0c9a8;
}

.av-face {
  position: absolute;
  left: 50%;
  top: 18rpx;
  margin-left: -30rpx;
  width: 60rpx;
  height: 66rpx;
  border-radius: 30rpx 30rpx 26rpx 26rpx;
  background-color: #f8d9bf;
}

/* 头发：上方一块圆角矩形盖住额头 */
.av-hair {
  position: absolute;
  left: -3rpx;
  top: -4rpx;
  width: 66rpx;
  height: 30rpx;
  border-radius: 33rpx 33rpx 12rpx 12rpx;
  background-color: #2f2a2b;
}

.av-eye {
  position: absolute;
  top: 34rpx;
  width: 7rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background-color: #2f2a2b;
}

.av-eye--l {
  left: 15rpx;
}

.av-eye--r {
  right: 15rpx;
}

.av-mouth {
  position: absolute;
  left: 50%;
  bottom: 12rpx;
  margin-left: -9rpx;
  width: 18rpx;
  height: 9rpx;
  border-bottom: 3rpx solid #d98d78;
  border-radius: 0 0 12rpx 12rpx;
}

.profile-main {
  margin-left: 24rpx;
}

.name {
  display: block;
  font-size: 33rpx;
  font-weight: 700;
  color: #1f2233;
}

.slogan {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8a8fa3;
}

.statline {
  margin: 34rpx 32rpx 0;
  padding: 28rpx 0;
  border-radius: 27rpx;
  background-color: #f8f8fd;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.statline-item {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
}

.statline-num {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2233;
}

.statline-label {
  margin-left: 6rpx;
  font-size: 20rpx;
  color: #8a8fa3;
}

.statline-sep {
  width: 1px;
  height: 32rpx;
  background-color: #e6e7f0;
}

.menu {
  margin: 28rpx 32rpx 0;
  padding: 8rpx 28rpx;
  border-radius: 31rpx;
  border: 1px solid #f1f1f8;
  box-shadow: none;
}

.menu-row {
  position: relative;
  height: 108rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.menu-text {
  flex: 1;
  margin-left: 22rpx;
  font-size: 26rpx;
  color: #1f2233;
}

.menu-value {
  margin-right: 10rpx;
  font-size: 22rpx;
  color: #a9aec2;
}

.menu-line {
  position: absolute;
  left: 56rpx;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: #efeff5;
}

.footer {
  margin: 50rpx 32rpx 0;
  display: flex;
  justify-content: center;
}

.footer-text {
  font-size: 20rpx;
  color: #b4b9ca;
}
</style>

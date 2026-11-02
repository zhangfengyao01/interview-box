<template>
  <view class="screen screen--tabbar">
    <NavBar title="学习与复习" :show-back="false">
      <template #right>
        <view class="nav-icon" @tap="openMore">
          <AppIcon name="more" :size="38" color="#1F2233" />
        </view>
      </template>
    </NavBar>

    <view class="seg">
      <view class="seg-pill" :style="mode === 'study' ? 'left:8rpx' : 'left:358rpx'"></view>
      <view class="seg-item" @tap="mode = 'study'">
        <text class="seg-text" :class="{ on: mode === 'study' }">学习模式</text>
      </view>
      <view class="seg-item" @tap="mode = 'review'">
        <text class="seg-text" :class="{ on: mode === 'review' }">复习模式</text>
      </view>
    </view>

    <view class="ring-wrap">
      <ProgressRing :percent="percent" :size="408" :stroke="24" color="#4F8BF7" color-to="#7B6DF8" track="#E8EDF9">
        <text class="ring-label">今日学习</text>
        <view class="ring-value">
          <text class="ring-now">{{ todayReviewed }}</text>
          <text class="ring-sep">/</text>
          <text class="ring-total">{{ goal }}</text>
        </view>
        <text class="ring-unit">题</text>
      </ProgressRing>
    </view>

    <view class="start-wrap">
      <view class="btn-primary tap" @tap="start">
        <text>{{ startLabel }}</text>
      </view>
    </view>

    <view class="plan card">
      <view class="plan-head">
        <text class="plan-title">学习计划</text>
        <view class="plan-set tap" @tap="editGoal">
          <text class="plan-set-text">设置计划</text>
          <AppIcon name="chevronRight" :size="22" color="#A9AEC2" />
        </view>
      </view>
      <view class="plan-line"></view>
      <view class="plan-row">
        <view class="plan-main">
          <text class="plan-goal">每日学习 {{ goal }} 题</text>
          <text class="plan-sub">{{ planSub }}</text>
        </view>
        <view class="plan-check">
          <AppIcon
            v-if="todayReviewed > 0"
            name="checkCircleFill"
            :size="44"
            color="#22C55E"
          />
          <view v-else class="plan-check-empty"></view>
        </view>
      </view>
    </view>

    <view class="quick card">
      <view class="quick-item tap" @tap="goPlan">
        <AppIcon name="calendar" :size="34" color="#5B50F5" />
        <text class="quick-text">复习计划</text>
        <text class="quick-num">{{ dueCount }}</text>
      </view>
      <view class="quick-line"></view>
      <view class="quick-item tap" @tap="goLibrary">
        <AppIcon name="book" :size="34" color="#F59E0B" />
        <text class="quick-text">全部题库</text>
        <text class="quick-num">{{ total }}</text>
      </view>
    </view>
  </view>

  <TabBar active="review" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import TabBar from '@/components/TabBar.vue'
import ProgressRing from '@/components/ProgressRing.vue'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import { recentReviewLogs } from '@/repositories/review'

/**
 * 学习与复习：今日进度环 + 开始学习 + 学习计划 + 快捷入口。
 *
 * 进度按「今天复习过的题目数 / 每日目标」算，取 review_logs 里当天的记录数，
 * 不是按打开页面的次数 —— 那样刷一下就满了，没有任何意义。
 */
const app = useAppStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.state

const mode = ref<'study' | 'review'>('study')

const todayReviewed = computed(() => app.todayReviewed)
const goal = computed(() => settings.dailyGoal || 20)
const percent = computed(() => Math.min(100, Math.round((todayReviewed.value / goal.value) * 100)))
const dueCount = computed(() => app.stats.due)
const total = computed(() => app.stats.total)
const startLabel = computed(() => (mode.value === 'study' ? '开始学习' : '开始复习'))
const planSub = computed(() =>
  todayReviewed.value >= goal.value
    ? '今日目标已完成，明天继续保持 ⭐'
    : `已完成 ${todayReviewed.value} 道，继续加油! 🎉`
)

onShow(async () => {
  await app.refresh()
})

function start(): void {
  if (mode.value === 'review' && !dueCount.value) {
    uni.showToast({ title: '今天没有到期题目', icon: 'none' })
    return
  }
  if (!total.value) {
    uni.showToast({ title: '题库还是空的', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/study/session?mode=${mode.value}` })
}

function editGoal(): void {
  uni.showModal({
    title: '每日学习目标',
    editable: true,
    placeholderText: String(goal.value),
    content: String(goal.value),
    success: (res) => {
      if (!res.confirm) return
      const n = parseInt(String(res.content || ''), 10)
      if (!n || n <= 0 || n > 200) {
        uni.showToast({ title: '请输入 1-200 的数字', icon: 'none' })
        return
      }
      settingsStore.patch({ dailyGoal: n })
      uni.showToast({ title: `目标已设为 ${n} 题`, icon: 'none' })
    }
  })
}

function goPlan(): void {
  uni.navigateTo({ url: '/pages/review/plan' })
}

function goLibrary(): void {
  uni.reLaunch({ url: '/pages/library/index' })
}

function openMore(): void {
  uni.showActionSheet({
    itemList: ['复习计划', '学习记录（近 5 条）'],
    success: (res) => {
      if (res.tapIndex === 0) goPlan()
      else void showLogs()
    }
  })
}

async function showLogs(): Promise<void> {
  const logs = await recentReviewLogs(5)
  if (!logs.length) {
    uni.showToast({ title: '还没有学习记录', icon: 'none' })
    return
  }
  const map: Record<string, string> = { unknown: '不会', fuzzy: '模糊', mastered: '掌握' }
  uni.showModal({
    title: '最近学习记录',
    content: logs.map((l) => map[l.result] || l.result).join(' · '),
    showCancel: false
  })
}
</script>

<style scoped>
.nav-icon {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seg {
  position: relative;
  height: 88rpx;
  margin: 18rpx 32rpx 0;
  border-radius: 27rpx;
  background-color: #f2f2f8;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.seg-pill {
  position: absolute;
  top: 8rpx;
  width: 330rpx;
  height: 72rpx;
  border-radius: 21rpx;
  background-color: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(42, 45, 85, 0.08);
  transition: left 0.2s ease;
}

.seg-item {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seg-text {
  font-size: 26rpx;
  color: #8a8fa3;
}

.seg-text.on {
  font-weight: 700;
  color: #5b50f5;
}

.ring-wrap {
  margin-top: 56rpx;
  display: flex;
  justify-content: center;
}

.ring-label {
  font-size: 22rpx;
  color: #8a8fa3;
}

.ring-value {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  margin-top: 10rpx;
}

.ring-now {
  font-size: 58rpx;
  font-weight: 700;
  color: #171a2c;
  line-height: 1.1;
}

/* 用独立节点做斜杠：<text> 里的首尾空格会被吃掉，写 " / 20" 会渲染成 "0/ 20" */
.ring-sep {
  margin: 0 12rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #a3a8bb;
}

.ring-total {
  font-size: 34rpx;
  font-weight: 700;
  color: #6b7186;
}

.ring-unit {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #8a8fa3;
}

.start-wrap {
  margin: 54rpx 64rpx 0;
}

.plan {
  margin: 52rpx 32rpx 0;
  padding: 30rpx 32rpx;
  border-radius: 31rpx;
  background-color: #f7f7fc;
}

.plan-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.plan-title {
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2233;
}

.plan-set {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.plan-set-text {
  font-size: 21rpx;
  color: #8a8fa3;
  margin-right: 4rpx;
}

.plan-line {
  height: 1px;
  background-color: #eaeaf3;
  margin-top: 22rpx;
}

.plan-row {
  margin-top: 22rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.plan-main {
  flex: 1;
}

.plan-goal {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #3c4157;
}

.plan-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

.plan-check {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-check-empty {
  width: 40rpx;
  height: 40rpx;
  border-radius: 20rpx;
  border: 1px solid #e3e5ee;
}

.quick {
  margin: 24rpx 32rpx 0;
  padding: 10rpx 0;
  border-radius: 31rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #ffffff;
}

.quick-item {
  flex: 1;
  height: 120rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.quick-text {
  margin-left: 12rpx;
  font-size: 23rpx;
  color: #3c4157;
}

.quick-num {
  margin-left: 8rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2233;
}

.quick-line {
  width: 1px;
  height: 56rpx;
  background-color: #efeff5;
}
</style>

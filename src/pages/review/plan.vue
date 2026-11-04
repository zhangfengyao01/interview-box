<template>
  <view class="screen">
    <NavBar title="复习计划" />

    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ on: t.key === active }"
        @tap="active = t.key"
      >
        <text class="tab-text" :class="{ on: t.key === active }">{{ t.label }}</text>
      </view>
    </view>

    <view v-for="item in list" :key="item.id" class="rowcard card tap" @tap="openDetail(item.id)">
      <view class="row-icon" :class="item.tone">
        <AppIcon name="clock" :size="40" :color="item.color" />
      </view>
      <view class="row-main">
        <text class="row-when">{{ item.when }}</text>
        <text class="row-name">{{ item.title }}</text>
      </view>
      <view v-if="active !== 'done'" class="row-btn" @tap.stop="reviewNow(item.id)">
        <text class="row-btn-text">去复习</text>
      </view>
      <text v-else class="row-done">已掌握</text>
    </view>

    <EmptyState
      v-if="!list.length"
      icon="calendar"
      :title="active === 'done' ? '还没有已掌握的题目' : '暂无待复习题目'"
      desc="学习后系统会按 1 / 3 / 7 天的节奏安排复习"
      action-text="去学习"
      @action="goStudy"
    />

    <view class="ai card" @longpress="openMore">
      <text class="ai-title">智能复习计划</text>
      <text class="ai-desc">根据你的学习情况，智能安排复习时间</text>
      <view class="ai-illust">
        <view class="cal">
          <view class="cal-rings">
            <view class="cal-ring"></view>
            <view class="cal-ring"></view>
          </view>
          <view class="cal-grid">
            <view v-for="n in 12" :key="n" class="cal-dot" :class="{ hot: n === 7 }"></view>
          </view>
        </view>
      </view>
      <view class="ai-btn tap" @tap="startPlan">
        <text class="ai-btn-text">{{ planOn ? '继续计划' : '开启计划' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAppStore } from '@/stores/app'
import { reviewRepo } from '@/repositories/review'
import { questionRepo } from '@/repositories/question'
import { reviewLabel } from '@/utils/date'

/**
 * 复习计划：到期优先，再排未来；「已完成」看的是掌握状态为 mastered 的题。
 *
 * 为什么到期（due）和未来（upcoming）要分开查：一条 `ORDER BY next_review_at`
 * 也能排出来，但「待复习 (18)」这个数字必须是**真的到期**的数量，
 * 混在一起会虚高，用户点进去发现没那么多题，信任就没了。
 */
interface PlanRow {
  id: string
  title: string
  when: string
  color: string
  tone: string
}

const app = useAppStore()

const active = ref<'pending' | 'done'>('pending')
const planOn = ref(false)
const rows = ref<PlanRow[]>([])
const doneRows = ref<PlanRow[]>([])

// 设计稿只有两个胶囊：待复习 / 已完成；「全部」和「待复习」本来就是同一份列表
const tabs = computed(() => [
  { key: 'pending' as const, label: `待复习（${rows.value.length}）` },
  { key: 'done' as const, label: '已完成' }
])

const list = computed<PlanRow[]>(() => (active.value === 'done' ? doneRows.value : rows.value))

async function load(): Promise<void> {
  const due = await reviewRepo.due(20)
  const upcoming = await reviewRepo.upcoming(20)
  const merged = due.concat(upcoming).slice(0, 10)
  rows.value = merged.map((q) => {
    const isDue = !!q.nextReviewAt && q.nextReviewAt <= Date.now()
    return {
      id: q.id,
      title: q.title,
      when: q.nextReviewAt ? `${reviewLabel(q.nextReviewAt)}复习` : '未安排',
      color: isDue ? '#EF4444' : '#F59E0B',
      tone: isDue ? 'tone--red' : 'tone--amber'
    }
  })

  const mastered = (await questionRepo.list({ masteryStatus: 'mastered' })).slice(0, 8)
  doneRows.value = mastered.map((q) => ({
    id: q.id,
    title: q.title,
    when: '已掌握',
    color: '#22C55E',
    tone: 'tone--green'
  }))
}

onShow(async () => {
  await app.refresh()
  await load()
})

function reviewNow(id: string): void {
  uni.navigateTo({ url: `/pages/study/session?mode=review&id=${id}` })
}

function openDetail(id: string): void {
  uni.navigateTo({ url: `/pages/question/detail?id=${id}` })
}

function goStudy(): void {
  uni.navigateTo({ url: '/pages/study/session?mode=review' })
}

function startPlan(): void {
  planOn.value = true
  uni.navigateTo({ url: '/pages/study/session?mode=review' })
}

function openMore(): void {
  uni.showActionSheet({
    itemList: ['重新计算复习时间', '去学习'],
    success: (res) => {
      if (res.tapIndex === 0) recalc()
      else goStudy()
    }
  })
}

async function recalc(): Promise<void> {
  const due = await reviewRepo.due(200)
  uni.showModal({
    title: '复习节奏',
    content: `当前有 ${due.length} 道题到期。规则：不会 1 天、模糊 3 天、掌握 7 天后，连续掌握延长到 14 / 30 天。`,
    showCancel: false
  })
}
</script>

<style scoped>
.tabs {
  margin: 16rpx 32rpx 22rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

/* 两个都是胶囊，选中态反白 —— 设计稿里没有下划线式 tab */
.tab {
  height: 60rpx;
  padding: 0 28rpx;
  margin-right: 16rpx;
  border-radius: 30rpx;
  background-color: #ecebfa;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.tab.on {
  background-color: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(70, 66, 140, 0.08);
}

.tab-text {
  font-size: 24rpx;
  color: #6b7186;
}

.tab-text.on {
  font-size: 27rpx;
  font-weight: 700;
  color: #5b50f5;
}

.rowcard {
  margin: 20rpx 32rpx 0;
  padding: 26rpx 28rpx;
  border-radius: 27rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.row-icon {
  width: 68rpx;
  height: 68rpx;
  border-radius: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tone--amber {
  background-color: #fff4e0;
}

.tone--red {
  background-color: #fdeaea;
}

.tone--green {
  background-color: #e9f8ef;
}

.row-main {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}

.row-when {
  display: block;
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2233;
}

.row-name {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8a8fa3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 行内小药丸：柔光玻璃（淡紫磨砂），配方见 global.scss。 */
.row-btn {
  height: 60rpx;
  padding: 0 24rpx;
  border-radius: 30rpx;
  background-image: var(--glass-bg-tint);
  border: var(--glass-border);
  box-shadow: var(--glass-sheen), var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  display: flex;
  align-items: center;
}

.row-btn-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #5b50f5;
}

.row-done {
  font-size: 21rpx;
  color: #22c55e;
}

.ai {
  position: relative;
  margin: 32rpx 32rpx 40rpx;
  padding: 32rpx;
  border-radius: 31rpx;
  overflow: hidden;
  background-image: linear-gradient(135deg, #f2efff 0%, #fbfaff 64%);
  border: 1px solid #eae4ff;
}

.ai-title {
  display: block;
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2233;
}

.ai-desc {
  display: block;
  margin-top: 10rpx;
  width: 366rpx;
  font-size: 21rpx;
  line-height: 1.6;
  color: #8a8fa3;
}

.ai-illust {
  position: absolute;
  right: 34rpx;
  top: 40rpx;
  width: 170rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cal {
  width: 132rpx;
  height: 132rpx;
  border-radius: 18rpx;
  background-image: linear-gradient(160deg, #7b6df8, #5b50f5);
  box-shadow: 0 10rpx 22rpx rgba(90, 75, 209, 0.28);
  padding: 14rpx 14rpx 12rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cal-rings {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0 8rpx;
}

.cal-ring {
  width: 10rpx;
  height: 10rpx;
  border-radius: 5rpx;
  background-color: rgba(255, 255, 255, 0.85);
}

.cal-grid {
  margin-top: 12rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.cal-dot {
  width: 18rpx;
  height: 13rpx;
  border-radius: 3rpx;
  background-color: rgba(255, 255, 255, 0.92);
  margin-right: 8rpx;
  margin-bottom: 8rpx;
}

.cal-dot.hot {
  background-color: #38bdf8;
}

/* AI 卡片主按钮：渐变主体 + 顶部内高光 + 柔光投影，配方同 .btn-primary。 */
.ai-btn {
  margin-top: 28rpx;
  width: 232rpx;
  height: 84rpx;
  border-radius: 42rpx;
  background-image: linear-gradient(90deg, #5b50f5, #7b6df8);
  box-shadow: var(--glass-sheen), var(--glow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-btn-text {
  font-size: 25rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>

<template>
  <view class="screen">
    <NavBar :title="title">
      <template #right>
        <text class="nav-count">{{ index + 1 }} / {{ total }}</text>
      </template>
    </NavBar>

    <view class="progress">
      <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
    </view>

    <block v-if="current">
      <view class="qcard card">
        <view class="qhead">
          <view class="qnum">
            <text class="qnum-text">{{ index + 1 }}</text>
          </view>
          <text class="qtitle">{{ current.title }}</text>
        </view>
        <text v-if="current.content && current.content !== current.title" class="qcontent">{{ current.content }}</text>
        <view v-if="tags.length" class="qtagrow">
          <Chip v-for="t in tags" :key="t.id" :label="t.name" :color="t.color" />
        </view>
      </view>

      <view v-if="!revealed" class="reveal-wrap">
        <view class="btn-primary tap" @tap="reveal">
          <text>显示答案</text>
        </view>
      </view>

      <block v-else>
        <view class="answer card">
          <view class="answer-head">
            <AppIcon name="sparkle" :size="26" color="#5B50F5" />
            <text class="answer-title">参考答案</text>
          </view>
          <text v-if="current.referenceAnswer" class="answer-body">{{ current.referenceAnswer }}</text>
          <text v-else class="answer-empty">这道题还没有参考答案</text>
        </view>

        <view class="rate-label">
          <text class="rate-label-text">这道题掌握得怎么样？</text>
        </view>
        <view class="rates">
          <view v-for="r in results" :key="r.key" class="rate tap" :style="{ borderColor: r.color }" @tap="answer(r.key)">
            <text class="rate-text" :style="{ color: r.color }">{{ r.label }}</text>
            <text class="rate-days">{{ r.days }} 天后</text>
          </view>
        </view>
      </block>
    </block>

    <EmptyState
      v-else
      icon="book"
      :title="emptyTitle"
      desc="换个模式，或先去题库补充题目"
      action-text="返回"
      @action="back"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import Chip from '@/components/Chip.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAppStore } from '@/stores/app'
import { questionRepo } from '@/repositories/question'
import { reviewRepo } from '@/repositories/review'
import { tagRepo } from '@/repositories/category'
import { reviewService } from '@/services/review'
import { REVIEW_RESULTS } from '@/services/review/scheduler'
import type { Question, ReviewResult, Tag } from '@/types/models'

/**
 * 学习 / 复习会话：一题一屏，先看题再揭答案，自评三档。
 *
 * 取题规则写在 `reviewService.sessionQuestions`，这里只管交互：
 * - 复习模式：先取到期题，没有到期题就退化成「未来要复习的」，不让用户空手而归；
 * - 带 id 进入（从详情页点「立即复习」）：把这道题顶到队首；
 * - 自评后立刻落库（题目状态 + review_logs 两条写），不等整轮结束 —— 中途退出也不丢。
 */
const app = useAppStore()

const mode = ref<'study' | 'review'>('study')
const queue = ref<Question[]>([])
const index = ref(0)
const revealed = ref(false)
const tags = ref<Tag[]>([])
const finished = ref(false)
const results = REVIEW_RESULTS

const current = computed<Question | null>(() => queue.value[index.value] || null)
const total = computed(() => queue.value.length)
const progressPercent = computed(() => {
  if (!total.value) return 0
  return Math.round(((index.value + (revealed.value ? 0.5 : 0)) / total.value) * 100)
})
const title = computed(() => (mode.value === 'review' ? '复习' : '学习'))
const emptyTitle = computed(() => (mode.value === 'review' ? '今天没有到期题目' : '题库还是空的'))

onLoad(async (query?: Record<string, string>) => {
  await app.refresh()
  mode.value = query?.mode === 'review' ? 'review' : 'study'
  const targetId = query?.id || ''

  let list: Question[]
  if (mode.value === 'review') {
    list = await reviewRepo.due(50)
    if (!list.length) list = await reviewRepo.upcoming(20)
  } else {
    list = await reviewService.sessionQuestions('sequence', 50)
  }

  if (targetId) {
    const hit = list.find((q) => q.id === targetId) || (await questionRepo.get(targetId))
    if (hit) list = [hit].concat(list.filter((q) => q.id !== hit.id))
  }

  queue.value = list
  await loadTags()
})

async function loadTags(): Promise<void> {
  tags.value = current.value ? await tagRepo.ofQuestion(current.value.id) : []
}

function reveal(): void {
  revealed.value = true
}

async function answer(key: ReviewResult): Promise<void> {
  if (!current.value) return
  const res = await reviewService.applyReview(current.value.id, key)
  if (!res.ok) {
    uni.showToast({ title: res.reason || '记录失败', icon: 'none' })
    return
  }
  await app.refresh()

  if (index.value + 1 >= queue.value.length) {
    finished.value = true
    uni.showToast({ title: '本轮完成', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  index.value += 1
  revealed.value = false
  await loadTags()
}

function back(): void {
  uni.navigateBack()
}
</script>

<style scoped>
.nav-count {
  font-size: 23rpx;
  color: #8a8fa3;
}

.progress {
  margin: 8rpx 32rpx 0;
  height: 8rpx;
  border-radius: 4rpx;
  background-color: #efeff5;
  overflow: hidden;
}

.progress-fill {
  height: 8rpx;
  border-radius: 4rpx;
  background-image: linear-gradient(90deg, #5b50f5, #8b7cf6);
  transition: width 0.25s ease;
}

.qcard {
  margin: 32rpx 32rpx 0;
  padding: 36rpx 32rpx;
  border-radius: 31rpx;
  /* 固定一个最小高度：揭晓答案时卡片不会突然长高，视线不用重找位置 */
  min-height: 360rpx;
}

.qhead {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.qnum {
  width: 46rpx;
  height: 46rpx;
  border-radius: 23rpx;
  background-color: #eaebfd;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.qnum-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #5b50f5;
}

.qtitle {
  flex: 1;
  font-size: 31rpx;
  font-weight: 700;
  line-height: 1.5;
  color: #1f2233;
}

.qcontent {
  display: block;
  margin-top: 22rpx;
  font-size: 25rpx;
  line-height: 1.75;
  color: #3c4157;
}

.qtagrow {
  margin-top: 26rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.qtagrow > * {
  margin-right: 12rpx;
}

.reveal-wrap {
  margin: 44rpx 32rpx 0;
}

.answer {
  margin: 32rpx 32rpx 0;
  padding: 30rpx 32rpx;
  border-radius: 31rpx;
  background-color: #f4f3ff;
  box-shadow: none;
}

.answer-head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.answer-title {
  margin-left: 10rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #5b50f5;
}

.answer-body {
  display: block;
  margin-top: 18rpx;
  font-size: 25rpx;
  line-height: 1.8;
  color: #3c4157;
}

.answer-empty {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #a9aec2;
}

.rate-label {
  margin: 40rpx 32rpx 0;
}

.rate-label-text {
  font-size: 22rpx;
  color: #8a8fa3;
}

.rates {
  margin: 18rpx 32rpx 40rpx;
  display: flex;
  flex-direction: row;
}

/* 掌握度打分卡：白卡换成磨砂玻璃片（半透白 + 内高光 + 柔投影），
   在白底 .qcard 里靠描边和阴影撑出层次。配方见 global.scss。 */
.rate {
  flex: 1;
  height: 110rpx;
  margin-right: 16rpx;
  border-radius: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.85);
  background-image: var(--glass-bg);
  box-shadow: var(--glass-sheen), var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.rate:last-child {
  margin-right: 0;
}

.rate-text {
  font-size: 27rpx;
  font-weight: 700;
}

.rate-days {
  margin-top: 6rpx;
  font-size: 19rpx;
  color: #a9aec2;
}
</style>

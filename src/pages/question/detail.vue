<template>
  <view class="screen">
    <NavBar title="">
      <template #right>
        <view class="nav-icons">
          <view class="nav-icon" @tap="toggleFavorite">
            <AppIcon :name="question && question.isFavorite ? 'starFill' : 'star'" :size="38" :color="question && question.isFavorite ? '#F59E0B' : '#1F2233'" />
          </view>
          <view class="nav-icon" @tap="goEdit">
            <AppIcon name="edit" :size="38" color="#1F2233" />
          </view>
          <view class="nav-icon" @tap="openMore">
            <AppIcon name="more" :size="38" color="#1F2233" />
          </view>
        </view>
      </template>
    </NavBar>

    <block v-if="question">
      <view class="title-row">
        <view class="num">
          <text class="num-text">{{ question.id ? 1 : 1 }}</text>
        </view>
        <text class="qtitle">{{ question.title }}</text>
      </view>

      <!-- 设计稿标题下直接接「参考回答」卡片，没有掌握度/分类那一行；
           掌握度改由右上角「…」→ 标记掌握程度 操作 -->
      <view class="ref">
        <view class="ref-head">
          <AppIcon name="feather" :size="28" color="#5B50F5" />
          <text class="ref-title">参考回答</text>
          <text v-if="question.answerOrigin !== 'manual'" class="ref-origin">AI 草稿</text>
        </view>
        <text v-if="question.referenceAnswer" class="ref-body">{{ question.referenceAnswer }}</text>
        <text v-else class="ref-empty">还没有参考答案，点击右上角编辑补充</text>
      </view>

      <view class="section">
        <text class="t-section">相关标签</text>
      </view>
      <view class="taglist">
        <Chip v-for="t in tags" :key="t.id" :label="t.name" :color="t.color" />
      </view>

      <view class="section">
        <text class="t-section">学习笔记</text>
      </view>
      <view class="notes">
        <textarea
          v-model="notes"
          class="notes-input"
          :maxlength="500"
          placeholder="添加笔记，记录你的思考..."
          placeholder-class="notes-ph"
          auto-height
          @blur="saveNotes"
        />
        <text class="notes-count">{{ notes.length }}/500</text>
      </view>

      <view class="section">
        <text class="t-section">相似题目推荐</text>
        <view class="section-refresh tap" @tap="refreshSimilar">
          <AppIcon name="refresh" :size="24" color="#5B50F5" />
          <text class="refresh-text">换一批</text>
        </view>
      </view>

      <view v-if="similar.length" class="simlist card">
        <view v-for="(s, i) in similar" :key="s.id" class="simrow" @tap="openDetail(s.id)">
          <text class="simrow-text">{{ s.title }}</text>
          <AppIcon name="chevronRight" :size="24" color="#C3C7D6" />
          <view v-if="i < similar.length - 1" class="simline"></view>
        </view>
      </view>
      <view v-else class="simempty">
        <text class="simempty-text">同类题目还不够，先多收录几道</text>
      </view>

      <view class="section">
        <text class="t-section">我的答案</text>
      </view>
      <view class="notes">
        <textarea
          v-model="myAnswer"
          class="notes-input"
          :maxlength="1000"
          placeholder="模拟面试时自己的表达，便于对比参考答案"
          placeholder-class="notes-ph"
          auto-height
          @blur="saveMyAnswer"
        />
        <text class="notes-count">{{ myAnswer.length }}/1000</text>
      </view>

      <view class="footbar">
        <view class="foot-btn tap" @tap="goStudy">
          <AppIcon name="review" :size="30" color="#5B50F5" />
          <text class="foot-btn-text">立即复习</text>
        </view>
      </view>
    </block>

    <EmptyState v-else icon="info" title="题目不存在或已删除" desc="" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import Chip from '@/components/Chip.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAppStore } from '@/stores/app'
import { questionRepo } from '@/repositories/question'
import { questionService } from '@/services/question'
import { MASTERY_LABEL } from '@/services/review/scheduler'
import type { MasteryStatus, Question, Tag } from '@/types/models'

/**
 * 题目详情：参考答案 / 标签 / 笔记 / 我的答案 / 相似题。
 *
 * 笔记和「我的答案」是**失焦即存**（不等保存按钮）：详情页没有保存态，
 * 用户改完直接返回是常态，攒着不存等于丢内容。
 */
const app = useAppStore()

const id = ref('')
const question = ref<Question | null>(null)
const tags = ref<Tag[]>([])
const similar = ref<Question[]>([])
const notes = ref('')
const myAnswer = ref('')


onLoad((query?: Record<string, string>) => {
  id.value = query?.id || ''
})

onShow(async () => {
  await app.refresh()
  await load()
})

async function load(): Promise<void> {
  const detail = await questionService.detail(id.value)
  if (!detail.question) {
    question.value = null
    return
  }
  question.value = detail.question
  tags.value = detail.tags
  notes.value = detail.question.notes || ''
  myAnswer.value = detail.question.myAnswer || ''
  similar.value = detail.similar
}

async function saveNotes(): Promise<void> {
  if (!question.value || notes.value === question.value.notes) return
  await questionService.save({ title: question.value.title, notes: notes.value }, id.value)
  question.value.notes = notes.value
}

async function saveMyAnswer(): Promise<void> {
  if (!question.value || myAnswer.value === question.value.myAnswer) return
  await questionService.save({ title: question.value.title, myAnswer: myAnswer.value }, id.value)
  question.value.myAnswer = myAnswer.value
}

async function toggleFavorite(): Promise<void> {
  if (!question.value) return
  const q = await questionService.toggleFavorite(id.value)
  if (!q) return
  question.value.isFavorite = q.isFavorite
  uni.showToast({ title: q.isFavorite ? '已收藏' : '已取消收藏', icon: 'none' })
}

function goEdit(): void {
  uni.navigateTo({ url: `/pages/question/edit?id=${id.value}` })
}

function goStudy(): void {
  uni.navigateTo({ url: `/pages/study/session?from=detail&id=${id.value}` })
}

/** 换一批：同分类内随机，Fisher-Yates 而不是 sort(random)，分布才均匀 */
async function refreshSimilar(): Promise<void> {
  if (!question.value) return
  const all = (await questionRepo.list({ categoryId: question.value.categoryId || undefined })).filter(
    (q) => q.id !== id.value
  )
  if (all.length <= 3) {
    similar.value = all
    return
  }
  const arr = all.slice()
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  similar.value = arr.slice(0, 3)
}

function openDetail(nextId: string): void {
  if (nextId === id.value) return
  uni.redirectTo({ url: `/pages/question/detail?id=${nextId}` })
}

function openMore(): void {
  uni.showActionSheet({
    itemList: ['编辑题目', '标记掌握程度', '复制题目到剪贴板', '删除题目'],
    success: (res) => {
      if (res.tapIndex === 0) goEdit()
      if (res.tapIndex === 1) markMastery()
      if (res.tapIndex === 2) copyQuestion()
      if (res.tapIndex === 3) confirmDelete()
    }
  })
}

function markMastery(): void {
  const keys: MasteryStatus[] = ['new', 'learning', 'fuzzy', 'mastered']
  uni.showActionSheet({
    itemList: keys.map((k) => MASTERY_LABEL[k]),
    success: async (res) => {
      if (!question.value) return
      await questionService.save(
        { title: question.value.title, masteryStatus: keys[res.tapIndex] },
        id.value
      )
      await load()
    }
  })
}

function copyQuestion(): void {
  const q = question.value
  if (!q) return
  const text = `${q.title}\n\n参考答案：\n${q.referenceAnswer || '（暂无）'}`
  uni.setClipboardData({ data: text, success: () => uni.showToast({ title: '已复制', icon: 'none' }) })
}

function confirmDelete(): void {
  uni.showModal({
    title: '删除题目',
    content: '删除后不可恢复，确定删除这道题吗？',
    confirmColor: '#EF4444',
    success: async (res) => {
      if (!res.confirm) return
      await questionService.remove(id.value)
      await app.refresh()
      uni.showToast({ title: '已删除', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 400)
    }
  })
}
</script>

<style scoped>
.nav-icons {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.nav-icon {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10rpx;
}

.title-row {
  margin: 10rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.num {
  width: 76rpx;
  height: 76rpx;
  border-radius: 26rpx;
  background-image: linear-gradient(140deg, var(--grad-from), var(--grad-to));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  margin-top: 2rpx;
}

.num-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}

.qtitle {
  flex: 1;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.42;
  color: #171a2c;
}

.ref {
  margin: 26rpx 32rpx 0;
  border-radius: 27rpx;
  background-color: #f1efff;
  padding: 28rpx 32rpx 32rpx;
}

.ref-head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ref-title {
  margin-left: 10rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: #5b50f5;
}

.ref-origin {
  margin-left: 12rpx;
  font-size: 18rpx;
  color: #7b6df8;
  background-color: #e6e4ff;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
}

.ref-body {
  display: block;
  margin-top: 18rpx;
  font-size: 25rpx;
  line-height: 1.85;
  color: #3c4157;
}

.ref-empty {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #a9aec2;
}

.section {
  margin: 38rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section-refresh {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.refresh-text {
  margin-left: 6rpx;
  font-size: 22rpx;
  color: #5b50f5;
}

.taglist {
  margin: 20rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
}

.taglist > * {
  margin-right: 14rpx;
  margin-bottom: 12rpx;
}

.notes {
  position: relative;
  margin: 20rpx 32rpx 0;
  border-radius: 23rpx;
  /* 页面底是 #f5f5fe，笔记框必须明显更深一档，否则整个框看不见 */
  background-color: #ededf6;
  padding: 24rpx 26rpx 40rpx;
}

/* 计数放在输入框右下角（设计稿位置），不占章节标题那一行 */
.notes-count {
  position: absolute;
  right: 24rpx;
  bottom: 14rpx;
  font-size: 20rpx;
  color: #b4b9ca;
}

.notes-input {
  width: 100%;
  min-height: 120rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #1f2233;
}

.notes-ph {
  color: #a9aec2;
}

.simlist {
  margin: 20rpx 32rpx 0;
  padding: 6rpx 26rpx;
  border-radius: 27rpx;
}

.simrow {
  position: relative;
  height: 92rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.simrow-text {
  flex: 1;
  font-size: 24rpx;
  color: #3c4157;
  margin-right: 16rpx;
}

.simline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: #efeff5;
}

.simempty {
  margin: 20rpx 32rpx 0;
  padding: 40rpx;
  border-radius: 27rpx;
  background-color: #f8f8fd;
  text-align: center;
}

.simempty-text {
  font-size: 22rpx;
  color: #a9aec2;
}

.footbar {
  margin: 44rpx 32rpx 40rpx;
}

.foot-btn {
  height: 96rpx;
  border-radius: 48rpx;
  background-color: #eaebfd;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.foot-btn-text {
  margin-left: 10rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: #5b50f5;
}
</style>

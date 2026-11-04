<template>
  <view class="screen screen--hasbar">
    <NavBar title="识别结果">
      <template #right>
        <text class="nav-action tap" @tap="redo">重新识别</text>
      </template>
    </NavBar>

    <view class="ocr-bar">
      <view class="ocr-bar-dot">
        <AppIcon name="check" :size="25" color="#FFFFFF" />
      </view>
      <text class="ocr-bar-text">{{ bannerText }}</text>
    </view>

    <!-- 校对模式：全文编辑 -->
    <block v-if="editing">
      <view class="edit-box">
        <textarea
          v-model="rawText"
          class="edit-input"
          :maxlength="-1"
          auto-height
          placeholder="在这里校对识别文本"
        />
      </view>
      <view class="edit-foot">
        <text class="tip">{{ hintMessage }}</text>
        <view class="mini-btn tap" @tap="resplit">
          <AppIcon name="refresh" :size="24" color="#5B50F5" />
          <text class="mini-btn-text">重新拆题</text>
        </view>
      </view>
    </block>

    <!-- 预览模式：题目卡片 -->
    <block v-else>
      <view
        v-for="(item, i) in items"
        :key="i"
        class="qcard card"
        @longpress="confirmRemove(i)"
      >
        <view class="qhead">
          <view class="qnum">
            <text class="qnum-text">{{ i + 1 }}</text>
          </view>
          <text class="qtitle">{{ item.title }}</text>
        </view>

        <text v-if="item.referenceAnswer" class="qlabel">解析：</text>
        <text v-if="item.referenceAnswer" class="qbody">{{ item.referenceAnswer }}</text>
        <text v-else class="qbody qbody--muted">未识别到解析，可稍后补充参考答案</text>

        <view class="qtaghead">
          <text class="qlabel">标签：</text>
          <view class="qcopy tap" @tap="copyItem(item)">
            <AppIcon name="copy" :size="26" color="#9AA0B4" />
          </view>
        </view>
        <view v-if="item.tags.length" class="qtaglist">
          <Chip v-for="t in item.tags" :key="t" :label="t" />
        </view>
      </view>

      <EmptyState
        v-if="!items.length"
        icon="clipboard"
        title="没有解析出题目"
        desc="可以切到校对模式手动调整分段，或返回重新粘贴"
        action-text="校对文本"
        @action="editing = true"
      />
    </block>

    <view class="bottombar">
      <view class="bar-item" @tap="toggleEdit">
        <AppIcon :name="editing ? 'check' : 'edit'" :size="36" color="#8A8FA3" />
        <text class="bar-label">{{ editing ? '完成' : '编辑' }}</text>
      </view>
      <view class="bar-main tap" @tap="goBatch">
        <text class="bar-main-text">保存到题库</text>
      </view>
      <view class="bar-item" @tap="share">
        <AppIcon name="share" :size="36" color="#8A8FA3" />
        <text class="bar-label">分享</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import Chip from '@/components/Chip.vue'
import EmptyState from '@/components/EmptyState.vue'
import { splitQuestions, segmentationHint } from '@/services/question/segmenter'
import { inferTags } from '@/services/question/tagger'
import type { SegmentedQuestion } from '@/services/question/segmenter'

/**
 * 识别结果校对页：拆题结果 + 全文校对 + 批量入库入口。
 *
 * 设计取舍：
 * - 「校对模式」改的是**整段原文**，改完重新拆题；不做逐题编辑，
 *   因为拆错的根因几乎都在分段边界上，逐题改反而更慢；
 * - 卡片上的铅笔进入校对模式，长按卡片才删除单题（防误触）；
 * - 原始识别文本一路带到入库页，落进 source_assets.raw_text，不丢。
 */
interface ReviewItem {
  no: number
  title: string
  content: string
  referenceAnswer: string
  tags: string[]
}

interface CaptureDraft {
  rawText?: string
  editedText?: string
  ocrEngine?: string
  sourceType?: 'image' | 'text'
  assets?: { path: string; rawText: string; engine: string }[]
}

const editing = ref(false)
const rawText = ref('')
const items = ref<ReviewItem[]>([])
const draft = ref<CaptureDraft>({})

const bannerText = computed(() =>
  editing.value ? '校对完成后点「重新拆题」' : `识别成功，共 ${items.value.length} 道题目`
)
const hintMessage = computed(() => segmentationHint(rawText.value).message)

onLoad(() => {
  const raw = uni.getStorageSync('capture_draft')
  const parsed = typeof raw === 'string' ? (JSON.parse(raw || '{}') as CaptureDraft) : (raw as CaptureDraft)
  draft.value = parsed || {}
  rawText.value = draft.value.editedText || draft.value.rawText || ''
  resplit(true)
})

function resplit(silent = false): void {
  const rows = splitQuestions(rawText.value)
  items.value = rows.map((r) => ({ ...r, tags: inferTags(r.title) }))
  if (!silent) uni.showToast({ title: `已拆出 ${items.value.length} 题`, icon: 'none' })
}

function removeItem(i: number): void {
  items.value.splice(i, 1)
}

function confirmRemove(i: number): void {
  const item = items.value[i]
  uni.showModal({
    title: '移除这道题',
    content: `「${(item && item.title) || ''}」将从本次识别结果中移除`,
    confirmText: '移除',
    confirmColor: '#EF4444',
    success: (res) => {
      if (res.confirm) removeItem(i)
    }
  })
}

/**
 * 复制单题：题干 + 解析拼成一段纯文本。
 * 设计稿在「标签：」行右侧放了一个复制图标，对应这个动作。
 */
function copyItem(item: SegmentedQuestion): void {
  const text = item.referenceAnswer ? `${item.title}\n\n解析：${item.referenceAnswer}` : item.title
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' })
  })
}

function toggleEdit(): void {
  if (editing.value) {
    editing.value = false
    resplit(true)
  } else {
    editing.value = true
  }
}

function redo(): void {
  uni.navigateBack()
}

function share(): void {
  const text = items.value.map((it, i) => `${i + 1}. ${it.title}`).join('\n')
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '题目已复制', icon: 'none' })
  })
}

function goBatch(): void {
  if (!items.value.length) {
    uni.showToast({ title: '没有可保存的题目', icon: 'none' })
    return
  }
  uni.setStorageSync('batch_draft', {
    items: items.value,
    meta: {
      rawText: draft.value.rawText || '',
      editedText: rawText.value,
      ocrEngine: draft.value.ocrEngine || 'manual',
      sourceType: draft.value.sourceType || 'text',
      assets: draft.value.assets || []
    }
  })
  uni.navigateTo({ url: '/pages/capture/batch-save' })
}
</script>

<style scoped>
.nav-action {
  font-size: 24rpx;
  color: #5b50f5;
}

.ocr-bar {
  margin: 12rpx 32rpx 0;
  height: 92rpx;
  border-radius: 23rpx;
  background-color: #e9f8ef;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 26rpx;
}

.ocr-bar-dot {
  width: 42rpx;
  height: 42rpx;
  border-radius: 21rpx;
  background-color: #22c55e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ocr-bar-text {
  margin-left: 18rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #16a34a;
}

.qcard {
  margin: 24rpx 32rpx 0;
  padding: 30rpx 32rpx 34rpx;
  border-radius: 31rpx;
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
  background-color: #5b50f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
}

.qnum-text {
  font-size: 23rpx;
  font-weight: 700;
  color: #ffffff;
}

.qtitle {
  flex: 1;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.5;
  color: #1f2233;
  padding-right: 12rpx;
}

.qtaghead {
  margin-top: 24rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.qcopy {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qlabel {
  display: block;
  margin-top: 24rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #3c4157;
}

/* 放在 qtaghead 里时由父级控制外边距 */
.qtaghead .qlabel {
  margin-top: 0;
}

.qbody {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #3c4157;
}

.qbody--muted {
  color: #a9aec2;
}

.qtaglist {
  margin-top: 12rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.qtaglist > * {
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.edit-box {
  margin: 24rpx 32rpx 0;
  border-radius: 28rpx;
  background-color: #f8f8fd;
  padding: 28rpx;
}

.edit-input {
  width: 100%;
  min-height: 700rpx;
  font-size: 25rpx;
  line-height: 1.75;
  color: #1f2233;
}

.edit-foot {
  margin: 20rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.tip {
  flex: 1;
  font-size: 21rpx;
  color: #a9aec2;
}

/* 迷你玻璃药丸（淡紫磨砂），配方见 global.scss。 */
.mini-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 32rpx;
  background-image: var(--glass-bg-tint);
  border: var(--glass-border);
  box-shadow: var(--glass-sheen), var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.mini-btn-text {
  margin-left: 8rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #5b50f5;
}

.bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 150rpx;
  background-color: #ffffff;
  border-top: 1px solid #eff0f6;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 60;
}

.bar-item {
  width: 150rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #8a8fa3;
}

.bar-main {
  flex: 1;
  height: 92rpx;
  border-radius: 46rpx;
  background-image: linear-gradient(90deg, #5b50f5, #7b6df8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar-main-text {
  font-size: 29rpx;
  font-weight: 700;
  color: #ffffff;
}

.screen--hasbar {
  padding-bottom: 200rpx;
}
</style>

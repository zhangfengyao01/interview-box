<template>
  <view class="qcard card" @tap="emit('tap')">
    <view class="qhead">
      <view v-if="index !== null && index !== undefined" class="qnum">
        <text class="qnum-text">{{ index }}</text>
      </view>
      <text class="qtitle" :class="{ 'qtitle--tight': index !== null && index !== undefined }">
        {{ question.title }}
      </text>
      <AppIcon v-if="showChevron" name="chevronRight" :size="26" color="#C3C7D6" />
    </view>

    <text v-if="preview" class="qpreview">{{ preview }}</text>

    <view v-if="tags.length" class="qtags">
      <Chip v-for="t in tags" :key="t.id" :label="t.name" :color="t.color" />
    </view>

    <view v-if="metaText" class="qmeta">
      <AppIcon name="clock" :size="22" color="#A9AEC2" />
      <text class="qmeta-text">{{ metaText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import Chip from './Chip.vue'
import type { Question, Tag } from '@/types/models'

/**
 * 题目卡片：列表 / 搜索结果复用。
 * 预览文本优先取「参考答案」，没有才退回正文 —— 列表里用户更想确认这题会不会答，
 * 而不是重读题面。
 */
const props = withDefaults(
  defineProps<{
    question: Question
    index?: number | string | null
    tags?: Tag[]
    showPreview?: boolean
    showChevron?: boolean
    metaText?: string
  }>(),
  { index: null, tags: () => [], showPreview: true, showChevron: true, metaText: '' }
)

const emit = defineEmits<{ tap: [] }>()

const preview = computed(() => {
  if (!props.showPreview) return ''
  const src = props.question.referenceAnswer || props.question.content || ''
  const one = String(src).replace(/\s+/g, ' ').trim()
  return one.length > 64 ? `${one.slice(0, 64)}…` : one
})
</script>

<style scoped>
.qcard {
  padding: 32rpx;
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
  margin-top: 2rpx;
}

.qnum-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #5b50f5;
}

.qtitle {
  flex: 1;
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2233;
  line-height: 1.5;
}

.qtitle--tight {
  padding-right: 16rpx;
}

.qpreview {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #8a8fa3;
  line-height: 1.6;
}

.qtags {
  margin-top: 20rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.qtags > * {
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.qmeta {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.qmeta-text {
  margin-left: 8rpx;
  font-size: 20rpx;
  color: #a9aec2;
}
</style>

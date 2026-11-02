<template>
  <view class="prog">
    <view v-for="(step, i) in steps" :key="step.key" class="prog-row">
      <view class="prog-dot" :class="step.status">
        <AppIcon v-if="step.status === 'done'" name="check" :size="22" color="#FFFFFF" />
        <AppIcon v-else-if="step.status === 'fail'" name="close" :size="22" color="#FFFFFF" />
        <text v-else-if="step.status === 'doing'" class="prog-dot-text">{{ i + 1 }}</text>
        <text v-else class="prog-dot-text prog-dot-text--wait">{{ i + 1 }}</text>
      </view>
      <view class="prog-main">
        <text class="prog-label" :class="{ 'prog-label--active': step.status === 'doing' }">{{ step.label }}</text>
        <text v-if="step.detail" class="prog-detail">{{ step.detail }}</text>
      </view>
      <text v-if="step.status === 'doing'" class="prog-tag">进行中</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { OcrStep } from '@/types/ocr'

/**
 * OCR 进度面板。
 *
 * 为什么需要它：一次识别可能 2~5 秒，涉及「读图 → 本地识别 →（失败）云端兜底 → 拆题」
 * 好几步。只给一个转圈用户不知道卡在哪，尤其是降级到云端时更需要说明
 * 「正在上传」，否则等于偷偷上传（验收要求：用户要知道图片去哪了）。
 */
defineProps<{ steps: OcrStep[] }>()
</script>

<style scoped>
.prog {
  padding: 8rpx 0;
}

.prog-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 16rpx 0;
}

.prog-dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 22rpx;
  background-color: #ededf5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prog-dot.doing {
  background-color: #5b50f5;
}

.prog-dot.done {
  background-color: #22c55e;
}

.prog-dot.fail {
  background-color: #ef4444;
}

.prog-dot-text {
  font-size: 21rpx;
  font-weight: 700;
  color: #ffffff;
}

.prog-dot-text--wait {
  color: #a9aec2;
}

.prog-main {
  flex: 1;
  margin-left: 18rpx;
}

.prog-label {
  display: block;
  font-size: 24rpx;
  color: #6b7186;
}

.prog-label--active {
  font-weight: 700;
  color: #1f2233;
}

.prog-detail {
  display: block;
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #a9aec2;
}

.prog-tag {
  font-size: 19rpx;
  color: #5b50f5;
}
</style>

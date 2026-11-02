<template>
  <view class="ansed">
    <view class="ansed-head">
      <text class="ansed-label">{{ label }}</text>
      <view class="ansed-actions">
        <view v-if="showAi" class="ansed-ai" @tap="emit('generate')">
          <AppIcon name="sparkle" :size="24" color="#5B50F5" />
          <text class="ansed-ai-text">{{ generating ? '生成中…' : 'AI 生成' }}</text>
        </view>
        <text class="ansed-count">{{ count }}/{{ maxlength }}</text>
      </view>
    </view>

    <textarea
      class="ansed-input"
      :value="modelValue"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :auto-height="autoHeight"
      :disabled="generating"
      @input="onInput"
    />

    <view v-if="aiHint" class="ansed-hint">
      <AppIcon name="info" :size="22" color="#F59E0B" />
      <text class="ansed-hint-text">{{ aiHint }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { eventValue } from '@/utils/event'
import AppIcon from './AppIcon.vue'
import { countChars } from '@/utils/text'

/**
 * 答案编辑器（参考答案 / 我的答案 / 笔记共用）。
 *
 * 这里的 AI 按钮只负责「生成草稿」—— 生成结果回填到输入框，用户看得见、改得动、
 * 点保存才入库。绝不在生成成功时直接写 reference_answer（PRD §5 硬约束）。
 * `aiHint` 用来提示「已有答案，采用将覆盖」这类风险，而不是自己替用户决定。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    maxlength?: number
    autoHeight?: boolean
    showAi?: boolean
    generating?: boolean
    aiHint?: string
  }>(),
  {
    label: '参考答案',
    placeholder: '写下你的答案，或让 AI 先起个草稿',
    maxlength: 2000,
    autoHeight: true,
    showAi: false,
    generating: false,
    aiHint: ''
  }
)

const emit = defineEmits<{ 'update:modelValue': [string]; generate: [] }>()

const count = computed(() => countChars(props.modelValue))

function onInput(e: Event): void {
  emit('update:modelValue', eventValue(e))
}
</script>

<style scoped>
.ansed {
  display: flex;
  flex-direction: column;
}

.ansed-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.ansed-label {
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2233;
}

.ansed-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ansed-ai {
  height: 46rpx;
  padding-left: 16rpx;
  padding-right: 18rpx;
  border-radius: 23rpx;
  background-color: #eaebfd;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: 14rpx;
}

.ansed-ai-text {
  margin-left: 6rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: #5b50f5;
}

.ansed-count {
  font-size: 20rpx;
  color: #a9aec2;
}

.ansed-input {
  margin-top: 14rpx;
  width: 100%;
  min-height: 220rpx;
  border-radius: 20rpx;
  background-color: #f8f8fd;
  padding: 22rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #1f2233;
}

.ansed-hint {
  margin-top: 12rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ansed-hint-text {
  margin-left: 8rpx;
  font-size: 20rpx;
  color: #f59e0b;
}
</style>

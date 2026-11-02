<template>
  <view class="tagsel">
    <view class="tagsel-list">
      <view v-for="name in modelValue" :key="name" class="tagsel-item">
        <text class="tagsel-text">{{ name }}</text>
        <view class="tagsel-close" @tap="remove(name)">
          <AppIcon name="close" :size="20" color="#5B50F5" />
        </view>
      </view>
      <view class="tagsel-add" @tap="focusInput">
        <AppIcon name="plus" :size="20" color="#8A8FA3" />
        <text class="tagsel-add-text">添加</text>
      </view>
    </view>

    <view v-if="editing" class="tagsel-inputrow">
      <input
        class="tagsel-input"
        :value="draft"
        :focus="editing"
        placeholder="输入标签后回车"
        confirm-type="done"
        @input="onInput"
        @confirm="commit"
        @blur="commit"
      />
    </view>

    <view v-if="suggestions.length" class="tagsel-suggest">
      <text class="tagsel-hint">常用</text>
      <view class="tagsel-suggest-list">
        <view v-for="t in suggestions" :key="t.id" class="tagsel-suggest-item" @tap="add(t.name)">
          <text class="tagsel-suggest-text">{{ t.name }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { eventValue } from '@/utils/event'
import AppIcon from './AppIcon.vue'
import type { Tag } from '@/types/models'

/**
 * 标签选择器：已选 chips + 即时输入 + 常用标签建议。
 *
 * 为什么「输入即建」而不是先选后建：录题时用户的注意力在题面上，
 * 让他为了加一个标签先跳去设置页建标签，这条录入链路就断了。
 * 新标签由 service 侧 `ensure()` 落库，重名会复用，不会产生一堆重复标签。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string[]
    suggestions?: Tag[]
  }>(),
  { suggestions: () => [] }
)

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const editing = ref(false)
const draft = ref('')

const suggestions = computed(() => {
  const picked = new Set(props.modelValue)
  return props.suggestions.filter((t) => !picked.has(t.name)).slice(0, 8)
})

function add(name: string): void {
  const clean = name.trim()
  if (!clean) return
  if (props.modelValue.includes(clean)) return
  emit('update:modelValue', [...props.modelValue, clean])
}

function remove(name: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((n) => n !== name)
  )
}

function onInput(e: Event): void {
  draft.value = eventValue(e)
}

function commit(): void {
  const value = draft.value.trim()
  if (value) add(value)
  draft.value = ''
  editing.value = false
}

function focusInput(): void {
  editing.value = true
}
</script>

<style scoped>
.tagsel {
  display: flex;
  flex-direction: column;
}

.tagsel-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.tagsel-item {
  height: 50rpx;
  padding-left: 20rpx;
  padding-right: 12rpx;
  border-radius: 25rpx;
  background-color: #eaebfd;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}

.tagsel-text {
  font-size: 21rpx;
  font-weight: 500;
  color: #5b50f5;
}

.tagsel-close {
  width: 34rpx;
  height: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4rpx;
}

.tagsel-add {
  height: 50rpx;
  padding-left: 18rpx;
  padding-right: 20rpx;
  border-radius: 25rpx;
  border: 1px dashed #d8d8e6;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 12rpx;
}

.tagsel-add-text {
  margin-left: 6rpx;
  font-size: 20rpx;
  color: #8a8fa3;
}

.tagsel-inputrow {
  margin-top: 4rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background-color: #f8f8fd;
  padding-left: 20rpx;
  padding-right: 20rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.tagsel-input {
  flex: 1;
  font-size: 24rpx;
  color: #1f2233;
}

.tagsel-suggest {
  margin-top: 4rpx;
}

.tagsel-hint {
  font-size: 20rpx;
  color: #a9aec2;
}

.tagsel-suggest-list {
  margin-top: 10rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.tagsel-suggest-item {
  height: 46rpx;
  padding-left: 18rpx;
  padding-right: 18rpx;
  border-radius: 23rpx;
  background-color: #f5f5fb;
  display: flex;
  align-items: center;
  margin-right: 12rpx;
  margin-bottom: 10rpx;
}

.tagsel-suggest-text {
  font-size: 20rpx;
  color: #6b7186;
}
</style>

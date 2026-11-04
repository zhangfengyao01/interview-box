<template>
  <view class="empty">
    <view class="empty-icon">
      <AppIcon :name="icon" :size="72" color="#C9CCDC" />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="desc" class="empty-desc">{{ desc }}</text>
    <view v-if="actionText" class="empty-action" @tap="emit('action')">
      <text class="empty-action-text">{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    icon?: string
    title?: string
    desc?: string
    actionText?: string
  }>(),
  { icon: 'book', title: '还没有内容', desc: '', actionText: '' }
)

const emit = defineEmits<{ action: [] }>()
</script>

<style scoped>
.empty {
  padding-top: 120rpx;
  padding-bottom: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon {
  width: 150rpx;
  height: 150rpx;
  border-radius: 75rpx;
  background-color: #f7f7fc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  margin-top: 28rpx;
  font-size: 27rpx;
  font-weight: 600;
  color: #6b7186;
}

.empty-desc {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #a9aec2;
  text-align: center;
  line-height: 1.6;
  padding-left: 60rpx;
  padding-right: 60rpx;
}

/* 空态动作按钮：淡紫磨砂玻璃药丸，配方见 global.scss。 */
.empty-action {
  margin-top: 32rpx;
  height: 72rpx;
  padding-left: 40rpx;
  padding-right: 40rpx;
  border-radius: 36rpx;
  background-image: var(--glass-bg-tint);
  border: var(--glass-border);
  box-shadow: var(--glass-sheen), var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  display: flex;
  align-items: center;
}

.empty-action-text {
  font-size: 25rpx;
  font-weight: 600;
  color: #5b50f5;
}
</style>

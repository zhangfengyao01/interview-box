<template>
  <view class="tabbar">
    <view class="tabbar-line"></view>
    <view class="tabbar-inner">
      <view v-for="item in tabs" :key="item.key" class="tb-item" @tap="go(item)">
        <AppIcon
          :name="item.key === active ? item.iconFill : item.icon"
          :size="44"
          :color="item.key === active ? '#5B50F5' : '#8A8DA0'"
        />
        <text class="tb-label" :class="{ on: item.key === active }">{{ item.label }}</text>
        <view class="tb-underline" :class="{ on: item.key === active }"></view>
      </view>
    </view>
    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * 自定义底部导航（4 个一级页面）。
 *
 * 没用 pages.json 的原生 tabBar：设计稿要求紫色渐变选中态 + 1px 分隔线 + 安全区，
 * 原生 tabBar 在 H5 与小程序上表现不一致，自定义反而更可控。
 * 代价是要自己保证「每个 tab 页都渲染这个组件」，遗漏时页面底部会空一块。
 */
interface TabItem {
  key: string
  label: string
  /** 未选中：线性图标 */
  icon: string
  /** 选中：实心图标（设计稿选中态是填充式） */
  iconFill: string
  url: string
}

const props = withDefaults(defineProps<{ active?: string }>(), { active: 'home' })

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: 'home', iconFill: 'homeFill', url: '/pages/home/index' },
  { key: 'library', label: '题库', icon: 'book', iconFill: 'bookFill', url: '/pages/library/index' },
  { key: 'review', label: '复习', icon: 'review', iconFill: 'reviewFill', url: '/pages/review/index' },
  { key: 'profile', label: '我的', icon: 'user', iconFill: 'userFill', url: '/pages/profile/index' }
]

function go(item: TabItem): void {
  if (item.key === props.active) return
  uni.reLaunch({ url: item.url })
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  background-color: #ffffff;
}

.tabbar-line {
  height: 1px;
  background-color: #f0f0f7;
}

.tabbar-inner {
  height: 132rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.tb-item {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tb-label {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #8a8da0;
}

.tb-label.on {
  color: #5b50f5;
  font-weight: 600;
}

/* 选中态底部的短下划线（设计稿里每条 tab 选中都有一条） */
.tb-underline {
  width: 36rpx;
  height: 6rpx;
  margin-top: 6rpx;
  border-radius: 3rpx;
  background-color: transparent;
}

.tb-underline.on {
  background-color: #5b50f5;
}

.safe-bottom {
  height: constant(safe-area-inset-bottom);
  height: env(safe-area-inset-bottom);
}
</style>

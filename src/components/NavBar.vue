<template>
  <view class="nav-wrap">
    <view class="nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-side nav-left" @tap="onBack">
          <AppIcon v-if="showBack" name="chevronLeft" :size="40" color="#1F2233" />
        </view>
        <text class="nav-title">{{ title }}</text>
        <view class="nav-side nav-right">
          <slot name="right"></slot>
        </view>
      </view>
    </view>
    <view class="nav-placeholder" :style="{ paddingTop: statusBarHeight + 'px' }"></view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * 自定义导航栏：所有页面 `navigationStyle: custom`，状态栏高度必须自己补。
 * 返回逻辑优先 navigateBack，栈里只剩自己时 reLaunch 到首页 —— 否则会出现白屏。
 */
const props = withDefaults(
  defineProps<{
    title?: string
    showBack?: boolean
    fallback?: string
  }>(),
  { title: '', showBack: true, fallback: '/pages/home/index' }
)

const statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 20

function onBack(): void {
  if (!props.showBack) return
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: props.fallback })
}
</script>

<style scoped>
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background-color: #ffffff;
}

.nav-inner {
  position: relative;
  height: 88rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  /* 标题是绝对定位的，不占流；没有 space-between 时右侧图标会贴在左侧 */
  justify-content: space-between;
}

.nav-side {
  width: 140rpx;
  height: 88rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 28rpx;
}

.nav-right {
  justify-content: flex-end;
  padding-left: 0;
  padding-right: 28rpx;
}

.nav-left {
  padding-left: 24rpx;
}

.nav-title {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 33rpx;
  font-weight: 700;
  color: #1f2233;
  pointer-events: none;
}

.nav-placeholder {
  /* uni 给 view 的默认 box-sizing 是 border-box：height 会把 paddingTop 一起吃进去，
     占位高度 = 88rpx，比固定定位的 .nav（88rpx + 状态栏）矮了整整一个状态栏，
     结果是每页顶部内容被白色导航栏盖住一条（题库页表现为 tab 文字下半截被切掉）。
     这里必须 content-box，让占位高度 = 88rpx + 状态栏。 */
  box-sizing: content-box;
  height: 88rpx;
}
</style>

<template>
  <view class="ring" :style="outerStyle">
    <view class="ring-hole" :style="holeStyle">
      <slot></slot>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 环形进度：conic-gradient 画弧 + 内部白色圆挖洞。
 *
 * 为什么不用 canvas：小程序 canvas 要处理层级、DPR、重绘时机，成本远高于收益；
 * 纯 CSS 在 H5/APP 都稳。若某端 conic-gradient 不支持（老基础库），
 * 换成静态 SVG 双圆 + stroke-dasharray 即可，props 不变。
 */
const props = withDefaults(
  defineProps<{
    percent?: number
    size?: number
    stroke?: number
    /** 起始色；给了 colorTo 就沿弧做渐变 */
    color?: string
    colorTo?: string
    track?: string
  }>(),
  { percent: 0, size: 408, stroke: 24, color: '#5B50F5', colorTo: '', track: '#EDEDF6' }
)

const percent = computed(() => Math.max(0, Math.min(100, props.percent)))

const outerStyle = computed(() => {
  const deg = (percent.value / 100) * 360
  // 两色时用 conic-gradient 的第一个色标插值，弧线自然从蓝过渡到紫
  const arc = props.colorTo
    ? `${props.color} 0deg, ${props.colorTo} ${deg}deg`
    : `${props.color} 0deg ${deg}deg`
  return [
    `width:${props.size}rpx`,
    `height:${props.size}rpx`,
    'border-radius:50%',
    `background-image:conic-gradient(${arc}, ${props.track} ${deg}deg 360deg)`
  ].join(';')
})

const holeStyle = computed(() => {
  const inner = props.size - props.stroke * 2
  return [
    `width:${inner}rpx`,
    `height:${inner}rpx`,
    'border-radius:50%',
    'background-color:#ffffff',
    'position:absolute',
    'left:50%',
    'top:50%',
    `margin-left:-${inner / 2}rpx`,
    `margin-top:-${inner / 2}rpx`,
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center'
  ].join(';')
})
</script>

<style scoped>
.ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<template>
  <view class="app-icon" :style="styleStr"></view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { iconUri } from '@/utils/icons'

/**
 * 线性图标：内联 SVG + CSS mask 上色。
 *
 * 为什么不用 <image src=".svg">：mask 方案能随 `color` 变，一套图标支持任意颜色；
 * 也不用维护 40 个彩色 png。代价是微信小程序基础库对 mask-image 的支持要实测，
 * 若某端不生效，换成 <image> + 本地 svg 即可，调用方无需改动（接口只有 name/size/color）。
 */
const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    color?: string
  }>(),
  { size: 40, color: '#1F2233' }
)

const styleStr = computed(() => {
  const uri = iconUri(props.name)
  const base = `width:${props.size}rpx;height:${props.size}rpx`
  if (!uri) return `${base};`
  return [
    base,
    `background-color:${props.color}`,
    `-webkit-mask-image:${uri}`,
    `mask-image:${uri}`,
    '-webkit-mask-size:100% 100%',
    'mask-size:100% 100%',
    '-webkit-mask-repeat:no-repeat',
    'mask-repeat:no-repeat',
    '-webkit-mask-position:center',
    'mask-position:center'
  ].join(';')
})
</script>

<style>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>

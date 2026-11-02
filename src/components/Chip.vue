<template>
  <view class="chip" :class="{ 'chip--plain': plain }" :style="chipStyle" @tap="emit('tap')">
    <text class="chip-text" :style="{ color: textColor }">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    color?: string
    plain?: boolean
  }>(),
  { color: '', plain: false }
)

const emit = defineEmits<{ tap: [] }>()

const textColor = computed(() => props.color || '#5B50F5')

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const chipStyle = computed(() => {
  if (props.plain) return 'background-color:transparent;'
  if (props.color) return `background-color:${hexToRgba(props.color, 0.1)};`
  return 'background-color:#EAEBFD;'
})
</script>

<style scoped>
.chip {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  height: 46rpx;
  padding-left: 20rpx;
  padding-right: 20rpx;
  border-radius: 23rpx;
}

.chip-text {
  font-size: 21rpx;
  font-weight: 500;
  line-height: 1;
}
</style>

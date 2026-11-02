import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'

/**
 * 设置：**唯一**持久化到 storage 的用户偏好（不是业务数据）。
 *
 * 边界要清楚：题目、答案、复习记录都在数据库里，这里只放「开关和偏好」。
 * 丢了不至于伤数据，所以用同步 storage 直接读写、不做迁移。
 */

const KEY = 'interview_box_settings_v1'

export interface SettingsState {
  nickname: string
  dailyGoal: number
  cloudOcrEnabled: boolean
  cloudOcrEndpoint: string
  aiEnabled: boolean
  aiEndpoint: string
  aiStyle: 'interview' | 'detailed' | 'project'
  lastLibraryFilter: { categoryId: string; sort: string }
}

const DEFAULTS: SettingsState = {
  nickname: '张凤垚',
  dailyGoal: 20,
  cloudOcrEnabled: false,
  cloudOcrEndpoint: '',
  aiEnabled: false,
  aiEndpoint: '',
  aiStyle: 'interview',
  lastLibraryFilter: { categoryId: '', sort: 'updated' }
}

function load(): SettingsState {
  try {
    const raw = uni.getStorageSync(KEY)
    const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw
    return { ...DEFAULTS, ...(obj || {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const state = ref<SettingsState>(load())

  const cloudReady = computed(() => state.value.cloudOcrEnabled && !!state.value.cloudOcrEndpoint)
  const aiReady = computed(() => state.value.aiEnabled && !!state.value.aiEndpoint)

  function save(): void {
    try {
      uni.setStorageSync(KEY, JSON.stringify(state.value))
    } catch {
      /* 偏好写不进去不影响主数据，下次启动会回到默认值 */
    }
  }

  function patch(next: Partial<SettingsState>): void {
    state.value = { ...state.value, ...next }
  }

  function reset(): void {
    state.value = { ...DEFAULTS }
    save()
  }

  watch(state, save, { deep: true })

  return { state, cloudReady, aiReady, patch, save, reset }
})

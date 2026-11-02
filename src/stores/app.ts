import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bootDatabase, dbEngine, dbFallbackInfo } from '@/adapters/database'
import { seedIfEmpty } from '@/data/seed'
import { db } from '@/adapters/database'
import { questionRepo } from '@/repositories/question'
import { categoryRepo } from '@/repositories/category'
import { reviewRepo } from '@/repositories/review'
import type { Category, QuestionStats } from '@/types/models'

/**
 * 全局状态：只装「多个页面都要看的汇总数字」，不装题目列表。
 *
 * 为什么不把列表也塞进来：题库可能上千条，放进全局 store 会导致
 * 任何一次刷新都重渲染所有引用它的页面；列表归各自页面管理更省。
 */

const EMPTY_STATS: QuestionStats = { total: 0, todayNew: 0, due: 0, mastered: 0, masteryRate: 0, favorite: 0 }

export const useAppStore = defineStore('app', () => {
  const ready = ref(false)
  const booting = ref(false)
  const engine = ref<'sqlite' | 'storage'>('storage')
  const fallbackReason = ref('')
  const stats = ref<QuestionStats>({ ...EMPTY_STATS })
  const categories = ref<Category[]>([])
  const todayReviewed = ref(0)
  const streak = ref(0)
  const seeded = ref(false)
  const version = ref('1.0.0')
  const lastError = ref('')

  const goalProgress = computed(() => 0)

  /** 启动流程：开库 → 首次写示例 → 拉汇总。只跑一次 */
  async function bootstrap(force = false): Promise<void> {
    if (ready.value && !force) return
    if (booting.value) return
    booting.value = true
    try {
      await bootDatabase()
      engine.value = dbEngine()
      const info = dbFallbackInfo()
      fallbackReason.value = info.fellBack ? info.reason : ''
      seeded.value = await seedIfEmpty(db())
      await refresh()
      ready.value = true
      lastError.value = ''
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      booting.value = false
    }
  }

  /** 数据变更后刷新汇总数字（页面 onShow 调用即可，成本很低） */
  async function refresh(): Promise<void> {
    const [nextStats, cats, reviewed, streakDays] = await Promise.all([
      questionRepo.stats(),
      categoryRepo.list(),
      reviewRepo.todayCount(),
      reviewRepo.streak()
    ])
    stats.value = nextStats
    categories.value = cats
    todayReviewed.value = reviewed
    streak.value = streakDays
  }

  function categoryName(id: string | null | undefined): string {
    if (!id) return '未分类'
    const hit = categories.value.find((c) => c.id === id)
    return hit ? hit.name : '未分类'
  }

  return {
    ready,
    booting,
    engine,
    fallbackReason,
    stats,
    categories,
    todayReviewed,
    streak,
    seeded,
    version,
    lastError,
    goalProgress,
    bootstrap,
    refresh,
    categoryName
  }
})

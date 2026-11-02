<template>
  <view class="screen screen--hasbar">
    <NavBar :title="isEdit ? '编辑题目' : '新建题目'">
      <template #right>
        <text v-if="isEdit" class="nav-del tap" @tap="remove">删除</text>
      </template>
    </NavBar>

    <view class="field">
      <text class="field-label">题目</text>
      <textarea
        v-model="form.title"
        class="field-input field-input--title"
        placeholder="一句话写清这道题问什么"
        placeholder-class="ph"
        auto-height
        :maxlength="-1"
        @blur="checkSimilar"
      />
      <view v-if="similarTip" class="dupe">
        <AppIcon name="info" :size="24" color="#F59E0B" />
        <text class="dupe-text">题库里已有相似题目：{{ similarTip }}</text>
      </view>
    </view>

    <view class="field">
      <AnswerEditor
        v-model="form.referenceAnswer"
        label="参考答案"
        placeholder="面试时可以先说结论，再展开原理"
        :show-ai="aiReady"
        :generating="generating"
        :ai-hint="aiHint"
        @generate="generateAnswer"
      />
    </view>

    <view class="field">
      <AnswerEditor v-model="form.myAnswer" label="我的答案" placeholder="自己的表达，便于对比参考答案" />
    </view>

    <view class="field">
      <AnswerEditor v-model="form.notes" label="学习笔记" placeholder="易错点、补充资料" />
    </view>

    <view class="rows">
      <view class="row">
        <text class="row-label">分类</text>
        <picker :range="categoryNames" :value="categoryIndex" @change="onCategory">
          <view class="picker">
            <text class="picker-text">{{ categoryName }}</text>
            <AppIcon name="chevronDown" :size="22" color="#8A8FA3" />
          </view>
        </picker>
      </view>

      <view class="row">
        <text class="row-label">难度</text>
        <picker :range="difficultyNames" :value="form.difficulty - 1" @change="onDifficulty">
          <view class="picker">
            <text class="picker-text">{{ difficultyNames[form.difficulty - 1] }}</text>
            <AppIcon name="chevronDown" :size="22" color="#8A8FA3" />
          </view>
        </picker>
      </view>

      <view class="row">
        <text class="row-label">掌握</text>
        <picker :range="masteryNames" :value="masteryIndex" @change="onMastery">
          <view class="picker">
            <text class="picker-text">{{ masteryNames[masteryIndex] }}</text>
            <AppIcon name="chevronDown" :size="22" color="#8A8FA3" />
          </view>
        </picker>
      </view>
    </view>

    <view class="field">
      <text class="field-label">标签</text>
      <TagSelector v-model="tags" :suggestions="allTags" />
    </view>

    <view class="bottombar">
      <view class="bar-main tap" @tap="save">
        <text class="bar-main-text">保存</text>
      </view>
    </view>

    <!-- AI 草稿层：只展示、可编辑、确认才写回 -->
    <view v-if="draft" class="sheet-mask" @tap="closeDraft"></view>
    <view v-if="draft" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">AI 草稿 · {{ styleLabel }}</text>
        <view class="sheet-close" @tap="closeDraft">
          <AppIcon name="close" :size="26" color="#8A8FA3" />
        </view>
      </view>

      <text class="sheet-tip">{{ draftTip }}</text>

      <textarea
        v-model="draftText"
        class="sheet-input"
        auto-height
        :maxlength="-1"
        placeholder="可以在这里改完再采用"
      />

      <view v-if="draft.result.followUps.length" class="sheet-follow">
        <text class="sheet-follow-title">面试官可能追问</text>
        <text v-for="(f, i) in draft.result.followUps" :key="i" class="sheet-follow-item">· {{ f }}</text>
      </view>

      <view class="sheet-actions">
        <view class="sheet-btn sheet-btn--ghost" @tap="closeDraft">
          <text class="sheet-btn-ghost-text">先不用</text>
        </view>
        <view class="sheet-btn sheet-btn--primary" @tap="acceptDraft">
          <text class="sheet-btn-primary-text">采用这段答案</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import AnswerEditor from '@/components/AnswerEditor.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import { questionService } from '@/services/question'
import { tagRepo } from '@/repositories/category'
import { aiService, AI_STYLE_LABEL, buildRequest } from '@/services/ai'
import { MASTERY_LABEL } from '@/services/review/scheduler'
import { errorMessage } from '@/adapters/network'
import type { AiAnswerDraft, AnswerStyle } from '@/types/ai'
import type { Difficulty, MasteryStatus, Question, Tag } from '@/types/models'

/**
 * 新建 / 编辑题目。
 *
 * AI 答案助手的完整链路都在这一页（PRD §5）：
 *   点「AI 生成」→ 代理返回五段式答案 → **先落成草稿层**（可改）
 *   → 用户点「采用」才写 reference_answer。
 *
 * 两个细节：
 * - 新建态没有 id，草稿没法按题存；此时采用只回填输入框，保存时才入库；
 * - 已有参考答案时采用前会二次确认「覆盖」，默认不覆盖。
 */
const app = useAppStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.state

const MASTERY_KEYS: MasteryStatus[] = ['new', 'learning', 'fuzzy', 'mastered']

const id = ref('')
const tags = ref<string[]>([])
const allTags = ref<Tag[]>([])
const similarTip = ref('')
const generating = ref(false)
const draft = ref<AiAnswerDraft | null>(null)
const draftText = ref('')

const form = reactive({
  title: '',
  referenceAnswer: '',
  myAnswer: '',
  notes: '',
  categoryId: 'cat_fe',
  difficulty: 2 as Difficulty,
  masteryStatus: 'new' as MasteryStatus
})

const difficultyNames = ['简单', '中等', '困难']
const masteryNames = MASTERY_KEYS.map((k) => MASTERY_LABEL[k])

const isEdit = computed(() => !!id.value)
const categoryNames = computed(() => app.categories.map((c) => c.name))
const categoryIndex = computed(() => {
  const i = app.categories.findIndex((c) => c.id === form.categoryId)
  return i < 0 ? 0 : i
})
const categoryName = computed(() => app.categoryName(form.categoryId))
const masteryIndex = computed(() => {
  const i = MASTERY_KEYS.indexOf(form.masteryStatus)
  return i < 0 ? 0 : i
})
const aiReady = computed(() => aiService.isConfigured(settings))
const styleLabel = computed(() => AI_STYLE_LABEL[settings.aiStyle as AnswerStyle] || '面试口述版')
const aiHint = computed(() => {
  if (!aiReady.value) return '未配置 AI 代理，可在设置里开启（不影响手动写答案）'
  if (form.referenceAnswer.trim()) return '已有参考答案：采用 AI 草稿前会再确认一次覆盖'
  return ''
})
const draftTip = computed(() =>
  id.value
    ? '采用后会写入参考答案，并标记为 AI 生成'
    : '当前是新建题目，采用后先回填到输入框，保存后才入库'
)

onLoad(async (query?: Record<string, string>) => {
  await app.refresh()
  allTags.value = await tagRepo.list()

  if (query && query.id) {
    id.value = query.id
    const detail = await questionService.detail(query.id)
    const q = detail.question
    if (q) {
      form.title = q.title
      form.referenceAnswer = q.referenceAnswer || ''
      form.myAnswer = q.myAnswer || ''
      form.notes = q.notes || ''
      form.categoryId = q.categoryId || 'cat_fe'
      form.difficulty = q.difficulty || 2
      form.masteryStatus = q.masteryStatus || 'new'
      tags.value = detail.tags.map((t) => t.name)
    }
  }
})

function onCategory(e: { detail: { value: string | number } }): void {
  const c = app.categories[Number(e.detail.value)]
  if (c) form.categoryId = c.id
}

function onDifficulty(e: { detail: { value: string | number } }): void {
  form.difficulty = (Number(e.detail.value) + 1) as Difficulty
}

function onMastery(e: { detail: { value: string | number } }): void {
  form.masteryStatus = MASTERY_KEYS[Number(e.detail.value)]
}

async function checkSimilar(): Promise<void> {
  const t = form.title.trim()
  if (!t) {
    similarTip.value = ''
    return
  }
  const hits = await questionService.duplicates(t, id.value || undefined)
  similarTip.value = hits.length ? hits[0].title : ''
}

/** 把当前表单拼成一个 Question，供 buildRequest 复用（新建态也能生成） */
function formAsQuestion(): Question {
  const now = Date.now()
  return {
    id: id.value || 'draft',
    title: form.title,
    content: '',
    referenceAnswer: form.referenceAnswer,
    myAnswer: form.myAnswer,
    notes: form.notes,
    categoryId: form.categoryId,
    difficulty: form.difficulty,
    masteryStatus: form.masteryStatus,
    isFavorite: false,
    answerOrigin: 'manual',
    sourceCompany: '',
    sourceRole: '',
    sourceRound: '',
    sourceDate: null,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

async function generateAnswer(): Promise<void> {
  if (!form.title.trim()) {
    uni.showToast({ title: '先写题目，AI 才知道答什么', icon: 'none' })
    return
  }
  if (!aiReady.value) {
    uni.showModal({
      title: 'AI 助手未开启',
      content: '在「我的 → 设置」里打开 AI 助手并填入服务端代理地址后可用。手动写答案不受影响。',
      showCancel: false
    })
    return
  }

  generating.value = true
  try {
    const request = buildRequest(formAsQuestion(), categoryName.value, settings.aiStyle as AnswerStyle)
    const result = await aiService.generate(request, {
      aiEnabled: settings.aiEnabled,
      aiEndpoint: settings.aiEndpoint,
      questionId: id.value
    })
    draft.value = result
    draftText.value = result.result.answerMarkdown
  } catch (err) {
    uni.showModal({ title: '生成失败', content: errorMessage(err), showCancel: false })
  } finally {
    generating.value = false
  }
}

function closeDraft(): void {
  draft.value = null
  draftText.value = ''
}

async function acceptDraft(): Promise<void> {
  if (!draft.value) return

  if (!id.value) {
    form.referenceAnswer = draftText.value
    closeDraft()
    uni.showToast({ title: '已填入草稿，记得保存', icon: 'none' })
    return
  }

  const needConfirm = !!form.referenceAnswer.trim()
  if (needConfirm) {
    const ok = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '覆盖现有答案？',
        content: '这道题已经有参考答案。采用 AI 草稿会覆盖它，原答案不会保留。',
        confirmText: '覆盖',
        cancelText: '取消',
        confirmColor: '#EF4444',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      })
    })
    if (!ok) return
  }

  const res = await aiService.acceptDraft(draft.value, { editedText: draftText.value, overwrite: needConfirm })
  if (!res.ok) {
    uni.showModal({ title: '未采用', content: res.reason || '未知原因', showCancel: false })
    return
  }
  form.referenceAnswer = draftText.value
  closeDraft()
  uni.showToast({ title: '已写入参考答案', icon: 'none' })
}

async function save(): Promise<void> {
  if (!form.title.trim()) {
    uni.showToast({ title: '题目不能为空', icon: 'none' })
    return
  }
  const q = await questionService.save(
    {
      title: form.title,
      referenceAnswer: form.referenceAnswer,
      myAnswer: form.myAnswer,
      notes: form.notes,
      categoryId: form.categoryId,
      difficulty: form.difficulty,
      masteryStatus: form.masteryStatus,
      tags: tags.value
    },
    id.value || undefined
  )
  await app.refresh()
  uni.showToast({ title: '已保存', icon: 'none' })
  setTimeout(() => {
    if (id.value) uni.navigateBack()
    else uni.redirectTo({ url: `/pages/question/detail?id=${q.id}` })
  }, 400)
}

function remove(): void {
  uni.showModal({
    title: '删除题目',
    content: '删除后不可恢复，确定删除吗？',
    confirmColor: '#EF4444',
    success: async (res) => {
      if (!res.confirm) return
      await questionService.remove(id.value)
      await app.refresh()
      uni.navigateBack()
    }
  })
}
</script>

<style scoped>
.nav-del {
  font-size: 24rpx;
  color: #ef4444;
}

.field {
  margin: 24rpx 32rpx 0;
  padding: 26rpx 28rpx;
  border-radius: 27rpx;
  background-color: #f8f8fd;
}

.field-label {
  display: block;
  font-size: 21rpx;
  font-weight: 600;
  color: #8a8fa3;
  margin-bottom: 14rpx;
}

.field-input {
  width: 100%;
  min-height: 90rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #1f2233;
}

.field-input--title {
  font-size: 29rpx;
  font-weight: 700;
}

.ph {
  color: #a9aec2;
}

.dupe {
  margin-top: 16rpx;
  padding: 14rpx 18rpx;
  border-radius: 14rpx;
  background-color: #fff8ec;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.dupe-text {
  flex: 1;
  margin-left: 10rpx;
  font-size: 20rpx;
  line-height: 1.55;
  color: #a06a12;
}

.rows {
  margin: 24rpx 32rpx 0;
  border-radius: 27rpx;
  background-color: #f8f8fd;
  padding: 6rpx 28rpx;
}

.row {
  height: 100rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.row-label {
  font-size: 24rpx;
  color: #3c4157;
}

.picker {
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 30rpx;
  /* 白底胶囊压在白色卡片上等于隐形，用浅灰紫和别处的胶囊统一 */
  background-color: #f1f1f9;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.picker-text {
  font-size: 23rpx;
  color: #1f2233;
  margin-right: 8rpx;
}

.bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 150rpx;
  background-color: #ffffff;
  border-top: 1px solid #eff0f6;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 32rpx;
  padding-right: 32rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 60;
}

.bar-main {
  flex: 1;
  height: 96rpx;
  border-radius: 48rpx;
  background-image: linear-gradient(90deg, #5b50f5, #7b6df8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar-main-text {
  font-size: 29rpx;
  font-weight: 700;
  color: #ffffff;
}

.screen--hasbar {
  padding-bottom: 220rpx;
}

/* AI 草稿层 */
.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background-color: rgba(20, 22, 40, 0.42);
  z-index: 95;
}

.sheet {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 48rpx;
  max-height: 76vh;
  border-radius: 32rpx;
  background-color: #ffffff;
  padding: 32rpx;
  z-index: 96;
  display: flex;
  flex-direction: column;
}

.sheet-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.sheet-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2233;
}

.sheet-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-tip {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #a9aec2;
  line-height: 1.6;
}

.sheet-input {
  margin-top: 16rpx;
  max-height: 460rpx;
  width: 100%;
  border-radius: 20rpx;
  background-color: #f8f8fd;
  padding: 22rpx;
  font-size: 24rpx;
  line-height: 1.75;
  color: #1f2233;
}

.sheet-follow {
  margin-top: 18rpx;
}

.sheet-follow-title {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #5b50f5;
  margin-bottom: 8rpx;
}

.sheet-follow-item {
  display: block;
  font-size: 21rpx;
  line-height: 1.6;
  color: #6b7186;
}

.sheet-actions {
  margin-top: 24rpx;
  display: flex;
  flex-direction: row;
}

.sheet-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-btn--ghost {
  background-color: #f2f2f8;
  margin-right: 20rpx;
  flex: 0 0 200rpx;
}

.sheet-btn--primary {
  background-image: linear-gradient(90deg, #5b50f5, #7b6df8);
}

.sheet-btn-ghost-text {
  font-size: 25rpx;
  color: #6b7186;
}

.sheet-btn-primary-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>

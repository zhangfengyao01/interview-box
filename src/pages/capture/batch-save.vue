<template>
  <view class="screen screen--hasbar">
    <NavBar title="确认入库" />

    <view class="head">
      <text class="head-title">共 {{ items.length }} 道题</text>
      <text class="head-sub">确认分类与标签后批量写入，全部成功或全部不写入</text>
    </view>

    <view v-for="(item, i) in items" :key="i" class="item card">
      <view class="item-head">
        <view class="qnum">
          <text class="qnum-text">{{ i + 1 }}</text>
        </view>
        <textarea
          v-model="item.title"
          class="item-title"
          auto-height
          :maxlength="-1"
          placeholder="题目标题"
        />
      </view>

      <view v-if="item.referenceAnswer" class="item-answer">
        <text class="item-answer-text">{{ item.referenceAnswer }}</text>
      </view>

      <view class="item-row">
        <text class="item-label">分类</text>
        <picker :range="categoryNames" :value="categoryIndex(i)" @change="onCategory(i, $event)">
          <view class="picker">
            <text class="picker-text">{{ categoryName(i) }}</text>
            <AppIcon name="chevronDown" :size="22" color="#8A8FA3" />
          </view>
        </picker>
      </view>

      <view class="item-row item-row--tags">
        <text class="item-label">标签</text>
        <view class="tag-wrap">
          <view v-for="(t, ti) in item.tags" :key="t" class="tag" @tap="removeTag(i, ti)">
            <text class="tag-text">{{ t }}</text>
            <AppIcon name="close" :size="18" color="#5B50F5" />
          </view>
          <input
            v-model="item.newTag"
            class="tag-input"
            placeholder="添加标签"
            placeholder-class="tag-ph"
            confirm-type="done"
            @confirm="addTag(i)"
          />
        </view>
      </view>

      <view v-if="dupes[i]" class="dupe">
        <AppIcon name="info" :size="26" color="#F59E0B" />
        <text class="dupe-text">疑似与「{{ dupes[i].title }}」重复，可仍然保存</text>
      </view>
    </view>

    <view class="bottombar">
      <view class="bar-info">
        <text class="bar-info-text">将写入 {{ items.length }} 道题</text>
      </view>
      <view class="bar-main tap" @tap="save">
        <text class="bar-main-text">确认保存</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAppStore } from '@/stores/app'
import { questionService, type DuplicateHit } from '@/services/question'
import { sourceRepo } from '@/repositories/source'
import { fileAdapter } from '@/adapters/file'
import { inferCategoryId } from '@/services/question/tagger'
import { errorMessage } from '@/adapters/network'

/**
 * 批量入库确认页：逐题确认标题/分类/标签 → 一次事务写库。
 *
 * 三件必须做对的事：
 * 1. **图片先落盘再入库**：临时路径重启就失效，`fileAdapter.persist()` 失败要如实报错，
 *    不能把 `temp://...` 写进数据库装作成功了；
 * 2. **原始文本落进 source_assets**：校对前后都留着，验收要求「OCR 原始文本可以保留」；
 * 3. **一次事务**：8 道题要么全进要么都不进，中途失败不能留半截。
 */
interface DraftItem {
  title?: string
  content?: string
  referenceAnswer?: string
  categoryId?: string
  tags?: string[]
}

interface BatchDraft {
  items?: DraftItem[]
  meta?: {
    rawText?: string
    editedText?: string
    ocrEngine?: string
    sourceType?: 'image' | 'text'
    assets?: { path: string; rawText: string; engine: string }[]
  }
}

interface EditItem {
  title: string
  content: string
  referenceAnswer: string
  categoryId: string
  tags: string[]
  newTag: string
}

const app = useAppStore()

const items = ref<EditItem[]>([])
const meta = ref<BatchDraft['meta']>({})
const dupes = ref<Record<number, DuplicateHit>>({})

const categories = computed(() => app.categories)
const categoryNames = computed(() => categories.value.map((c) => c.name))

onLoad(async () => {
  await app.refresh()
  const raw = uni.getStorageSync('batch_draft')
  const d = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw) as BatchDraft
  meta.value = d.meta || {}
  items.value = (d.items || []).map((it) => ({
    title: it.title || '',
    content: it.content || it.title || '',
    referenceAnswer: it.referenceAnswer || '',
    categoryId: it.categoryId || inferCategoryId(it.title || ''),
    tags: (it.tags || []).slice(),
    newTag: ''
  }))
  await checkDupes()
})

function categoryName(i: number): string {
  const c = categories.value.find((x) => x.id === items.value[i].categoryId)
  return c ? c.name : '未分类'
}

function categoryIndex(i: number): number {
  const idx = categories.value.findIndex((x) => x.id === items.value[i].categoryId)
  return idx < 0 ? 0 : idx
}

function onCategory(i: number, e: { detail: { value: string | number } }): void {
  const c = categories.value[Number(e.detail.value)]
  if (c) items.value[i].categoryId = c.id
}

function addTag(i: number): void {
  const raw = (items.value[i].newTag || '').trim()
  if (!raw) return
  if (items.value[i].tags.indexOf(raw) < 0) items.value[i].tags.push(raw)
  items.value[i].newTag = ''
}

function removeTag(i: number, ti: number): void {
  items.value[i].tags.splice(ti, 1)
}

async function checkDupes(): Promise<void> {
  const map: Record<number, DuplicateHit> = {}
  for (let i = 0; i < items.value.length; i += 1) {
    const hits = await questionService.duplicates(items.value[i].title)
    if (hits.length) map[i] = hits[0]
  }
  dupes.value = map
}

async function save(): Promise<void> {
  const valid = items.value.filter((it) => String(it.title || '').trim())
  if (!valid.length) {
    uni.showToast({ title: '没有有效题目', icon: 'none' })
    return
  }

  uni.showLoading({ title: '写入中', mask: true })
  try {
    // 1. 图片先落进沙箱（APP 才有；其它平台如实降级为「不存图」）
    const persisted: { assetId: string }[] = []
    for (const asset of meta.value?.assets || []) {
      let savedPath: string | null = null
      if (fileAdapter.isPersistentSupported()) {
        savedPath = await fileAdapter.persist(asset.path)
      }
      const record = await sourceRepo.save({
        sourceType: 'image',
        filePath: savedPath,
        rawText: asset.rawText,
        editedText: meta.value?.editedText || '',
        ocrEngine: asset.engine
      })
      persisted.push({ assetId: record.id })
    }

    // 2. 文本来源（粘贴）也留一份原始文本
    if (!persisted.length && meta.value?.rawText) {
      const record = await sourceRepo.save({
        sourceType: 'text',
        filePath: null,
        rawText: meta.value.rawText,
        editedText: meta.value.editedText || '',
        ocrEngine: meta.value.ocrEngine || 'manual'
      })
      persisted.push({ assetId: record.id })
    }

    // 3. 题目 + 标签 + 来源关系，一个事务
    const result = await questionService.saveBatch(
      valid.map((it) => ({
        title: it.title,
        content: it.content,
        referenceAnswer: it.referenceAnswer,
        categoryId: it.categoryId,
        tags: it.tags
      })),
      { assetId: persisted[0]?.assetId }
    )

    // 4. 多图时把其余来源也关联上（同一次识别的产物，共享来源合理）
    for (const asset of persisted.slice(1)) {
      await sourceRepo.link(asset.assetId, result.questionIds)
    }

    uni.hideLoading()
    uni.removeStorageSync('batch_draft')
    uni.removeStorageSync('capture_draft')
    await app.refresh()
    uni.showToast({ title: `已保存 ${result.created} 道题`, icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/library/index' })
    }, 600)
  } catch (err) {
    uni.hideLoading()
    uni.showModal({ title: '保存失败', content: errorMessage(err), showCancel: false })
  }
}
</script>

<style scoped>
.head {
  margin: 12rpx 32rpx 0;
}

.head-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2233;
}

.head-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

.item {
  margin: 24rpx 32rpx 0;
  padding: 30rpx 32rpx 32rpx;
  border-radius: 31rpx;
}

.item-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.qnum {
  width: 46rpx;
  height: 46rpx;
  border-radius: 23rpx;
  background-color: #eaebfd;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  margin-top: 4rpx;
}

.qnum-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #5b50f5;
}

.item-title {
  flex: 1;
  width: 100%;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.5;
  color: #1f2233;
}

.item-answer {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background-color: #f4f3ff;
}

.item-answer-text {
  font-size: 22rpx;
  line-height: 1.65;
  color: #5a5f78;
}

.item-row {
  margin-top: 24rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.item-row--tags {
  align-items: flex-start;
}

.item-label {
  width: 80rpx;
  font-size: 23rpx;
  color: #8a8fa3;
  line-height: 60rpx;
}

.picker {
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 30rpx;
  background-color: #f5f5fb;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.picker-text {
  font-size: 23rpx;
  color: #1f2233;
  margin-right: 8rpx;
}

.tag-wrap {
  flex: 1;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
}

.tag {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 48rpx;
  padding: 0 16rpx;
  border-radius: 14rpx;
  background-color: #eaebfd;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}

.tag-text {
  font-size: 21rpx;
  color: #5b50f5;
  margin-right: 6rpx;
}

.tag-input {
  width: 180rpx;
  height: 48rpx;
  font-size: 21rpx;
  color: #1f2233;
  margin-bottom: 12rpx;
}

.tag-ph {
  color: #b4b9ca;
}

.dupe {
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background-color: #fff8ec;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.dupe-text {
  flex: 1;
  margin-left: 10rpx;
  font-size: 21rpx;
  color: #a06a12;
  line-height: 1.5;
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
  padding: 0 32rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 60;
}

.bar-info {
  flex: 1;
}

.bar-info-text {
  font-size: 22rpx;
  color: #8a8fa3;
}

.bar-main {
  width: 340rpx;
  height: 92rpx;
  border-radius: 46rpx;
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
  padding-bottom: 200rpx;
}
</style>

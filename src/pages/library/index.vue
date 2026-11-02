<template>
  <view class="screen screen--tabbar screen--fill">
    <NavBar title="我的题库" :show-back="false">
      <template #right>
        <view class="nav-icons">
          <view class="nav-icon" @tap="toggleSearch">
            <AppIcon name="search" :size="38" color="#1F2233" />
          </view>
          <view class="nav-icon" @tap="openMore">
            <AppIcon name="more" :size="38" color="#1F2233" />
          </view>
        </view>
      </template>
    </NavBar>

    <view v-if="searchOpen" class="searchbar">
      <AppIcon name="search" :size="30" color="#A9AEC2" />
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索题目、答案、笔记、标签"
        placeholder-class="search-ph"
        confirm-type="search"
        focus
        @confirm="onSearch"
      />
      <view v-if="keyword" class="search-clear" @tap="keyword = ''">
        <AppIcon name="close" :size="24" color="#8A8FA3" />
      </view>
    </view>

    <scroll-view v-else scroll-x class="tabs" :show-scrollbar="false">
      <view class="tabs-inner">
        <view v-for="t in tabs" :key="t.id" class="tab" @tap="selectTab(t.id)">
          <text class="tab-text" :class="{ on: t.id === activeId }">{{ t.name }}</text>
          <view v-if="t.id === activeId" class="tab-line"></view>
        </view>
      </view>
    </scroll-view>

    <!-- 分类总览：设计稿是「一个白容器里的四行」，不是四张独立卡片 -->
    <block v-if="showOverview">
      <view v-if="cards.length" class="catbox">
        <view
          v-for="(c, i) in cards"
          :key="c.categoryId"
          class="catrow tap"
          @tap="selectTab(c.categoryId)"
        >
          <view class="cat-icon" :style="{ backgroundColor: c.bg }">
            <AppIcon :name="c.icon" :size="42" :color="c.color" />
          </view>
          <view class="cat-main">
            <text class="cat-name">{{ c.name }}</text>
            <text class="cat-meta">共 {{ c.total }} 题 · 已学 {{ c.learned }} 题</text>
            <view class="cat-progress">
              <view class="bar">
                <view class="bar-fill" :style="{ width: c.percent + '%' }"></view>
              </view>
              <text class="cat-pct">{{ c.percent }}%</text>
            </view>
          </view>
          <view v-if="i < cards.length - 1" class="cat-line"></view>
        </view>

        <!-- 设计稿里「添加题库」是白卡片内的最后一行，不是卡片外的独立按钮 -->
        <view class="addbtn-wrap addbtn-in">
          <view class="btn-primary tap" @tap="createCategory">
            <AppIcon name="plus" :size="30" color="#FFFFFF" />
            <text class="addbtn-text">添加题库</text>
          </view>
        </view>
      </view>

      <EmptyState
        v-if="!cards.length"
        icon="book"
        title="还没有分类"
        desc="先创建一个分类，再把题目收进来"
        action-text="新建分类"
        @action="createCategory"
      />
    </block>

    <!-- 题目列表 -->
    <block v-else>
      <view class="listhead">
        <text class="listhead-text">{{ listTitle }} · {{ list.length }} 题</text>
        <view class="sortbtn tap" @tap="openSort">
          <AppIcon name="sort" :size="24" color="#8A8FA3" />
          <text class="sortbtn-text">{{ sortLabel }}</text>
        </view>
      </view>

      <view v-for="(q, i) in list" :key="q.id" class="listitem">
        <QuestionCard
          :question="q"
          :index="i + 1"
          :tags="tagsOf(q.id)"
          :meta-text="metaOf(q)"
          @tap="openDetail(q.id)"
        />
      </view>

      <EmptyState
        v-if="!list.length"
        icon="search"
        title="没有匹配的题目"
        desc="换个关键词，或回到全部分类看看"
        action-text="清空筛选"
        @action="clearFilter"
      />
    </block>

    <view v-if="!showOverview || !cards.length" class="addbtn-wrap">
      <view class="btn-primary tap" @tap="createCategory">
        <AppIcon name="plus" :size="30" color="#FFFFFF" />
        <text class="addbtn-text">添加题库</text>
      </view>
    </view>
  </view>

  <TabBar active="library" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import TabBar from '@/components/TabBar.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAppStore } from '@/stores/app'
import { questionRepo } from '@/repositories/question'
import { categoryRepo } from '@/repositories/category'
import { db } from '@/adapters/database'
import { mapTag } from '@/adapters/database/mappers'
import { categoryStyle } from '@/data/category-style'
import { fromNow } from '@/utils/date'
import type { CategoryStats, Question, Tag } from '@/types/models'

/**
 * 我的题库：分类总览 + 列表 + 搜索 + 排序。
 *
 * 两个实现选择：
 * 1. 标签一次性取全（question_tags + tags 各一条查询）再在内存里建索引，
 *    而不是每道题查一次 —— 列表 50 条就是 100 次查询，SQLite 也扛不住；
 * 2. 总览卡片只在「无筛选」时显示，选了分类或搜了关键词就切到列表，
 *    避免两个列表在同一屏抢注意力。
 */
const app = useAppStore()

const SORTS = [
  { key: 'updated', label: '最近更新' },
  { key: 'created', label: '最近添加' },
  { key: 'review', label: '待复习优先' },
  { key: 'favorite', label: '收藏优先' }
] as const

const activeId = ref('')
const keyword = ref('')
const searchOpen = ref(false)
const sort = ref<'updated' | 'created' | 'review' | 'favorite'>('updated')
const list = ref<Question[]>([])
const cards = ref<(CategoryStats & { name: string; icon: string; color: string; bg: string })[]>([])
const tagMap = ref<Record<string, Tag[]>>({})

const tabs = computed(() => [{ id: '', name: '全部' }].concat(app.categories.map((c) => ({ id: c.id, name: c.name }))))
const showOverview = computed(() => !activeId.value && !keyword.value)
const listTitle = computed(() => {
  if (keyword.value) return `搜索「${keyword.value}」`
  const c = app.categories.find((x) => x.id === activeId.value)
  return c ? c.name : '全部题目'
})
const sortLabel = computed(() => (SORTS.find((s) => s.key === sort.value) || SORTS[0]).label)

async function reload(): Promise<void> {
  const stats = await questionRepo.categoryStats()
  cards.value = stats.map((s) => {
    const style = categoryStyle(s.categoryId)
    return {
      ...s,
      name: app.categoryName(s.categoryId),
      icon: style.icon,
      color: style.color,
      bg: style.bg
    }
  })

  list.value = await questionRepo.list({
    categoryId: activeId.value || undefined,
    keyword: keyword.value || undefined,
    sort: sort.value
  })

  // 一次把「题 ↔ 标签」全部取回，避免逐题查询
  const [links, tags] = await Promise.all([db().all('question_tags'), db().all('tags')])
  const tagById = new Map(tags.map((r) => [String(r.id), mapTag(r)]))
  const map: Record<string, Tag[]> = {}
  links.forEach((l) => {
    const qid = String(l.question_id)
    const tag = tagById.get(String(l.tag_id))
    if (!tag) return
    if (!map[qid]) map[qid] = []
    map[qid].push(tag)
  })
  tagMap.value = map
}

onShow(reload)

function tagsOf(id: string): Tag[] {
  return tagMap.value[id] || []
}

function metaOf(q: Question): string {
  return `${fromNow(q.updatedAt)}更新`
}

function selectTab(id: string): void {
  activeId.value = id
  keyword.value = ''
  void reload()
}

function toggleSearch(): void {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) {
    keyword.value = ''
    void reload()
  }
}

function clearFilter(): void {
  activeId.value = ''
  keyword.value = ''
  void reload()
}

function openSort(): void {
  uni.showActionSheet({
    itemList: SORTS.map((s) => s.label),
    success: (res) => {
      sort.value = SORTS[res.tapIndex].key
      void reload()
    }
  })
}

function openMore(): void {
  uni.showActionSheet({
    itemList: ['排序方式', '新建分类'],
    success: (res) => {
      if (res.tapIndex === 0) openSort()
      else createCategory()
    }
  })
}

function createCategory(): void {
  uni.showModal({
    title: '新建分类',
    editable: true,
    placeholderText: '例如：Vue 原理',
    success: async (res) => {
      if (!res.confirm) return
      const name = String(res.content || '').trim()
      if (!name) return
      await categoryRepo.create(name)
      await app.refresh()
      await reload()
      uni.showToast({ title: '已创建', icon: 'none' })
    }
  })
}

/** 键盘「搜索」：真正触发查询，而不是什么都不做 */
function onSearch(): void {
  void reload()
}

function openDetail(id: string): void {
  uni.navigateTo({ url: `/pages/question/detail?id=${id}` })
}
</script>

<style scoped>
.screen--fill {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav-icons {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.nav-icon {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12rpx;
}

.searchbar {
  margin: 8rpx 32rpx 0;
  height: 76rpx;
  border-radius: 38rpx;
  background-color: #f5f5fb;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 26rpx;
}

.search-input {
  flex: 1;
  margin-left: 14rpx;
  font-size: 24rpx;
  color: #1f2233;
}

.search-ph {
  color: #a9aec2;
}

.search-clear {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabs {
  margin-top: 10rpx;
  white-space: nowrap;
}

.tabs-inner {
  display: flex;
  flex-direction: row;
  padding: 0 32rpx;
  align-items: center;
}

.tab {
  position: relative;
  flex-shrink: 0;
  margin-right: 36rpx;
  padding-top: 12rpx;
  padding-bottom: 16rpx;
}

/* 不加 nowrap 时 scroll-view 会把「前端开发」挤成三行竖排 */
.tab-text {
  font-size: 26rpx;
  color: #6b7186;
  white-space: nowrap;
}

.tab-text.on {
  font-size: 27rpx;
  font-weight: 700;
  color: #5b50f5;
}

.tab-line {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 38rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background-color: #5b50f5;
}

.catbox {
  margin: 18rpx 32rpx 0;
  padding: 6rpx 30rpx 26rpx;
  border-radius: 32rpx;
  background-color: #ffffff;
  box-shadow: 0 10rpx 30rpx rgba(70, 66, 140, 0.06);
}

.catrow {
  position: relative;
  padding: 26rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.cat-icon {
  width: 84rpx;
  height: 84rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-main {
  flex: 1;
  margin-left: 22rpx;
  overflow: hidden;
}

.cat-name {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: #171a2c;
}

.cat-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

/* 进度条与百分比同一行：百分比贴右，条自适应剩余宽度 */
.cat-progress {
  margin-top: 16rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.bar {
  flex: 1;
  height: 9rpx;
  border-radius: 5rpx;
  background-color: #eeeff7;
  overflow: hidden;
}

.bar-fill {
  height: 9rpx;
  border-radius: 5rpx;
  background-image: linear-gradient(90deg, #5b50f5, #8b7cf6);
}

.cat-pct {
  margin-left: 18rpx;
  font-size: 22rpx;
  color: #6b7186;
  width: 66rpx;
  text-align: right;
}

/* 行间细线：只在行底部、内缩到文字左边缘 */
.cat-line {
  position: absolute;
  left: 106rpx;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: #f2f2f8;
}

.listhead {
  margin: 24rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.listhead-text {
  font-size: 22rpx;
  color: #8a8fa3;
}

.sortbtn {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.sortbtn-text {
  margin-left: 6rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

.listitem {
  margin: 20rpx 32rpx 0;
}

.addbtn-wrap {
  margin: 40rpx 32rpx 0;
}

/* 卡片内的按钮：左右不再额外收边，只留上下间距 */
.addbtn-in {
  margin: 24rpx 0 0;
}

.addbtn-text {
  margin-left: 10rpx;
  font-size: 29rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>

<template>
  <view class="screen screen--tabbar">
    <view :style="{ height: statusBarHeight + 'px' }"></view>

    <view class="topbar">
      <view class="gear tap" @tap="goSettings">
        <AppIcon name="gear" :size="44" color="#171A2C" />
      </view>
    </view>

    <view class="logo-wrap">
      <AppIcon name="briefcaseFill" :size="132" color="#5B50F5" />
      <view class="logo-spark">
        <AppIcon name="sparkle" :size="40" color="#FFC53D" />
      </view>
    </view>

    <text class="app-title">面试题匣</text>
    <text class="app-sub">识别 · 整理 · 复习 · 提升</text>

    <!-- AI 横幅：光斑 + 倾斜文档（带扫描角标）+ 手写体标语 -->
    <view class="banner">
      <view class="bokeh bokeh--1"></view>
      <view class="bokeh bokeh--2"></view>
      <view class="bokeh bokeh--3"></view>

      <view class="paper-back"></view>
      <view class="paper">
        <view class="scan-corner scan-corner--tl"></view>
        <view class="scan-corner scan-corner--tr"></view>
        <view class="scan-corner scan-corner--bl"></view>
        <view class="scan-corner scan-corner--br"></view>
        <view class="paper-line paper-line--short"></view>
        <view class="paper-line"></view>
        <view class="paper-line"></view>
        <view class="paper-line"></view>
        <view class="paper-line paper-line--mid"></view>
      </view>

      <view class="banner-ai">
        <text class="banner-ai-text">AI</text>
      </view>

      <view class="slogan">
        <text class="slogan-text">让面试更有准备!</text>
        <view class="slogan-arc"></view>
      </view>
    </view>

    <view class="grid">
      <view v-for="e in entries" :key="e.key" class="entry tap" @tap="goCapture(e.key)">
        <AppIcon :name="e.icon" :size="54" :color="e.color" />
        <text class="entry-title">{{ e.title }}</text>
        <text class="entry-sub">{{ e.sub }}</text>
      </view>
    </view>

    <view class="section">
      <text class="t-section">我的题库</text>
      <view class="section-more tap" @tap="goLibrary">
        <text class="more-text">全部</text>
        <AppIcon name="chevronRight" :size="23" color="#8A8FA3" />
      </view>
    </view>

    <view class="stats">
      <view v-for="s in statList" :key="s.label" class="stat">
        <text class="stat-value">{{ s.value }}</text>
        <text class="stat-label">{{ s.label }}</text>
      </view>
    </view>

    <view class="section section--gap">
      <text class="t-section">最近学习</text>
      <view class="section-more tap" @tap="goLibrary">
        <text class="more-text">更多</text>
        <AppIcon name="chevronRight" :size="23" color="#8A8FA3" />
      </view>
    </view>

    <view v-if="recent" class="recent tap" @tap="openDetail(recent.id)">
      <view class="recent-badge">
        <text class="recent-badge-text">{{ badgeText }}</text>
      </view>
      <view class="recent-main">
        <text class="recent-title">{{ recent.title }}</text>
        <text class="recent-sub">{{ recentSub }}</text>
      </view>
      <AppIcon name="chevronRight" :size="26" color="#C3C7D6" />
    </view>

    <view v-else class="recent recent--empty" @tap="goCapture('manual')">
      <view class="recent-badge">
        <AppIcon name="plus" :size="30" color="#5B50F5" />
      </view>
      <view class="recent-main">
        <text class="recent-title">还没有题目</text>
        <text class="recent-sub">先收录第一道面试题吧</text>
      </view>
      <AppIcon name="chevronRight" :size="26" color="#C3C7D6" />
    </view>
  </view>

  <TabBar active="home" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import TabBar from '@/components/TabBar.vue'
import { useAppStore } from '@/stores/app'
import { questionRepo } from '@/repositories/question'
import { fromNow } from '@/utils/date'
import { MASTERY_LABEL } from '@/services/review/scheduler'
import type { Question } from '@/types/models'

/**
 * 首页：四个快捷入口 + 题库汇总 + 最近学习。
 *
 * 数据全部来自真实库（不是写死的数字），所以和设计稿上的 128/12/18/92% 不一致是正常的
 * —— 那几个是示意值。`refresh()` 在 onShow 里跑，从别的页面回来能立刻看到变化。
 */
const app = useAppStore()
const recent = ref<Question | null>(null)

/**
 * 四个入口的图标用**实心**变体 + 各自的品牌色（相机紫、相册蓝、剪贴板紫、加号紫）。
 * 设计稿里图标没有底座方块，所以这里不再包 `.entry-icon` 容器。
 */
const entries = [
  { key: 'camera', icon: 'cameraFill', color: '#5B50F5', title: '拍照识别', sub: '识别图片中的面试题' },
  { key: 'album', icon: 'imageFill', color: '#4A90F7', title: '相册识别', sub: '从相册选择图片' },
  { key: 'paste', icon: 'clipboardFill', color: '#5B50F5', title: '粘贴文本', sub: '快速导入文本' },
  { key: 'manual', icon: 'plus', color: '#5B50F5', title: '手动添加', sub: '自由编辑题目' }
]

/**
 * 顶部状态栏占位（给自定义导航区让位）。
 * 与 components/NavBar.vue 里是同一个坑：H5 上 uni 算出的 statusBarHeight 是 0
 * （`safeAreaInsets.top`，浏览器里 env(safe-area-inset-top) 就是 0），
 * `|| 20` 会凭空垫出一条 20px 的空白。所以 H5 写死 0，APP / 小程序才读系统值。
 * 「先声明、#ifndef 里再赋值」是为了让 vue-tsc 只看到一个声明。
 */
let statusBarHeight = 0
// #ifndef H5
statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 20
// #endif

const statList = computed(() => [
  { value: app.stats.total, label: '总题数' },
  { value: app.stats.todayNew, label: '今日新增' },
  { value: app.stats.due, label: '待复习' },
  { value: `${app.stats.masteryRate}%`, label: '掌握率' }
])

/**
 * 徽标取分类名的英文缩写：设计稿上是「JS」，对应 JavaScript 类题目。
 * 没有英文名时退回中文前两个字，不硬编码某个分类。
 */
const badgeText = computed(() => {
  if (!recent.value) return ''
  const name = app.categoryName(recent.value.categoryId)
  const en = name.match(/[A-Za-z]{2,}/)
  if (en) return en[0].slice(0, 2).toUpperCase()
  return name.slice(0, 2)
})

const recentSub = computed(() => {
  if (!recent.value) return ''
  const label = MASTERY_LABEL[recent.value.masteryStatus] || '未学习'
  return `${fromNow(recent.value.updatedAt)}更新 · ${label}`
})

onShow(async () => {
  await app.refresh()
  const list = await questionRepo.recent(1)
  recent.value = list[0] || null
})

function goSettings(): void {
  uni.navigateTo({ url: '/pages/profile/settings' })
}

function goLibrary(): void {
  uni.reLaunch({ url: '/pages/library/index' })
}

function goCapture(key: string): void {
  if (key === 'manual') {
    uni.navigateTo({ url: '/pages/question/edit' })
    return
  }
  const mode = key === 'paste' ? 'text' : 'image'
  uni.navigateTo({ url: `/pages/capture/index?mode=${mode}` })
}

function openDetail(id: string): void {
  uni.navigateTo({ url: `/pages/question/detail?id=${id}` })
}
</script>

<style scoped>
.topbar {
  height: 88rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  padding-right: 30rpx;
}

.gear {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-wrap {
  position: relative;
  width: 132rpx;
  height: 132rpx;
  margin: 6rpx auto 0;
}

.logo-spark {
  position: absolute;
  right: -16rpx;
  bottom: 2rpx;
}

.app-title {
  display: block;
  margin-top: 10rpx;
  text-align: center;
  font-size: 52rpx;
  font-weight: 700;
  color: #171a2c;
  letter-spacing: 2rpx;
}

.app-sub {
  display: block;
  margin-top: 14rpx;
  text-align: center;
  font-size: 25rpx;
  color: #9aa0b4;
}

/* ---------- AI 横幅 ---------- */
.banner {
  position: relative;
  height: 286rpx;
  margin: 30rpx 32rpx 0;
  border-radius: 36rpx;
  /* 设计稿 banner 主色量化后落在 #c8c8f8 一带，比早先那版淡紫要浓一档；
     右侧留白靠光斑提亮，不靠整体淡化 */
  background-image: linear-gradient(118deg, #c9c5fa 0%, #dcd8fd 44%, #ebe9fe 72%, #d3cffb 100%);
  overflow: hidden;
}

/* 模糊光斑：用径向渐变模拟设计稿里的 bokeh */
.bokeh {
  position: absolute;
  border-radius: 50%;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0));
}

.bokeh--1 {
  width: 200rpx;
  height: 200rpx;
  left: -40rpx;
  top: -50rpx;
}

.bokeh--2 {
  width: 240rpx;
  height: 240rpx;
  right: -70rpx;
  bottom: -80rpx;
  opacity: 0.75;
}

.bokeh--3 {
  width: 120rpx;
  height: 120rpx;
  left: 210rpx;
  bottom: -46rpx;
  opacity: 0.6;
}

/* 倾斜的白纸：扫描角标用四个 border 拼 */
/* 纸后面还有一层浅紫的「扫描框」背板（设计稿里露在上/右侧），少了它画面会单薄 */
.paper-back {
  position: absolute;
  left: 62rpx;
  top: 32rpx;
  width: 158rpx;
  height: 186rpx;
  border-radius: 16rpx;
  background-color: rgba(255, 255, 255, 0.4);
  transform: rotate(-2deg);
}

.paper {
  position: absolute;
  left: 46rpx;
  top: 50rpx;
  width: 158rpx;
  height: 186rpx;
  border-radius: 14rpx;
  background-color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14rpx 34rpx rgba(86, 74, 200, 0.16);
  transform: rotate(-11deg);
  padding: 34rpx 20rpx 20rpx;
}

.scan-corner {
  position: absolute;
  width: 20rpx;
  height: 20rpx;
  border: 3rpx solid #5b50f5;
}

.scan-corner--tl {
  left: 14rpx;
  top: 12rpx;
  border-right: 0;
  border-bottom: 0;
  border-radius: 4rpx 0 0 0;
}

.scan-corner--tr {
  right: 14rpx;
  top: 12rpx;
  border-left: 0;
  border-bottom: 0;
  border-radius: 0 4rpx 0 0;
}

.scan-corner--bl {
  left: 14rpx;
  bottom: 12rpx;
  border-right: 0;
  border-top: 0;
  border-radius: 0 0 0 4rpx;
}

.scan-corner--br {
  right: 14rpx;
  bottom: 12rpx;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 4rpx 0;
}

.paper-line {
  height: 9rpx;
  border-radius: 5rpx;
  background-color: #eceaf8;
  margin-bottom: 17rpx;
}

.paper-line--short {
  width: 52rpx;
  background-color: #d8d2fb;
}

.paper-line--mid {
  width: 84rpx;
}

.banner-ai {
  position: absolute;
  left: 172rpx;
  top: 142rpx;
  width: 78rpx;
  height: 78rpx;
  border-radius: 39rpx;
  background-image: linear-gradient(150deg, #4f8bf7, #5b50f5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(70, 62, 190, 0.28);
}

.banner-ai-text {
  font-size: 27rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
}

/*
 * 设计稿的标语是手写体。不引外部字体（包体积 + 小程序不支持 @font-face 远程加载），
 * 用「楷体优先 + 倾斜 + 手绘弧线」近似；iOS 有 Kaiti SC，Android 回落系统字，
 * 观感差异只在字形，不影响信息传达。
 */
.slogan {
  position: absolute;
  right: 24rpx;
  top: 84rpx;
  width: 300rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.slogan-text {
  font-family: 'Kaiti SC', STKaiti, KaiTi, 'Songti SC', serif;
  font-size: 36rpx;
  font-style: italic;
  font-weight: 700;
  color: #5b50f5;
  letter-spacing: 2rpx;
  transform: rotate(-5deg) skewX(-8deg);
}

/* 手绘弧线：一段上翘的细曲线 */
.slogan-arc {
  width: 268rpx;
  height: 12rpx;
  margin-top: 10rpx;
  border-bottom: 3rpx solid #6a60ee;
  border-radius: 0 0 70% 30%;
  transform: rotate(-4deg);
  opacity: 0.85;
}

/* ---------- 四个入口 ---------- */
.grid {
  margin: 24rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
}

.entry {
  width: 331rpx;
  height: 182rpx;
  margin-bottom: 20rpx;
  border-radius: 32rpx;
  background-color: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(70, 66, 140, 0.06);
  padding: 24rpx 20rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.entry-title {
  display: block;
  margin-top: 14rpx;
  font-size: 29rpx;
  font-weight: 700;
  color: #171a2c;
}

.entry-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  line-height: 1.5;
  color: #8a8fa3;
  text-align: center;
}

/* ---------- 区块标题 ---------- */
.section {
  margin: 22rpx 32rpx 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section--gap {
  margin-top: 34rpx;
}

.section-more {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.more-text {
  font-size: 23rpx;
  color: #8a8fa3;
  margin-right: 4rpx;
}

/* ---------- 四项统计（设计稿在一个浅色卡里） ---------- */
/* 设计稿是 4 张独立的小卡片（彼此留缝），不是一条通栏 */
.stats {
  margin: 18rpx 32rpx 0;
  display: flex;
  flex-direction: row;
}

.stat {
  flex: 1;
  padding: 24rpx 0 22rpx;
  border-radius: 22rpx;
  background-color: #ffffff;
  border: 1rpx solid #f1f1f9;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat + .stat {
  margin-left: 10rpx;
}

.stat-value {
  font-size: 42rpx;
  font-weight: 700;
  color: #171a2c;
  line-height: 1.15;
}

.stat-label {
  margin-top: 10rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}

/* ---------- 最近学习 ---------- */
.recent {
  margin: 18rpx 32rpx 0;
  height: 126rpx;
  border-radius: 28rpx;
  background-color: #fbfbfe;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 26rpx;
}

.recent-badge {
  width: 74rpx;
  height: 74rpx;
  border-radius: 20rpx;
  background-color: #5b50f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recent--empty .recent-badge {
  background-color: #eaebfd;
}

.recent-badge-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5rpx;
}

.recent-main {
  flex: 1;
  margin-left: 22rpx;
  overflow: hidden;
}

.recent-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #171a2c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #8a8fa3;
}
</style>

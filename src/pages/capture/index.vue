<template>
  <view class="screen">
    <NavBar title="识别面试题" />

    <view class="seg">
      <view class="seg-pill" :style="mode === 'image' ? 'left:8rpx' : 'left:358rpx'"></view>
      <view class="seg-item" @tap="switchMode('image')">
        <text class="seg-text" :class="{ on: mode === 'image' }">图片识别</text>
      </view>
      <view class="seg-item" @tap="switchMode('text')">
        <text class="seg-text" :class="{ on: mode === 'text' }">粘贴文本</text>
      </view>
    </view>

    <!-- OCR 进度：只在真的跑起来或跑完后显示，避免静态占位 -->
    <view v-if="progressVisible" class="progress card">
      <OcrProgress :steps="steps" />
    </view>

    <!-- 图片模式 -->
    <block v-if="mode === 'image'">
      <view v-if="!images.length" class="upload" @tap="pickImages">
        <AppIcon name="scanImage" :size="88" color="#5B50F5" />
        <text class="upload-title">点击上传图片</text>
        <text class="upload-title">或从相册选择</text>
        <text class="upload-hint">支持多张图片，或直接拍照</text>
      </view>

      <view v-else class="upload upload--filled">
        <scroll-view scroll-x class="thumbs">
          <view class="thumbs-inner">
            <view v-for="(p, i) in images" :key="p" class="thumb">
              <image :src="p" mode="aspectFill" class="thumb-img" />
              <view class="thumb-del" @tap.stop="removeImage(i)">
                <AppIcon name="close" :size="20" color="#FFFFFF" />
              </view>
            </view>
            <view class="thumb thumb--add" @tap="pickImages">
              <AppIcon name="plus" :size="34" color="#8A8FA3" />
            </view>
          </view>
        </scroll-view>
        <text class="upload-hint">已选 {{ images.length }} 张，点击图片右上角可删除</text>
      </view>

      <view class="block-title">
        <text class="t-title">识别示例</text>
      </view>

      <view class="sample" @tap="loadSample">
        <view class="sample-photo">
          <view class="sample-paper">
            <view class="sample-head"></view>
            <view class="sample-cols">
              <view class="sample-col">
                <view class="sample-line sample-line--w1"></view>
                <view class="sample-line sample-line--w3"></view>
                <view class="sample-line sample-line--w2"></view>
                <view class="sample-line sample-line--w3"></view>
                <view class="sample-line sample-line--w2"></view>
              </view>
              <view class="sample-col">
                <view class="sample-line sample-line--w2"></view>
                <view class="sample-line sample-line--w3"></view>
                <view class="sample-line sample-line--w1"></view>
                <view class="sample-line sample-line--w3"></view>
                <view class="sample-line sample-line--w2"></view>
              </view>
            </view>
          </view>
        </view>
        <AppIcon name="chevronRight" :size="34" color="#C3C7D6" />
      </view>

      <view v-if="!ocrReady" class="notice">
        <AppIcon name="info" :size="30" color="#F59E0B" />
        <text class="notice-text">{{ ocrNotice }}</text>
      </view>
    </block>

    <!-- 文本模式 -->
    <block v-else>
      <view class="paste-box">
        <textarea
          v-model="text"
          class="paste-input"
          placeholder="把面试题整段粘贴到这里，支持带编号的多题"
          placeholder-class="paste-ph"
          :maxlength="-1"
          auto-height
        />
        <view class="paste-foot">
          <text class="paste-count">{{ text.length }} 字</text>
          <view class="paste-actions">
            <view class="mini-btn" @tap="pasteFromClipboard">
              <AppIcon name="copy" :size="24" color="#5B50F5" />
              <text class="mini-btn-text">读剪贴板</text>
            </view>
            <view v-if="text" class="mini-btn" @tap="text = ''">
              <AppIcon name="close" :size="24" color="#8A8FA3" />
              <text class="mini-btn-text mini-btn-text--gray">清空</text>
            </view>
          </view>
        </view>
      </view>
      <text class="tip">支持「1. 2. 3.」「第1题」「问：」等编号；「解析：」会自动归入参考答案。</text>
    </block>

    <view class="cta-wrap">
      <view class="btn-primary tap" @tap="start">
        <text>{{ mode === 'image' ? '开始识别' : '开始拆题' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import OcrProgress from '@/components/OcrProgress.vue'
import { useSettingsStore } from '@/stores/settings'
import { ocrService } from '@/services/ocr'
import { splitQuestions } from '@/services/question/segmenter'
import { errorMessage } from '@/adapters/network'
import type { OcrStep } from '@/types/ocr'

/**
 * 题目录入：拍照/相册多图 + 粘贴文本。
 *
 * 图片这一路的关键点：
 * 1. **逐张识别**（PRD 验收要求），每张的原始文本单独留在 assets 里，不合并成糊掉的一大段；
 * 2. 本地不可用时如实告知，并给出「粘贴文本 / 手动录入」的替代路径，不假装成功；
 * 3. 识别过程中的每一步都显示出来（OcrProgress），特别是降级到云端时用户要知道图片在上传。
 */
const SAMPLE = `1. 请介绍一下你对前端工程化的理解？
解析：前端工程化主要包括模块化、自动化构建、代码规范、持续集成等，能够提升开发效率和代码质量。

2. 你如何看待前端框架的选择？
解析：不同项目有不同的技术选型，通常会考虑团队技术栈、项目需求、生态支持等因素。

3. 说说你对性能优化的理解？
解析：性能优化包括减少资源加载、优化渲染、使用缓存等方式，提升用户体验。`

const settingsStore = useSettingsStore()
const settings = settingsStore.state

const mode = ref<'image' | 'text'>('image')
const images = ref<string[]>([])
const text = ref('')
const running = ref(false)
const steps = reactive<OcrStep[]>([
  { key: 'read', label: '读取图片', status: 'wait' },
  { key: 'ocr', label: '文字识别', status: 'wait' },
  { key: 'split', label: '拆分题目', status: 'wait' }
])

const caps = computed(() => ocrService.capabilities(settings))
const ocrReady = computed(() => caps.value.local.supported)
const progressVisible = computed(() => running.value || steps.some((s) => s.status !== 'wait'))
const ocrNotice = computed(() => {
  const local = caps.value.local
  const cloud = caps.value.cloud
  if (!local.supported && !cloud.supported) {
    // 把「为什么不可用」原样透出去，比一句笼统的「暂不支持」有用
    return `${local.reason || '当前环境没有本地 OCR'}，也没配置云端代理。可以先用「粘贴文本」或手动录入。`
  }
  if (!local.supported && cloud.supported) {
    return '本地 OCR 不可用，将走云端识别：点击开始前会先确认是否上传图片。'
  }
  return '本地识别可用；图片不会离开设备。'
})

onLoad((query?: Record<string, string>) => {
  if (query && query.mode === 'text') mode.value = 'text'
})

function switchMode(m: 'image' | 'text'): void {
  if (running.value) return
  mode.value = m
}

function pickImages(): void {
  uni.chooseImage({
    count: 9,
    sizeType: ['original', 'compressed'],
    sourceType: ['camera', 'album'],
    success: (res) => {
      const paths = (res.tempFilePaths || []) as string[]
      images.value = images.value.concat(paths).slice(0, 9)
    }
  })
}

function removeImage(i: number): void {
  images.value.splice(i, 1)
}

function resetSteps(): void {
  steps.forEach((s) => {
    s.status = 'wait'
    s.detail = ''
  })
}

function setStep(key: string, status: OcrStep['status'], detail = ''): void {
  const step = steps.find((s) => s.key === key)
  if (!step) return
  step.status = status
  if (detail) step.detail = detail
}

function loadSample(): void {
  text.value = SAMPLE
  mode.value = 'text'
  uni.showToast({ title: '已填入示例文本', icon: 'none' })
}

function pasteFromClipboard(): void {
  uni.getClipboardData({
    success: (res) => {
      if (res.data) text.value = text.value ? `${text.value}\n\n${res.data}` : res.data
      else uni.showToast({ title: '剪贴板没有文本', icon: 'none' })
    },
    fail: () => uni.showToast({ title: '无法读取剪贴板', icon: 'none' })
  })
}

function goReview(payload: {
  rawText: string
  editedText: string
  ocrEngine: string
  sourceType: 'image' | 'text'
  assets: { path: string; rawText: string; engine: string }[]
}): void {
  uni.setStorageSync('capture_draft', payload)
  uni.navigateTo({ url: '/pages/capture/ocr-review' })
}

/** 图片路径：逐张识别 → 拼成一份可校对的文本 */
async function startImage(): Promise<void> {
  if (!images.value.length) {
    uni.showToast({ title: '请先选择图片', icon: 'none' })
    return
  }

  const localOk = caps.value.local.supported
  const cloudOk = caps.value.cloud.supported
  if (!localOk && !cloudOk) {
    uni.showModal({
      title: '识别暂不可用',
      content: `${caps.value.local.reason || '当前环境没有本地 OCR'}，也没有配置云端代理。可以先切到「粘贴文本」录入，或直接手动添加题目。`,
      confirmText: '去粘贴',
      cancelText: '知道了',
      success: (r) => {
        if (r.confirm) mode.value = 'text'
      }
    })
    return
  }

  running.value = true
  resetSteps()
  setStep('read', 'doing')

  const assets: { path: string; rawText: string; engine: string }[] = []
  const texts: string[] = []
  let lastEngine = 'manual'

  try {
    for (let i = 0; i < images.value.length; i += 1) {
      const path = images.value[i]
      setStep('read', 'doing', `第 ${i + 1}/${images.value.length} 张`)
      setStep('ocr', 'doing', i === 0 ? '本地优先' : `第 ${i + 1} 张`)
      const result = await ocrService.recognize(path, { settings: settings })
      lastEngine = result.engine
      assets.push({ path, rawText: result.text, engine: result.engine })
      texts.push(`【第 ${i + 1} 张】\n${result.text}`)
      setStep('ocr', 'done', `${result.engine} · ${result.elapsedMs}ms`)
      setStep('read', 'done')
    }

    const merged = texts.join('\n\n')
    setStep('split', 'doing')
    const items = splitQuestions(merged)
    setStep('split', items.length ? 'done' : 'fail', `拆出 ${items.length} 题`)

    if (!items.length) {
      uni.showModal({
        title: '没有拆出题目',
        content: '识别文本可能是空的或不完整。可以进校对页手动调整，或换一张更清晰的图片。',
        confirmText: '去校对',
        success: (r) => {
          if (r.confirm) {
            goReview({
              rawText: merged,
              editedText: merged,
              ocrEngine: lastEngine,
              sourceType: 'image',
              assets
            })
          }
        }
      })
      return
    }

    goReview({ rawText: merged, editedText: merged, ocrEngine: lastEngine, sourceType: 'image', assets })
  } catch (err) {
    setStep('ocr', 'fail', errorMessage(err))
    uni.showModal({ title: '识别未完成', content: errorMessage(err), showCancel: false })
  } finally {
    running.value = false
  }
}

function startText(): void {
  if (!text.value.trim()) {
    uni.showToast({ title: '请先粘贴文本', icon: 'none' })
    return
  }
  const items = splitQuestions(text.value)
  if (!items.length) {
    uni.showToast({ title: '没有解析出题目', icon: 'none' })
    return
  }
  goReview({
    rawText: text.value,
    editedText: text.value,
    ocrEngine: 'manual',
    sourceType: 'text',
    assets: []
  })
}

function start(): void {
  if (running.value) return
  if (mode.value === 'image') void startImage()
  else startText()
}
</script>

<style scoped>
.progress {
  margin: 24rpx 32rpx 0;
  padding: 20rpx 28rpx;
}

.seg {
  position: relative;
  height: 88rpx;
  margin: 20rpx 32rpx 0;
  border-radius: 27rpx;
  background-color: #f2f2f8;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.seg-pill {
  position: absolute;
  top: 8rpx;
  width: 330rpx;
  height: 72rpx;
  border-radius: 21rpx;
  background-color: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(42, 45, 85, 0.08);
  transition: left 0.2s ease;
}

.seg-item {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seg-text {
  font-size: 26rpx;
  color: #8a8fa3;
}

.seg-text.on {
  font-weight: 700;
  color: #5b50f5;
}

.upload {
  margin: 24rpx 32rpx 0;
  height: 484rpx;
  border-radius: 32rpx;
  background-color: #fbfbfe;
  border: 2rpx dashed #dcdcec;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload--filled {
  height: auto;
  padding: 28rpx;
  align-items: stretch;
  justify-content: flex-start;
}

.thumbs {
  width: 100%;
  white-space: nowrap;
}

.thumbs-inner {
  display: flex;
  flex-direction: row;
}

.thumb {
  position: relative;
  width: 180rpx;
  height: 220rpx;
  border-radius: 16rpx;
  overflow: hidden;
  margin-right: 16rpx;
  background-color: #f2f2f8;
}

.thumb-img {
  width: 180rpx;
  height: 220rpx;
}

.thumb--add {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed #dcdcea;
  background-color: #ffffff;
}

.thumb-del {
  position: absolute;
  right: 6rpx;
  top: 6rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background-color: rgba(31, 34, 51, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-title {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #171a2c;
}

.upload-hint {
  display: block;
  margin-top: 18rpx;
  font-size: 21rpx;
  color: #a9aec2;
  text-align: center;
}

.block-title {
  margin: 34rpx 32rpx 0;
}

.sample {
  margin: 20rpx 32rpx 0;
  height: 292rpx;
  border-radius: 27rpx;
  /* 页面底是 #f5f5fe，示例卡必须再深一档才看得出「卡片」这个层级 */
  background-color: #ecebfa;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 22rpx;
}

/*
 * 「识别示例」的缩略图：用 CSS 画一张拍歪了的纸页照片。
 * 不引位图（省包体积、也不需要为一张示意图生成素材），
 * 靠暖白纸色 + 双栏模糊字块 + 轻微旋转还原照片观感。
 */
.sample-photo {
  flex: 1;
  height: 244rpx;
  border-radius: 10rpx;
  background-image: linear-gradient(135deg, #f7f1e4, #efe7d6);
  box-shadow: 0 10rpx 24rpx rgba(80, 74, 60, 0.16);
  padding: 18rpx;
  overflow: hidden;
}

.sample-paper {
  height: 100%;
  border-radius: 4rpx;
  background-color: #fdfaf1;
  transform: rotate(-1.6deg);
  padding: 12rpx 14rpx;
  filter: blur(0.4rpx);
}

.sample-head {
  width: 58%;
  height: 12rpx;
  border-radius: 3rpx;
  background-color: #cfc8b4;
  margin-bottom: 12rpx;
}

.sample-cols {
  display: flex;
  flex-direction: row;
}

.sample-col {
  flex: 1;
}

.sample-col:first-child {
  margin-right: 16rpx;
}

.sample-line {
  height: 9rpx;
  border-radius: 3rpx;
  background-color: #e2dbc8;
  margin-bottom: 11rpx;
}

.sample-line--w1 {
  width: 62%;
}

.sample-line--w2 {
  width: 82%;
}

.sample-line--w3 {
  width: 100%;
}

.sample-line--short {
  width: 300rpx;
}

.notice {
  margin: 24rpx 32rpx 0;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background-color: #fff8ec;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.notice-text {
  flex: 1;
  margin-left: 14rpx;
  font-size: 21rpx;
  line-height: 1.6;
  color: #a06a12;
}

.paste-box {
  margin: 24rpx 32rpx 0;
  border-radius: 28rpx;
  background-color: #f8f8fd;
  padding: 28rpx;
}

.paste-input {
  width: 100%;
  min-height: 520rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #1f2233;
}

.paste-ph {
  color: #a9aec2;
}

.paste-foot {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.paste-count {
  font-size: 21rpx;
  color: #a9aec2;
}

.paste-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.mini-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 52rpx;
  padding: 0 20rpx;
  border-radius: 26rpx;
  background-color: #ffffff;
  margin-left: 14rpx;
}

.mini-btn-text {
  margin-left: 8rpx;
  font-size: 21rpx;
  color: #5b50f5;
}

.mini-btn-text--gray {
  color: #8a8fa3;
}

.tip {
  display: block;
  margin: 20rpx 40rpx 0;
  font-size: 21rpx;
  line-height: 1.6;
  color: #a9aec2;
}

.cta-wrap {
  margin: 40rpx 32rpx 0;
}
</style>

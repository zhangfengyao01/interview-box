/**
 * uni-app 表单事件在 Vue3 + TS 下的类型收敛。
 *
 * 问题：`@dcloudio/types` 里 uni 事件是 `BaseEvent`（`detail: any`），
 * 而 vue-tsc 校验模板上的原生标签时用的是 DOM 的 `InputEvent` / `Event`
 * （`detail` 是 number），两边对不上，写 `(e: { detail: { value: string } })`
 * 会报 TS2345「Types of property 'detail' are incompatible」。
 *
 * 解法：处理函数统一声明成 `(e: Event)`——它是 `InputEvent` 的父类型，
 * 参数逆变下可赋值；取值逻辑收敛到这两个函数里，模板侧不需要任何 as / 断言。
 */

type ValueDetail = { detail?: { value?: unknown } }

/** input / textarea 的当前文本，取不到时返回空串 */
export function eventValue(e: Event): string {
  const value = (e as unknown as ValueDetail).detail?.value
  if (value === undefined || value === null) return ''
  return String(value)
}

/** switch 的开关值 */
export function eventChecked(e: Event): boolean {
  return Boolean((e as unknown as ValueDetail).detail?.value)
}

/** picker 的选中下标，非法值回落 0 */
export function eventIndex(e: Event): number {
  const n = Number((e as unknown as ValueDetail).detail?.value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

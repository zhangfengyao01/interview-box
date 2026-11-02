import { db } from '@/adapters/database'
import { mapAsset, toRow } from '@/adapters/database/mappers'
import type { SourceAsset } from '@/types/models'
import { uuid } from '@/utils/id'

/**
 * 来源资源（source_assets + question_sources）。
 *
 * 这层存在的原因（PRD §4 特别强调）：一张图里可能拆出好几道题，
 * 如果把图片路径直接塞到题目字段上，多图/多题/来源追溯都会崩。
 * 所以「图/原始文本」是一等实体，题目与它是多对多。
 */
export const sourceRepo = {
  async save(input: {
    id?: string
    sourceType: SourceAsset['sourceType']
    filePath?: string | null
    rawText: string
    editedText?: string
    ocrEngine?: string
  }): Promise<SourceAsset> {
    const asset: SourceAsset = {
      id: input.id || uuid(),
      sourceType: input.sourceType,
      filePath: input.filePath ?? null,
      rawText: input.rawText || '',
      editedText: input.editedText || '',
      ocrEngine: input.ocrEngine || 'manual',
      createdAt: Date.now()
    }
    await db().insert('source_assets', toRow('source_assets', asset))
    return asset
  },

  async get(id: string): Promise<SourceAsset | null> {
    const row = await db().first('source_assets', { eq: { id } })
    return row ? mapAsset(row) : null
  },

  /** 建立「题目 ← 来源」关系；同一批题共用一张图时调用一次 */
  async link(assetId: string, questionIds: string[]): Promise<void> {
    if (!questionIds.length) return
    await db().transaction(async (tx) => {
      for (const questionId of questionIds) {
        await tx.insert('question_sources', toRow('question_sources', { questionId, sourceAssetId: assetId }))
      }
    })
  },

  async ofQuestion(questionId: string): Promise<SourceAsset[]> {
    const links = await db().all('question_sources', { eq: { question_id: questionId } })
    const ids = links.map((l) => String(l.source_asset_id))
    if (!ids.length) return []
    const rows = await db().all('source_assets', { in: { id: ids } })
    return rows.map(mapAsset)
  },

  /** 一道来源拆出了哪些题（回溯用） */
  async questionsOf(assetId: string): Promise<string[]> {
    const links = await db().all('question_sources', { eq: { source_asset_id: assetId } })
    return links.map((l) => String(l.question_id))
  }
}

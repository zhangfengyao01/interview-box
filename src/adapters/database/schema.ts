/**
 * 数据库结构定义与版本化迁移（PRD §8.2 / §8.3）
 *
 * 关键约束：**不能在启动时无条件 CREATE TABLE**。
 * 「打开数据库 → 读 schema_migrations → 只执行未应用的版本 → 写回版本号」，
 * 升级前先整库备份一次（见 `backupBeforeMigrate`），避免加字段毁数据。
 */

export const DB_NAME = 'interview_box'
export const DB_PATH = '_doc/interview_box.db'

/** schema_migrations 只存「执行过哪些版本」，本身也要建 */
const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`

export interface Migration {
  version: number
  name: string
  statements: string[]
}

/**
 * v1：MVP 全量结构（7 张业务表 + 索引）
 * 与 PRD §8.2 的建表语句逐字对齐，未做任何「顺手加字段」。
 */
const V1: Migration = {
  version: 1,
  name: 'init_schema',
  statements: [
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      reference_answer TEXT NOT NULL DEFAULT '',
      my_answer TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      category_id TEXT,
      difficulty INTEGER NOT NULL DEFAULT 2,
      mastery_status TEXT NOT NULL DEFAULT 'new',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      answer_origin TEXT NOT NULL DEFAULT 'manual',
      source_company TEXT NOT NULL DEFAULT '',
      source_role TEXT NOT NULL DEFAULT '',
      source_round TEXT NOT NULL DEFAULT '',
      source_date TEXT,
      next_review_at INTEGER,
      review_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);`,
    `CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(mastery_status);`,
    `CREATE INDEX IF NOT EXISTS idx_questions_updated ON questions(updated_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_questions_next_review ON questions(next_review_at);`,
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8B7CFF',
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS question_tags (
      question_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (question_id, tag_id),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      file_path TEXT,
      raw_text TEXT NOT NULL DEFAULT '',
      edited_text TEXT NOT NULL DEFAULT '',
      ocr_engine TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS question_sources (
      question_id TEXT NOT NULL,
      source_asset_id TEXT NOT NULL,
      PRIMARY KEY (question_id, source_asset_id),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (source_asset_id) REFERENCES source_assets(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      result TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      next_review_at INTEGER,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_review_logs_question ON review_logs(question_id);`,
    `CREATE INDEX IF NOT EXISTS idx_review_logs_time ON review_logs(reviewed_at DESC);`
  ]
}

/**
 * 迁移清单。新增结构时**只追加**，不修改已发布的版本。
 * 例：v2 加「收藏夹分组」→ 新增 { version: 2, name: 'add_collections', statements: [...] }
 */
export const MIGRATIONS: Migration[] = [V1]

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => (m.version > max ? m.version : max), 0)

export { BOOTSTRAP }

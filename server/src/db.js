import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = {
  query: (sql, params) => pool.query(sql, params),
  // 取得 client 以便手動管理 transaction
  connect: () => pool.connect(),
};

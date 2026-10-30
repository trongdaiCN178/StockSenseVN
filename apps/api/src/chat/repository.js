import { ApiError } from '../errors.js';

export function createChatRepository(pool) {
  return {
    async assertSession(userId, sessionId) {
      const result = await pool.query('SELECT 1 FROM chat_sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
      if (!result.rowCount) throw new ApiError(404, 'CHAT_SESSION_NOT_FOUND', 'Chat session was not found.');
    },
    async listSessions(userId) {
      const { rows } = await pool.query(`SELECT s.id::text, s.title, s.created_at, s.updated_at,
        count(m.id)::integer AS message_count
        FROM chat_sessions s LEFT JOIN chat_messages m ON m.session_id=s.id AND m.user_id=s.user_id
        WHERE s.user_id=$1 GROUP BY s.id ORDER BY s.updated_at DESC, s.id DESC`, [userId]);
      return { items: rows };
    },
    async createSession(userId, title = 'Cuộc trò chuyện mới') {
      const { rows } = await pool.query(`INSERT INTO chat_sessions(user_id,title) VALUES ($1,$2)
        RETURNING id::text,title,created_at,updated_at`, [userId, title]);
      return rows[0];
    },
    async listMessages(userId, sessionId, limit = 100) {
      await this.assertSession(userId, sessionId);
      const { rows } = await pool.query(`SELECT id::text,role,content,status,citations,created_at FROM chat_messages
        WHERE session_id=$1 AND user_id=$2 ORDER BY created_at,id LIMIT $3`, [sessionId, userId, limit]);
      return { items: rows };
    },
    // FR-M12-07: store the question and the answer together with how the answer was produced.
    async addExchange(userId, sessionId, question, reply) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: owned } = await client.query('SELECT title FROM chat_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE', [sessionId, userId]);
        if (!owned[0]) throw new ApiError(404, 'CHAT_SESSION_NOT_FOUND', 'Chat session was not found.');
        await client.query(`INSERT INTO chat_messages(session_id,user_id,role,content,status,engine,intent,filter_result,personal)
          VALUES ($1,$2,'user',$3,'complete',$4,$5,$6,$7)`,
        [sessionId, userId, question, reply.engine, reply.intent, reply.filterResult, reply.personal]);
        const { rows } = await client.query(`INSERT INTO chat_messages(session_id,user_id,role,content,status,citations,engine,intent,filter_result,personal)
          VALUES ($1,$2,'assistant',$3,$4,$5::jsonb,$6,$7,$8,$9)
          RETURNING id::text,role,content,status,citations,created_at`,
        [sessionId, userId, reply.content, reply.status, JSON.stringify(reply.citations), reply.engine, reply.intent, reply.filterResult, reply.personal]);
        // The first question names a session that still has the default title.
        const title = owned[0].title === 'Cuộc trò chuyện mới' ? question.slice(0, 80) : owned[0].title;
        await client.query('UPDATE chat_sessions SET updated_at=now(), title=$3 WHERE id=$1 AND user_id=$2', [sessionId, userId, title]);
        await client.query('COMMIT');
        return { message: rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    // Staff view of the chat log: personal questions and their answers are masked.
    async listLog({ limit = 100, status = '' } = {}) {
      const { rows } = await pool.query(`SELECT m.id::text, m.created_at, m.role, m.status, m.intent, m.engine, m.filter_result,
          m.personal, m.content, m.session_id::text, u.email, u.role AS user_role
        FROM chat_messages m JOIN users u ON u.id = m.user_id
        WHERE ($2 = '' OR m.status = $2)
        ORDER BY m.created_at DESC, m.id DESC LIMIT $1`, [limit, status]);
      return { items: rows.map((row) => ({
        id: row.id, created_at: row.created_at, role: row.role, status: row.status, intent: row.intent,
        engine: row.engine, filter_result: row.filter_result, personal: row.personal, session_id: row.session_id,
        user: maskEmail(row.email), user_role: row.user_role,
        content: row.personal ? '[Nội dung liên quan dữ liệu cá nhân đã được che]' : row.content,
      })) };
    },
    async deleteSession(userId, sessionId) {
      const { rowCount } = await pool.query('DELETE FROM chat_sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
      if (!rowCount) throw new ApiError(404, 'CHAT_SESSION_NOT_FOUND', 'Chat session was not found.');
      return { id: sessionId, removed: true };
    },
  };
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 2)}***@${domain ?? ''}`;
}

export function validateChatSession(input) {
  const title = input?.title === undefined ? 'Cuộc trò chuyện mới' : input.title;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Chat title must contain 1 to 120 characters.');
  }
  return title.trim();
}

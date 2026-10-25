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
    async deleteSession(userId, sessionId) {
      const { rowCount } = await pool.query('DELETE FROM chat_sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
      if (!rowCount) throw new ApiError(404, 'CHAT_SESSION_NOT_FOUND', 'Chat session was not found.');
      return { id: sessionId, removed: true };
    },
  };
}

export function validateChatSession(input) {
  const title = input?.title === undefined ? 'Cuộc trò chuyện mới' : input.title;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Chat title must contain 1 to 120 characters.');
  }
  return title.trim();
}

// Thin D1 helper. D1 is SQLite, so we use ? placeholders.
//
// Usage:
//   const rows = await all(env, 'SELECT * FROM posts WHERE domain_id = ?', [id]);
//   const row  = await first(env, 'SELECT * FROM users WHERE email = ?', [e]);
//   await run(env, 'UPDATE posts SET is_read = 1 WHERE id = ?', [id]);

export async function all(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  const { results } = await stmt.all();
  return results || [];
}

export async function first(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  return await stmt.first();
}

export async function run(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  return await stmt.run();
}

// INSERT ... RETURNING * — D1 supports RETURNING since 2024.
export async function insertReturning(env, sql, params = []) {
  return first(env, sql, params);
}

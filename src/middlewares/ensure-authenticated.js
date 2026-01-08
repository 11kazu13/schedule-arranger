const { createMiddleware } = require('hono/factory');

// ページの閲覧にログイン（認証）を必須にするミドルウェア
function ensureAuthenticated() {
  return createMiddleware(async (c, next) => {
    const session = c.get('session');
    if (!session.user) {
      return redirect('/');
    }
    await next();
  });
}

module.exports = ensureAuthenticated;

const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { setCookie } = require('hono/cookie');

const app = new Hono();

app.get('/', (c) => {
  const from = c.req.query('from'); // 例：/login?from=/schedules/123
  if (from) {
    setCookie(c, 'loginFrom', from, { maxAge: 1000 * 60 * 7 }); // ログインが完了したら元のリンクに戻すために保存をする仕組み
  }
  return c.html(
    layout(
      c,
      'Login',
      html`
        <a href="/auth/github" class="btn btn-primary my-3">GitHub でログイン</a>
      `,
    ),
  );
});

module.exports = app;

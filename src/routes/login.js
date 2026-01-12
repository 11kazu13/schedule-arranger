const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { setCookie } = require('hono/cookie');

const app = new Hono();

app.get('/', (c) => {
  const from = c.req.query('from');
  if (from) {
    setCookie(c, 'loginFrom', from, { maxAge: 1000 * 60 * 7 });
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

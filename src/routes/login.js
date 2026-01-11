const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');

const app = new Hono();

app.get('/', (c) => {
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

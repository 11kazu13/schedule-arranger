// トップページ

const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();

function scheduleTable(schedules) {
  return html`
    <table>
      <tr>
        <th>予定名</th>
        <th>更新日時</th>
      </tr>
      ${schedules.map((schedule) => html`
        <tr>
        <th><a href="/schedules/${schedule.scheduleId}">${schedule.scheduleName}</a></th>
        <th>${schedule.updatedAt.toLocaleString()}</th>
      </tr>
      `)}
    </table>
  `
}

app.get('/', async (c) => {
  const { user } = c.get('session') ?? {};
  const schedules = user
    ? await prisma.schedule.findMany({
      where: {createdBy: user.id},
      orderBy: {updatedAt: 'desc'}
    })
    : [];

  return c.html(
    layout(
      c,
      '予定調整くん',
      html`
        <h1>どんな予定を作成する？</h1>
        ${user
          ? html`
            <div>
              <a href="/logout">${user.login}からログアウト</a>
            </div>
            <div>
              <a href="/schedules/new">予定を作成する</a>
            </div>
            ${schedules.length > 0
              ? html`
                <h3>予定一覧</h3>
                ${scheduleTable(schedules)}
              `
              : html`
                <p>まだ予定がないようだ...</p>
              `
            }
            `
          : html`
            <div>
              <a href="/login">ログイン</a>
            </div>
            `
        }
      `,
    ),
  );
});

module.exports = app;

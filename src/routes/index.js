// トップページ

const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const app = new Hono();

function scheduleTable(schedules) {
  return html`
    <table class="table">
      <tr>
        <th>予定名</th>
        <th>更新日時</th>
      </tr>
      ${schedules.map((schedule) => html`
        <tr>
        <th><a href="/schedules/${schedule.scheduleId}">${schedule.scheduleName}</a></th>
        <th>${schedule.formattedUpdatedAt}</th>
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

  schedules.forEach((schedule) => {
    schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });

  return c.html(
    layout(
      c,
      null,
      html`
        <div class="my-3">
          <div class="p-5 bg-light rounded-3">
            <h1 class="text-body">どんな予定を作成する？</h1>
            <p class="lead">
              - GitHubで認証できる、出欠管理アプリ -
            </p>
          </div>
        </div>
        ${user
          ? html`
            <div class="my-3">
              <a class="btn btn-primary" href="/schedules/new">予定を作る</a>
              <a
                class="btn btn-outline-primary ms-2"
                href="https://livemate-dpwlxwmjz-kazus-projects-7ab09b50.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                掲示板形式でイベントを募集したい方はこちら
              </a>
              ${schedules.length > 0
                ? html`
                  <h3 class="my-3">あなたの作った予定一覧</h3>
                  ${scheduleTable(schedules)}
                `
                : ''}
            </div>
            `
          : ''
        }
      `,
    ),
  );
});

module.exports = app;

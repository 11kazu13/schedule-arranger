// 小さい地図

const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();

app.use(ensureAuthenticated());

app.get('/new', (c) => {
  return c.html(
    layout(
      c,
      "予定の作成",
      html`
        <form method="post" action="/schedules">
          <div>
            <h5>予定名</h5>
            <input type="text" name="scheduleName" />
          </div>
          <div>
            <h5>メモ</h5>
            <textarea name="memo"></textarea>
          </div>
          <div>
            <h5>候補日程（改行して複数入力してください）</h5>
            <textarea name="candidates"></textarea>
          </div>
          <button type="submit">作成する</button>
        </form>
      `
    )
  );
});

app.post('/', async (c) => {
  const { user } = c.get('session');
  const body = await c.req.parseBody();

  // 予定を登録
  const { scheduleId } = await prisma.schedule.create({
    data: {
      scheduleId: randomUUID(),
      scheduleName: body.scheduleName.slice(0, 255) || "（名称未設定）",
      memo: body.memo,
      createdBy: user.id,
      updatedAt: new Date()
    }
  });

  // 候補日程を登録
  const candidateNames = body.candidates.split('\n').map((s) => s.trim()).filter((s) => s !== "");
  const candidates = candidateNames.map((candidateName) => ({
    candidateName,
    scheduleId
  }));
  await prisma.candidate.createMany({data: candidates});

  // 作成した予定のページにリダイレクト
  return c.redirect('/schedules/' + scheduleId);
});


module.exports = app;

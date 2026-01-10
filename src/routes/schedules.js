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

app.get('/:scheduleId', async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.param('scheduleId') },
    include: {
      user: {
        select: {
          userId: true,
          username: true
        }
      }
    }
  });

  if (!schedule) {
    return c.notFound();
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      scheduleId: schedule.scheduleId
    },
    orderBy: {
      candidateId: 'asc'
    }
  });

  // DBからその予定に対する全ての出欠を取得する
  const availabilities = await prisma.availability.findMany({
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' },
    include: {
      user: {
        select: {
          userId: true,
          username: true
        }
      }
    }
  });
  // 出欠 MapMap を作成する
  const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, value: availability)
  availabilities.forEach((a) => {
    const map = availabilityMapMap.get(a.user.userId) || new Map();
    map.set(a.candidateId, a.availability);
    availabilityMapMap.set(a.user.userId, map);
  });

  // 閲覧ユーザーと出欠に紐づくユーザーからユーザーMapを作成する
  const userMap = new Map(); // key: userId, value:User
  userMap.set(parseInt(user.id, 10), {
    isSelf: true,
    userId: parseInt(user.id, 10),
    username: user.username
  });
  availabilities.forEach((a) => {
    userMap.set(a.user.userId, {
      isSelf: a.user.userId === parseInt(user.id, 10),
      userId: a.user.userId,
      username: a.user.username
    });
  });

  // 全ユーザー、全候補でループしてそれぞれの出欠の値がない場合には欠席をセットする
  const users = Array.from(userMap.values());

  users.forEach((u) => {
    candidates.forEach((c) => {
      const map = availabilityMapMap.get(u.userId) || new Map();
      const a = map.get(c.candidateId) || 0;
      map.set(c.candidateId, a);
      availabilityMapMap.set(u.userId, map);
    });
  });

  // コメントを取得
  const comments = await prisma.comment.findMany({
    where: { scheduleId: schedule.scheduleId }
  })

  const commentMap = new Map() // key: userId, value: comment
  comments.forEach((comment) => {
    commentMap.set(comment.userId, comment.comment);
  })

  return c.html(
    layout(
      c,
      `予定: ${schedule.scheduleName}`,
      html`
        <h4>【${schedule.scheduleName}】</h4>
        <p style="white-space: pre;">メモ：${schedule.memo}</p>
        <p>(Created by ${schedule.user.username}.)</p>
        <h3>出欠表</h3>
        <table>
          <tr>
            <th>予定</th>
            ${users.map((user) => html`<th>${user.username}</th>`)}
          </tr>
          ${candidates.map(
            (candidate) => html`
              <tr>
                <th>${candidate.candidateName}</th>
                ${users.map((user) => {
                  const availability = availabilityMapMap
                  .get(user.userId)
                  .get(candidate.candidateId);
                  const availabilityLabels = ['❌', '？', '🙆‍♂️'];
                  const label = availabilityLabels[availability];
                  return html`
                  <td>
                    ${user.isSelf
                      ? html`<button
                          data-schedule-id="${schedule.scheduleId}"
                          data-user-id="${user.userId}"
                          data-candidate-id="${candidate.candidateId}"
                          data-availability="${availability}"
                          class="availability-toggle-button"
                        >
                        ${label}
                      </button>`
                      : html`<p>${label}</p>`
                    }
                  </td>
                  `
                },
                )}
              </tr>
            `,
          )}
          <tr>
            <th>コメント</th>
            ${users.map((user) => {
              const comment = commentMap.get('user.userId');
              return html`
                <td>
                  <p id="${user.isSelf ? "self-comment" : ""}"">${comment}</p>
                  ${user.isSelf ? html`<button>編集</button>` : ""}
                </td>
              `;
            })}
          </tr>
        </table>
      `,
    ),
  );
});


module.exports = app;

// 小さい地図

const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const { z } = require('zod');
const { zValidator } = require('@hono/zod-validator');
const { HTTPException } = require('hono/http-exception');

const app = new Hono();

app.use(ensureAuthenticated());

const scheduleIdValidator = zValidator(
  'param',
  z.object({
    scheduleId: z.string().uuid(),
  }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: 'URL の形式が正しくありません。' });
    }
  }
);

const scheduleFormValidator = zValidator(
  'form',
  z.object({
    scheduleName: z.string(),
    memo: z.string(),
    candidates: z.string()
  }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: '入力された情報が不十分、または正しくありません' })
    }
  }
);

async function createCandidates(candidateNames, scheduleId) {
  const candidates = candidateNames.map((candidateName) => ({
    candidateName,
    scheduleId
  }))
  await prisma.candidate.createMany({
    data: candidates
  })
}

function parseCandidateNames(candidatesStr) {
  return candidatesStr.split('\n').map((s) => (s.trim())).filter((s) => (s !== ''));
}

app.get('/new', (c) => {
  return c.html(
    layout(
      c,
      "打ち上げの作成",
      html`
        <form method="post" action="/schedules" class="my-3">
          <div class="mb-3">
            <label class="form-label">打ち上げ名</label>
            <input type="text" name="scheduleName" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label">メモ</label>
            <textarea name="memo" class="form-control"></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">候補日程（改行して複数入力してください）</label>
            <textarea name="candidates" class="form-control"></textarea>
          </div>
          <button class="btn btn-primary type="submit">作成する</button>
        </form>
      `
    )
  );
});

app.post('/', scheduleFormValidator, async (c) => {
  const { user } = c.get('session');
  const body = c.req.valid('form');

  // 打ち上げを登録
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
  const candidateNames = parseCandidateNames(body.candidates);
  await createCandidates(candidateNames, scheduleId);

  // 作成した打ち上げのページにリダイレクト
  return c.redirect('/schedules/' + scheduleId);
});

app.get('/:scheduleId', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.valid('param').scheduleId },
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

  // DBからその打ち上げに対する全ての出欠を取得する
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

  const buttonStyles = ['btn-danger', 'btn-secondary', 'btn-success'];

  return c.html(
    layout(
      c,
      `打ち上げ: ${schedule.scheduleName}`,
      html`
        <div class="card my-3">
          <h4 class="card-header">${schedule.scheduleName}</h4>
          <div class="card-body">
            <p style="white-space: pre;">${schedule.memo}</p>
          </div>
          <div class="card-footer">Created by ${schedule.user.username}.</div>
        </div>
        ${isMine(user.id, schedule)
          ? html`
            <a href="/schedules/${schedule.scheduleId}/edit" class="btn btn-primary">編集する <i class="bi bi-pencil"></i></a>
          `
          : ''
        }
        <h3 class="my-3">出欠表</h3>
        <div class="table-responsive">
          <table class="table table-bordered">
            <tr>
              <th>名前</th>
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
            const availabilityLabels = ['欠', '？', '出'];
            const label = availabilityLabels[availability];
            return html`
                    <td>
                      ${user.isSelf
                ? html`<button
                            data-schedule-id="${schedule.scheduleId}"
                            data-user-id="${user.userId}"
                            data-candidate-id="${candidate.candidateId}"
                            data-availability="${availability}"
                            class="availability-toggle-button btn btn-lg ${buttonStyles[availability]}"
                          >
                          ${label}
                        </button>`
                : html`<h3>${label}</h3>`
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
          const comment = commentMap.get(user.userId);
          return html`
                  <td>
                    <p>
                      <small id="${user.isSelf ? "self-comment" : ""}">${comment}</small>
                    <p>
                    ${user.isSelf
              ? html`
                      <button
                        data-schedule-id="${schedule.scheduleId}"
                        data-user-id="${user.userId}"
                        id="self-comment-button"
                        class="btn btn-info"
                      >編集</button>
                      `
              : ""}
                  </td>
                `;
        })}
            </tr>
          </table>
        </div>
      `,
    ),
  );
});

function isMine(userId, schedule) {
  return schedule && parseInt(schedule.createdBy, 10) === parseInt(userId, 10);
}

app.get('/:scheduleId/edit', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') || {};
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.valid('param').scheduleId },
  });

  if (!isMine(user.id, schedule)) {
    return c.notFound();
  }

  const candidates = await prisma.candidate.findMany({
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: 'asc' }
  });

  return c.html(
    layout(
      c,
      `打ち上げの編集: ${schedule.scheduleName}`,
      html`
        <form class="my-3" method="post" action="/schedules/${schedule.scheduleId}/update">
          <div class="mb-3">
            <label class="form-label">打ち上げ名</label>
            <input type="text" class="form-control" name="scheduleName" value="${schedule.scheduleName}" />
          </div>
          <div class="mb-3">
            <label class="form-label">メモ</label>
            <textarea name="memo" class="form-control">${schedule.memo}</textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">既存の候補日程</label>
            <ul class="list-group mb-2">
              ${candidates.map((candidate) => html`
                <li class="list-group-item">${candidate.candidateName}</li>
              `)}
            </ul>
            <p>追加する候補日程（複数入力する際は改行してください）</p>
            <textarea name="candidates" class="form-control"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">保存する <i class="bi bi-pencil"></i></button>
        </form>
        <h5 class="my-3">⚠️削除後は復元できません</h5>
        <form method="post" action="/schedules/${schedule.scheduleId}/delete">
          <button type="submit" class="btn btn-danger">削除する <i class="bi bi-trash"></i></button>
        </form>
      `
    )
  )
});

app.post('/:scheduleId/update', scheduleFormValidator, scheduleIdValidator, async (c) => {
  const { user } = c.get('session') || {};
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.valid('param').scheduleId }
  });

  if (!isMine(user.id, schedule)) {
    return c.notFound();
  }

  const body = c.req.valid('form');
  const updatedSchedule = await prisma.schedule.update({
    where: { scheduleId: schedule.scheduleId },
    data: {
      scheduleName: body.scheduleName.slice(0, 255) || '（名称未設定）',
      memo: body.memo,
      updatedAt: new Date()
    }
  });

  const candidateNames = parseCandidateNames(body.candidates);
  if (candidateNames.length) {
    await createCandidates(candidateNames, updatedSchedule.scheduleId);
  }

  return c.redirect('/schedules/' + updatedSchedule.scheduleId);
});


async function deleteScheduleAggregate(scheduleId) {
  await prisma.availability.deleteMany({
    where: { scheduleId }
  });
  await prisma.candidate.deleteMany({
    where: { scheduleId }
  });
  await prisma.comment.deleteMany({
    where: { scheduleId }
  });
  await prisma.schedule.delete({
    where: { scheduleId }
  });
}

app.deleteScheduleAggregate = deleteScheduleAggregate;

app.post('/:scheduleId/delete', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.valid('param').scheduleId }
  });
  if (!isMine(user.id, schedule)) {
    return c.notFound();
  }
  await deleteScheduleAggregate(schedule.scheduleId);
  return c.redirect('/');
});

module.exports = app;

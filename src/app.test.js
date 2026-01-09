'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const testUser = {
  userId: 0,
  username: 'testuser',
};

function mockIronSession() {
  const ironSession = require('iron-session');
  jest.spyOn(ironSession, 'getIronSession').mockReturnValue({
    user: { login: testUser.username, id: testUser.userId },
    save: jest.fn(),
    destroy: jest.fn(),
  });
}

describe('/login', () => {
  beforeAll(() => {
    mockIronSession()
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('ログインのためのリンクが含まれる', async () => {
    const app = require('./app.js');
    const res = await app.request('/login');
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8');
    expect(await res.text()).toMatch(/<a href="\/auth\/github"/);
    expect(res.status).toBe(200);
  });

  test('ログイン時はユーザ名が表示される', async() => {
    const app = require('./app.js');
    const res = await app.request('/login');
    expect(await res.text()).toMatch(/testuser/);
    expect(res.status).toBe(200);
  });
});

describe('/schedules', () => {
  let scheduleId = '';
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(async () => {
    jest.restoreAllMocks();

    // テストで作成したデータを削除
    await prisma.candidate.deleteMany({ where: { scheduleId } });
    await prisma.schedule.delete({ where: { scheduleId } });
  });

  test('予定が作成でき、表示される', async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    const app = require('./app');

    const postRes = await app.request('/schedules', {
      method: 'POST',
      body: new URLSearchParams({
        scheduleName: 'テスト予定1',
        memo: 'テストメモ1\r\nテストメモ2',
        candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const createdSchedulePath = postRes.headers.get('Location');
    expect(createdSchedulePath).toMatch(/schedules/);
    expect(postRes.status).toBe(302);

    scheduleId = createdSchedulePath.split('/schedules/')[1];

    const res = await app.request(createdSchedulePath);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toMatch(/テスト予定1/);
    expect(body).toMatch(/テストメモ1/);
    expect(body).toMatch(/テストメモ2/);
    expect(body).toMatch(/テスト候補1/);
    expect(body).toMatch(/テスト候補2/);
    expect(body).toMatch(/テスト候補3/);
  });
});

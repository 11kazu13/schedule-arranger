const { Hono } = require('hono');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const { z } = require('zod');
const { zValidator } = require('@hono/zod-validator');

const app = new Hono();

const paramValidator = zValidator(
  'param',
  z.object({
    scheduleId: z.string().uuid(),
    userId: z.coerce.number().int().min(0)
  }),
  (result, c) => {
    if (!result.success) {
      return c.json({
        status: 'NG',
        error: [result.error]
      }, 400)
    }
  }
);

const jsonValidator = zValidator(
  'json',
  z.object({
    comment: z.string().min(0).max(255)
  }),
  (result, c) => {
    if (!result.success) {
      return c.json({
        status: 'NG',
        error: [result.error]
      }, 400)
    }
  }
);

app.post(
  '/:scheduleId/users/:userId/comments',
  paramValidator,
  jsonValidator,
  ensureAuthenticated(),
  async (c) => {
    const { scheduleId, userId } = c.req.valid('param');
    const { comment } = c.req.valid('json');

    const { user } = c.get('session') ?? {};
    if (user?.id !== userId) {
      return c.json({
        status: 'NG',
        errors: [{ msg: 'ユーザーIDが不正です'}]
      }, 403)
    }

    const data = {
      userId,
      scheduleId,
      comment
    }

    try {
      await prisma.comment.upsert({
      where: {
        commentCompositeId: {
          scheduleId,
          userId
        }
      },
      create: data,
      update: data,
    });
    } catch (e) {
      console.error(e);
      return c.json({
        status: 'NG',
        errors: [{ msg: 'DBエラー' }]
      }, 500)
    }

    return c.json({ status: 'OK', comment})
  }
);

module.exports = app;

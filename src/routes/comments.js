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
  ensureAuthenticated(),
  async (c) => {
    const scheduleId = c.req.param('scheduleId');
    const userId = parseInt(c.req.param('userId'), 10);

    const body = await c.req.json();
    const comment = body.comment.slice(0, 255);

    const data = {
      userId,
      scheduleId,
      comment
    }

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

    return c.json({ status: 'OK', comment})
  }
);

module.exports = app;

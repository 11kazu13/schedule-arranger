const { Hono } = require('hono');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();

app.post(
  '/:scheduleId/users/:userId/candidates/:candidateId',
  ensureAuthenticated(),
  async (c) => {
    const scheduleId = c.rep.param('scheduleId');
    const userId = prseInt(c.rep.param('userId'), 10);
    const candidateId = prseInt(c.rep.param('candidateId'), 10);

    const body = await c.req.json();
    const availability = body.availability ? parseInt(body.availability, 10) : 0;

    const data = {
      candidateId,
      userId,
      availability,
      scheduleId
    }

    await prisma.availability.upsert({
      where: {
        availabilityCompositId: {
          candidateId,
          userId
        }
      },
      create: data,
      insert: data,
    });

    return c.json({ status: 'OK', availability})
  }
);

module.exports = app;

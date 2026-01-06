import { Controller, Get } from '@nestjs/common';
import prisma from '../prisma/client';

@Controller('api/health')
export class HealthController {
  @Get()
  async health() {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      ok: true,
      uptimeSec: Math.floor(process.uptime()),
      postgres: dbOk
    };
  }
}

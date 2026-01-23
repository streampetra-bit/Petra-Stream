import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { formatUnits } from 'ethers';
import prisma from '../prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StreamsService } from '../streams/streams.service';

@Controller('api')
export class MetaController {
  constructor(private readonly streams: StreamsService) {}

  @Get('categories')
  categories() {
    return { data: [
      { id: 'gaming', label: 'Gaming' },
      { id: 'music', label: 'Music' },
      { id: 'art', label: 'Art' },
      { id: 'tech', label: 'Tech' },
      { id: 'finance', label: 'Finance' }
    ] };
  }

  @Get('trending')
  trending() {
    return { data: ['chill', 'onchain', 'live-coding', 'music', 'nft'] };
  }

  @UseGuards(JwtAuthGuard)
  @Get('creator/stats')
  async creatorStats(@Req() req: any) {
    const user = req?.user;
    const rawIds = [user?.address, user?.username, user?.userId]
      .filter(Boolean)
      .map((value) => String(value));
    if (!rawIds.length) {
      throw new UnauthorizedException('Invalid token');
    }

    const ids = Array.from(
      new Set(
        rawIds.flatMap((value) => {
          if (value.startsWith('0x')) {
            return [value, value.toLowerCase()];
          }
          return [value];
        })
      )
    );

    const where = {
      OR: ids.flatMap((id) => [{ to: id }, { streamId: id }])
    };

    let tips = 0;
    let earnings = 0;
    try {
      const [count, sum] = await Promise.all([
        prisma.tip.count({ where }),
        prisma.tip.aggregate({ where, _sum: { amount: true } })
      ]);
      tips = count ?? 0;
      const totalRaw = sum?._sum?.amount ?? 0n;
      const decimals = Number(process.env.TOKEN_DECIMALS ?? 18);
      const normalized = formatUnits(BigInt(totalRaw.toString()), Number.isFinite(decimals) ? decimals : 18);
      earnings = Number(normalized) || 0;
    } catch {
      tips = 0;
      earnings = 0;
    }

    let viewers = 0;
    try {
      const metas = await Promise.all(
        ids.map((id) => this.streams.findById(id).catch(() => null))
      );
      viewers = metas.reduce((sum, meta) => sum + (meta?.viewerCount ?? 0), 0);
    } catch {
      viewers = 0;
    }

    return { viewers, tips, earnings };
  }
}

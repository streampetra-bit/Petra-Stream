import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { StreamsService } from '../streams/streams.service';
import { NotificationItem, NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly streams: StreamsService,
    private readonly notifications: NotificationsService
  ) {}

  @Get()
  async list(
    @Query('streamer') streamer?: string,
    @Query('limit') limit = 20
  ) {
    const streamId = streamer || process.env.DEFAULT_STREAMER || '';
    const max = Number(limit) || 20;
    const now = Date.now();

    const items: NotificationItem[] = [
      {
        id: 'n-welcome',
        title: 'Welcome to Petra Stream',
        description: 'Connect a wallet to tip creators and go live.',
        kind: 'system',
        ts: now
      }
    ];

    if (streamId) {
      const stream = await this.streams.findById(streamId);
      if (stream) {
        items.push({
          id: `n-stream-${streamId}`,
          title: 'Stream ready',
          description: `Streamer ${streamId} is configured.`,
          kind: 'stream',
          ts: now
        });
      }

      const tips = await this.streams.findTips(streamId, max);
      tips.forEach((tip: any) => {
        const amount = tip.amount?.toString?.() ?? String(tip.amount ?? '0');
        items.push({
          id: tip.id || tip.txHash || `tip-${tip.createdAt || tip.timestamp || now}`,
          title: 'Tip received',
          description: `${tip.from} tipped ${amount}`,
          kind: 'tip',
          ts: tip.createdAt ? new Date(tip.createdAt).getTime() : now
        });
      });
    }

    return { data: items.sort((a, b) => b.ts - a.ts).slice(0, max) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listForMe(@Req() req: any, @Query('limit') limit = 20) {
    const identity = this.resolveIdentity(req);
    const max = Number(limit) || 20;
    const base: NotificationItem[] = [
      {
        id: `n-welcome-${identity}`,
        title: 'Welcome to Petra Stream',
        description: 'Connect a wallet to tip creators and go live.',
        kind: 'system',
        ts: Date.now()
      }
    ];
    const userItems = await this.notifications.listForUser(identity, max);
    const merged = [...base, ...userItems].sort((a, b) => b.ts - a.ts).slice(0, max);
    return { data: merged };
  }

  private resolveIdentity(req: any): string {
    const user = req?.user;
    return (
      user?.address ||
      user?.username ||
      user?.userId ||
      user?.id ||
      process.env.DEFAULT_STREAMER ||
      'demo-user'
    );
  }
}

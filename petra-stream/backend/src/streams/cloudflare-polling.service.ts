import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import prisma from '../prisma/client';
import { CloudflareStreamService } from './cloudflare-stream.service';
import { StreamsService } from './streams.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CloudflarePollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudflarePollingService.name);
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly cloudflare: CloudflareStreamService,
    private readonly streams: StreamsService,
    private readonly notifications: NotificationsService
  ) {}

  onModuleInit() {
    const enabled = String(process.env.CLOUDFLARE_ENABLE_POLLING || 'false').toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('Cloudflare polling disabled');
      return;
    }
    if (!this.cloudflare.isConfigured()) {
      this.logger.warn('Cloudflare polling enabled but Cloudflare is not configured');
      return;
    }
    const intervalSec = Number(process.env.CLOUDFLARE_POLL_INTERVAL_SEC ?? 20);
    const intervalMs = Number.isFinite(intervalSec) && intervalSec > 5 ? intervalSec * 1000 : 20_000;
    this.timer = setInterval(() => void this.poll(), intervalMs);
    void this.poll();
    this.logger.log(`Cloudflare polling enabled (${Math.round(intervalMs / 1000)}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const rows = await prisma.stream.findMany({
        where: {
          OR: [
            { cloudflareScreenInputId: { not: null } },
            { cloudflareCameraInputId: { not: null } }
          ]
        }
      });

      for (const row of rows) {
        const screenId = row.cloudflareScreenInputId || '';
        const cameraId = row.cloudflareCameraInputId || '';
        let screenLive = false;
        let cameraLive = false;

        let screenOffline = false;
        let cameraOffline = false;
        let hasVideo = false;
        if (screenId) {
          const status = await this.cloudflare.getLiveInputStatus(screenId);
          const normalized = String(status || '').toLowerCase();
          screenLive = normalized === 'connected' || normalized === 'live' || normalized === 'live-inprogress' || normalized === 'ready';
          screenOffline = normalized === 'disconnected' || normalized === 'errored' || normalized === 'error' || normalized === 'stopped';
          const videoId = await this.cloudflare.getLiveInputActiveVideoId(screenId).catch(() => '');
          if (videoId) hasVideo = true;
        }
        if (cameraId) {
          const status = await this.cloudflare.getLiveInputStatus(cameraId);
          const normalized = String(status || '').toLowerCase();
          cameraLive = normalized === 'connected' || normalized === 'live' || normalized === 'live-inprogress' || normalized === 'ready';
          cameraOffline = normalized === 'disconnected' || normalized === 'errored' || normalized === 'error' || normalized === 'stopped';
          const videoId = await this.cloudflare.getLiveInputActiveVideoId(cameraId).catch(() => '');
          if (videoId) hasVideo = true;
        }

        const nextStatus = screenLive || cameraLive || hasVideo ? 'online' : (screenOffline || cameraOffline ? 'offline' : null);
        if (!nextStatus || row.status === nextStatus) continue;

        const streamer = row.streamer || row.streamId;
        await this.streams.updateMeta(streamer, { status: nextStatus });
        await this.notifications.notifyStreamStatus(streamer, nextStatus, row.title ?? undefined);
      }
    } catch (err) {
      this.logger.warn('Cloudflare polling failed', err as any);
    } finally {
      this.isPolling = false;
    }
  }
}

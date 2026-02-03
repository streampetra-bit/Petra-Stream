import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '../prisma/client';
import { StreamsService } from './streams.service';
import { NotificationsService } from '../notifications/notifications.service';

type CloudflareWebhookPayload = {
  name?: string;
  text?: string;
  data?: {
    input_id?: string;
    event_type?: string;
    updated_at?: string;
    live_input_errored?: { code?: string };
  };
  ts?: number;
};

function parseSignatureHeader(header?: string) {
  if (!header) return null;
  const parts = header.split(',').map((part) => part.trim());
  const parsed: Record<string, string> = {};
  parts.forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) parsed[key] = value;
  });
  return parsed.time && parsed.sig1 ? parsed : null;
}

function verifySignature(rawBody: string, header: string, secret: string, toleranceSec: number) {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const timestamp = Number(parsed.time);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  const source = `${parsed.time}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(source, 'utf8').digest('hex');
  const actual = parsed.sig1;
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

@Controller('api/webhooks/cloudflare')
export class CloudflareWebhookController {
  constructor(
    private readonly streams: StreamsService,
    private readonly notifications: NotificationsService
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: any,
    @Body() body: CloudflareWebhookPayload,
    @Headers('webhook-signature') webhookSignature?: string
  ) {
    const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET || '';
    const tolerance = Number(process.env.CLOUDFLARE_WEBHOOK_TOLERANCE_SEC ?? 300);
    const rawBody = String(req?.rawBody || '');

    if (secret) {
      const ok = verifySignature(rawBody, webhookSignature || '', secret, Number.isFinite(tolerance) ? tolerance : 300);
      if (!ok) {
        return { ok: false, reason: 'invalid_signature' };
      }
    }

    const inputId = body?.data?.input_id;
    const eventType = body?.data?.event_type || '';
    if (!inputId || !eventType) {
      return { ok: false, reason: 'missing_input_or_event' };
    }

    const row = await prisma.stream.findFirst({
      where: {
        OR: [
          { cloudflareScreenInputId: inputId },
          { cloudflareCameraInputId: inputId }
        ]
      }
    }).catch(() => null);

    if (!row) {
      return { ok: true, ignored: true };
    }

    const streamer = row.streamer || row.streamId;
    const isLiveEvent = eventType === 'live_input.connected';
    const isOfflineEvent = eventType === 'live_input.disconnected' || eventType === 'live_input.errored';

    if (isLiveEvent || isOfflineEvent) {
      const status = isLiveEvent ? 'online' : 'offline';
      await this.streams.updateMeta(streamer, { status });
      await this.notifications.notifyStreamStatus(streamer, status, row.title ?? undefined);
    }

    return { ok: true };
  }
}

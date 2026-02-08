import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { Interface, encodeBytes32String } from 'ethers';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { CloudflareStreamService } from './cloudflare-stream.service';

@Controller('api/streams')
export class StreamsController {
  constructor(
    private readonly streams: StreamsService,
    private readonly notifications: NotificationsService,
    private readonly cloudflare: CloudflareStreamService
  ) {}

  @Get('active')
  findActive(@Query('limit') limit?: string) {
    const take = Number(limit);
    const bounded = Number.isFinite(take) && take > 0 ? take : 20;
    return this.streams.findActive(bounded);
  }

  @Get('related')
  related(@Query('streamId') streamId: string) {
    return this.streams.related(streamId, 4);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    const identity = this.resolveIdentity(req);
    return this.streams.findById(identity);
  }

  @UseGuards(JwtAuthGuard)
  @Get('inputs')
  async inputs(@Req() req: any) {
    const identity = this.resolveIdentity(req);
    return this.cloudflare.ensureInputs(identity);
  }

  @Get('top')
  top(@Query('limit') limit?: string) {
    const take = Number(limit);
    const bounded = Number.isFinite(take) && take > 0 ? take : 20;
    return this.streams.findActive(bounded);
  }

  @Post('playback/check')
  async checkPlayback(@Body('playbackUrl') playbackUrl?: string) {
    return this.checkPlaybackUrl(playbackUrl);
  }

  @Post('ingest/auth')
  async ingestAuth(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-media-token') mediaToken?: string
  ) {
    const streamKey = this.extractStreamKey(body);
    if (!streamKey) {
      throw new UnauthorizedException('Missing stream key');
    }

    this.verifyMediaToken(authorization, mediaToken);

    const stream = await this.streams.findByStreamKey(streamKey);
    if (!stream) {
      throw new UnauthorizedException('Unknown stream key');
    }

    return { ok: true, streamId: stream.id, streamer: stream.streamer };
  }

  @Post('ingest/publish')
  async ingestPublish(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-media-token') mediaToken?: string
  ) {
    this.verifyMediaToken(authorization, mediaToken);
    const streamKey = this.extractStreamKey(body);
    if (!streamKey) {
      throw new UnauthorizedException('Missing stream key');
    }
    const updated = await this.streams.setStatusByKey(streamKey, 'online');
    if (!updated) {
      throw new UnauthorizedException('Unknown stream key');
    }
    await this.notifications.notifyStreamStatus(updated.streamer, 'online', updated.title);
    return { ok: true, streamKey, status: 'online' };
  }

  @Post('ingest/unpublish')
  async ingestUnpublish(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-media-token') mediaToken?: string
  ) {
    this.verifyMediaToken(authorization, mediaToken);
    const streamKey = this.extractStreamKey(body);
    if (!streamKey) {
      throw new UnauthorizedException('Missing stream key');
    }
    const updated = await this.streams.setStatusByKey(streamKey, 'offline');
    if (!updated) {
      throw new UnauthorizedException('Unknown stream key');
    }
    await this.notifications.notifyStreamStatus(updated.streamer, 'offline', updated.title);
    return { ok: true, streamKey, status: 'offline' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-key')
  generateKey(@Req() req: any, @Body('streamer') streamer?: string) {
    const identity = this.resolveIdentity(req, streamer);
    return this.streams.generateKey(identity).then(key => ({ key }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('regenerate-key')
  regenerateKey(@Req() req: any, @Body('streamer') streamer?: string) {
    const identity = this.resolveIdentity(req, streamer);
    return this.streams.generateKey(identity).then(key => ({ key }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(@Req() req: any, @Body() body: any) {
    const identity = this.resolveIdentity(req, body?.streamer);
    return this.streams.startStream({ ...body, streamer: identity }).then(async (meta) => {
      await this.notifications.notifyStreamStatus(identity, 'online', meta?.title);
      return meta;
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('stop')
  stop(@Req() req: any, @Body('streamer') streamer?: string) {
    const identity = this.resolveIdentity(req, streamer);
    return this.streams.stopStream(identity).then(async (r) => {
      await this.notifications.notifyStreamStatus(identity, 'offline', r?.title);
      return { ok: true, stream: r };
    });
  }

  @Get(':id/tips')
  findTips(@Param('id') id: string, @Query('limit') limit = 50) {
    return this.streams.findTips(id, Number(limit));
  }

  @Get(':id/health')
  async health(@Param('id') id: string) {
    const stream = await this.streams.findById(id);
    return this.checkPlaybackUrl(stream?.playbackUrl, { streamId: id });
  }

  @Get(':id/viewers')
  listViewers(@Param('id') id: string) {
    return this.streams.listViewers(id);
  }

  @Get(':id/inputs')
  async publicInputs(@Param('id') id: string) {
    try {
      const data = await this.cloudflare.getInputsSnapshot(id);
      return data ?? { customerCode: null, screen: {}, camera: {} };
    } catch {
      return { customerCode: null, screen: {}, camera: {} };
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streams.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle')
  toggleLive(@Req() req: any, @Param('id') id: string, @Body('live') live: boolean) {
    const identity = this.resolveIdentity(req);
    if (identity && identity.toLowerCase() !== id.toLowerCase()) {
      throw new ForbiddenException('Not allowed');
    }
    if (live) {
      return this.streams.startStream({ streamer: id }).then(async (meta) => {
        await this.notifications.notifyStreamStatus(id, 'online', meta?.title);
        return meta;
      });
    }
    return this.streams.stopStream(id).then(async (meta) => {
      await this.notifications.notifyStreamStatus(id, 'offline', meta?.title);
      return meta;
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/update')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const identity = this.resolveIdentity(req);
    if (identity && identity.toLowerCase() !== id.toLowerCase()) {
      throw new ForbiddenException('Not allowed');
    }
    return this.streams.updateMeta(id, {
      title: body.title,
      description: body.description,
      sourceMode: body.sourceMode,
      screenPlaybackUrl: body.screenPlaybackUrl,
      cameraPlaybackUrl: body.cameraPlaybackUrl,
      cloudflareCustomerCode: body.cloudflareCustomerCode,
      cloudflareScreenInputId: body.cloudflareScreenInputId,
      cloudflareCameraInputId: body.cloudflareCameraInputId,
      tokenGated: typeof body.tokenGated === 'boolean' ? body.tokenGated : undefined
    });
  }

  // Tip helper: returns a placeholder contract payload if VAULT_ADDRESS is set
  @Post(':id/tip')
  tip(@Param('id') id: string, @Body() body: any) {
    const vault = process.env.VAULT_ADDRESS;
    const memoStr = typeof body.memo === 'string' && body.memo.trim() ? body.memo.trim() : '';
    const amountStr = typeof body.amount === 'string' ? body.amount : String(body.amount ?? '0');

    if (!vault) {
      // fallback: direct native transfer to streamer
      return { type: 'native', to: id, value: amountStr };
    }

    const iface = new Interface([
      'function depositTipNative(address streamer, bytes32 memo)'
    ]);

    let memo: string;
    try {
      memo = encodeBytes32String(memoStr || '');
    } catch {
      memo = encodeBytes32String('');
    }

    const data = iface.encodeFunctionData('depositTipNative', [id, memo]);
    return {
      type: 'contract',
      to: vault,
      data,
      value: amountStr,
      targetStreamer: id
    };
  }

  private async checkPlaybackUrl(
    playbackUrl?: string,
    extra?: Record<string, any>
  ): Promise<Record<string, any>> {
    if (!playbackUrl) {
      return { ok: false, reason: 'missing_playback_url', ...extra };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(playbackUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      return {
        ok: res.ok,
        status: res.status,
        playbackUrl,
        ...extra
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return { ok: false, reason: err?.message || 'fetch_failed', playbackUrl, ...extra };
    }
  }

  private verifyMediaToken(authorization?: string, mediaToken?: string) {
    const requiredToken = process.env.MEDIA_AUTH_TOKEN || '';
    if (!requiredToken) return;
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const provided = mediaToken || bearer;
    if (provided !== requiredToken) {
      throw new UnauthorizedException('Invalid media token');
    }
  }

  private extractStreamKey(body: any): string | null {
    const path =
      body?.path ||
      body?.stream ||
      body?.name ||
      body?.params?.path ||
      body?.params?.stream ||
      '';
    const key = String(path).split('/').filter(Boolean).pop();
    return key ? String(key) : null;
  }

  private resolveIdentity(req: any, fallback?: string): string {
    const user = req?.user;
    return (
      user?.address ||
      user?.username ||
      user?.userId ||
      fallback ||
      process.env.DEFAULT_STREAMER ||
      'demo-streamer'
    );
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import prisma from '../prisma/client';

type CloudflareLiveInputResult = {
  uid: string;
  webRTC?: { url?: string };
  webRTCPlayback?: { url?: string };
  rtmps?: { url?: string; streamKey?: string };
  rtmp?: { url?: string; streamKey?: string };
};

type CloudflareInputInfo = {
  inputId: string;
  publishUrl?: string;
  playbackUrl?: string;
  rtmpsUrl?: string;
  rtmpsStreamKey?: string;
};

@Injectable()
export class CloudflareStreamService {
  private readonly logger = new Logger(CloudflareStreamService.name);
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';

  private get accountId() {
    return process.env.CLOUDFLARE_ACCOUNT_ID || '';
  }

  private get apiToken() {
    return process.env.CLOUDFLARE_API_TOKEN || '';
  }

  private get hlsQuery() {
    const raw = process.env.CLOUDFLARE_HLS_QUERY || '';
    return raw.replace(/^\?/, '');
  }

  private get preferLowLatency() {
    return String(process.env.CLOUDFLARE_PREFER_LOW_LATENCY || 'true').toLowerCase() === 'true';
  }

  private ensureConfigured() {
    if (!this.accountId || !this.apiToken) {
      throw new BadRequestException('Cloudflare Stream is not configured');
    }
  }

  isConfigured() {
    return Boolean(this.accountId && this.apiToken);
  }

  private parseCustomerCode(url?: string) {
    if (!url) return null;
    const match = url.match(/customer-([a-zA-Z0-9-]+)\.cloudflarestream\.com/);
    return match?.[1] || null;
  }

  private buildHlsUrl(customerCode: string, inputId: string) {
    if (!customerCode || !inputId) return '';
    const base = `https://customer-${customerCode}.cloudflarestream.com/${inputId}/manifest/video.m3u8`;
    return this.hlsQuery ? `${base}?${this.hlsQuery}` : base;
  }

  private async request(path: string, opts: any) {
    this.ensureConfigured();
    const res = await fetch(`${this.apiBase}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    const payload = await res.json().catch(() => null);
    if (!payload?.success) {
      const message =
        payload?.errors?.[0]?.message ||
        payload?.messages?.[0] ||
        `Cloudflare API error (${res.status})`;
      throw new Error(message);
    }
    return payload;
  }

  async getLiveInputStatus(inputId: string): Promise<string> {
    if (!inputId) return '';
    const payload = await this.request(
      `/accounts/${this.accountId}/stream/live_inputs/${inputId}`,
      { method: 'GET' }
    );
    return String(payload?.result?.status || '');
  }

  private async createLiveInput(name: string) {
    const body: Record<string, any> = {
      meta: { name },
      recording: { mode: 'automatic' }
    };
    if (this.preferLowLatency) {
      body.preferLowLatency = true;
    }

    const payload = await this.request(
      `/accounts/${this.accountId}/stream/live_inputs`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );
    return payload?.result as CloudflareLiveInputResult;
  }

  async ensureInputs(streamerId: string) {
    this.ensureConfigured();
    const normalized = streamerId?.toString().trim();
    if (!normalized) {
      throw new BadRequestException('Missing streamer identity');
    }

    let existing = await prisma.stream.findUnique({ where: { streamId: normalized } }).catch(() => null);
    let customerCode = existing?.cloudflareCustomerCode || null;
    let screenInputId = existing?.cloudflareScreenInputId || '';
    let cameraInputId = existing?.cloudflareCameraInputId || '';
    let screenPublishUrl = existing?.cloudflareScreenPublishUrl || '';
    let cameraPublishUrl = existing?.cloudflareCameraPublishUrl || '';
    let screenRtmpsUrl = existing?.cloudflareScreenRtmpsUrl || '';
    let screenRtmpsKey = existing?.cloudflareScreenRtmpsKey || '';
    let cameraRtmpsUrl = existing?.cloudflareCameraRtmpsUrl || '';
    let cameraRtmpsKey = existing?.cloudflareCameraRtmpsKey || '';

    const updates: Record<string, any> = {};

    if (!screenInputId) {
      const created = await this.createLiveInput(`petra:${normalized}:screen`);
      screenInputId = created?.uid || '';
      screenPublishUrl = created?.webRTC?.url || '';
      screenRtmpsUrl = created?.rtmps?.url || created?.rtmp?.url || '';
      screenRtmpsKey = created?.rtmps?.streamKey || created?.rtmp?.streamKey || '';
      const candidateCode = this.parseCustomerCode(created?.webRTCPlayback?.url || created?.webRTC?.url);
      if (candidateCode) customerCode = candidateCode;

      updates.cloudflareScreenInputId = screenInputId || undefined;
      updates.cloudflareScreenPublishUrl = screenPublishUrl || undefined;
      updates.cloudflareScreenRtmpsUrl = screenRtmpsUrl || undefined;
      updates.cloudflareScreenRtmpsKey = screenRtmpsKey || undefined;
    }

    if (!cameraInputId) {
      const created = await this.createLiveInput(`petra:${normalized}:camera`);
      cameraInputId = created?.uid || '';
      cameraPublishUrl = created?.webRTC?.url || '';
      cameraRtmpsUrl = created?.rtmps?.url || created?.rtmp?.url || '';
      cameraRtmpsKey = created?.rtmps?.streamKey || created?.rtmp?.streamKey || '';
      const candidateCode = this.parseCustomerCode(created?.webRTCPlayback?.url || created?.webRTC?.url);
      if (candidateCode) customerCode = candidateCode;

      updates.cloudflareCameraInputId = cameraInputId || undefined;
      updates.cloudflareCameraPublishUrl = cameraPublishUrl || undefined;
      updates.cloudflareCameraRtmpsUrl = cameraRtmpsUrl || undefined;
      updates.cloudflareCameraRtmpsKey = cameraRtmpsKey || undefined;
    }

    if (customerCode && customerCode !== existing?.cloudflareCustomerCode) {
      updates.cloudflareCustomerCode = customerCode;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.stream.upsert({
        where: { streamId: normalized },
        update: updates,
        create: {
          streamId: normalized,
          streamer: normalized,
          title: 'Untitled',
          status: 'offline',
          ...updates
        }
      }).catch((err) => {
        this.logger.warn('Failed to persist Cloudflare inputs', err as any);
      });
      existing = await prisma.stream.findUnique({ where: { streamId: normalized } }).catch(() => null);
    }

    const finalCustomerCode =
      customerCode ||
      existing?.cloudflareCustomerCode ||
      this.parseCustomerCode(screenPublishUrl || cameraPublishUrl) ||
      null;

    const screen: CloudflareInputInfo = {
      inputId: screenInputId,
      publishUrl: screenPublishUrl || undefined,
      playbackUrl: finalCustomerCode ? this.buildHlsUrl(finalCustomerCode, screenInputId) : undefined,
      rtmpsUrl: screenRtmpsUrl || undefined,
      rtmpsStreamKey: screenRtmpsKey || undefined
    };

    const camera: CloudflareInputInfo = {
      inputId: cameraInputId,
      publishUrl: cameraPublishUrl || undefined,
      playbackUrl: finalCustomerCode ? this.buildHlsUrl(finalCustomerCode, cameraInputId) : undefined,
      rtmpsUrl: cameraRtmpsUrl || undefined,
      rtmpsStreamKey: cameraRtmpsKey || undefined
    };

    return {
      customerCode: finalCustomerCode,
      screen,
      camera
    };
  }
}

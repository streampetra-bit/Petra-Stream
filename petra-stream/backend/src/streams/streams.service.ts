import { Injectable, Logger } from '@nestjs/common';
import prisma from '../prisma/client';
import {
  mongoFindStream,
  mongoListActiveStreams,
  mongoListTips,
  mongoMarkOffline,
  mongoSaveTip,
  mongoUpsertStream,
  mongoFindStreamByKey
} from '../db/mongo';

type StreamMeta = {
  id: string;
  streamer: string;
  title?: string;
  description?: string;
  status: 'online' | 'offline';
  streamKey?: string;
  playbackUrl?: string;
  screenPlaybackUrl?: string;
  cameraPlaybackUrl?: string;
  webrtcPlaybackUrl?: string;
  screenWebrtcPlaybackUrl?: string;
  cameraWebrtcPlaybackUrl?: string;
  cloudflareCustomerCode?: string;
  cloudflareScreenInputId?: string;
  cloudflareCameraInputId?: string;
  sourceMode?: 'camera' | 'screen';
  thumbnail?: string;
  tags?: string[];
  viewerCount?: number;
  tips?: any[];
};

@Injectable()
export class StreamsService {
  // lightweight in-memory cache + DB fallback
  private streams = new Map<string, StreamMeta>();
  private viewers = new Map<string, Set<string>>();
  private readonly logger = new Logger(StreamsService.name);

  private defaultStreamer(streamer?: string) {
    return streamer || process.env.DEFAULT_STREAMER || 'demo-streamer';
  }

  async findActive(limit?: number): Promise<StreamMeta[]> {
    // merge sources to avoid missing active streams across instances
    const cached = Array.from(this.streams.values()).filter(s => s.status === 'online');
    const mongo = await mongoListActiveStreams();
    let prismaRows: any[] = [];
    try {
      prismaRows = await prisma.stream.findMany({ where: { status: 'online' } });
    } catch (err) {
      this.logger.warn('findActive prisma failed; continuing with cache/mongo', err as any);
    }

    const merged = new Map<string, StreamMeta>();
    const add = (stream?: StreamMeta | null) => {
      if (!stream) return;
      const key = (stream.streamer || stream.id || '').toLowerCase();
      if (!key) return;
      merged.set(key, stream);
    };

    prismaRows.forEach(r => add(this.mapStream({ ...r, streamId: r.streamId ?? r.streamer })));
    mongo.forEach(m => add(this.mapStream(m)));
    cached.forEach(s => add(s));

    const result = Array.from(merged.values());
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      return result.slice(0, limit);
    }
    return result;
  }

  async findById(id: string): Promise<StreamMeta | null> {
    const cached = this.streams.get(id);
    if (cached) return cached;

    const mongo = await mongoFindStream(id);
    if (mongo) return this.mapStream(mongo);

    try {
      const row = await prisma.stream.findUnique({ where: { streamId: id } });
      if (row) {
        const mapped = this.mapStream({ ...row, streamId: row.streamId ?? row.streamer });
        this.streams.set(id, mapped);
        return mapped;
      }
    } catch (err) {
      this.logger.warn('findById prisma failed', err as any);
    }
    return null;
  }

  async findByStreamKey(streamKey: string): Promise<StreamMeta | null> {
    const cached = Array.from(this.streams.values()).find(s => s.streamKey === streamKey);
    if (cached) return cached;

    const mongo = await mongoFindStreamByKey(streamKey);
    if (mongo) return this.mapStream(mongo);

    try {
      const row = await prisma.stream.findUnique({ where: { streamKey } });
      if (row) {
        const mapped = this.mapStream({ ...row, streamId: row.streamId ?? row.streamer });
        this.streams.set(mapped.streamer, mapped);
        return mapped;
      }
    } catch (err) {
      this.logger.warn('findByStreamKey prisma failed', err as any);
    }
    return null;
  }

  async findTips(streamId: string, limit = 50) {
    try {
      return await prisma.tip.findMany({
        where: { streamId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (err) {
      this.logger.warn('findTips prisma failed, falling back to mongo', err as any);
      return mongoListTips(streamId, limit);
    }
  }

  addTipToCache(streamId: string, tip: any) {
    // keep a small in-memory representation for quick UI reads
    const arr = this.streams.get(streamId)?.tips ?? [];
    const next = [tip, ...arr].slice(0, 200);
    this.streams.set(streamId, { ...(this.streams.get(streamId) ?? { id: streamId, streamer: streamId, status: 'online' }), tips: next });
  }

  async recordTip(streamId: string, tip: any) {
    this.addTipToCache(streamId, tip);
    await mongoSaveTip({
      streamId,
      from: tip.from,
      to: tip.to,
      token: tip.token ?? 'native',
      amount: tip.amount?.toString?.() ?? tip.amount ?? '0',
      memo: tip.memo,
      txHash: tip.txHash
    });
  }

  async generateKey(streamer?: string) {
    const key = `sk_${Math.random().toString(36).slice(2, 12)}`;
    const s = this.defaultStreamer(streamer);
    const existing = (await this.findById(s)) ?? { id: s, streamer: s, status: 'offline' as const };
    const next = { ...existing, streamKey: key };
    this.streams.set(s, next);
    try {
      await prisma.stream.upsert({
        where: { streamId: s },
        update: { streamKey: key },
        create: {
          streamId: s,
          streamer: s,
          title: existing.title ?? 'Untitled',
          status: existing.status ?? 'offline',
          streamKey: key
        }
      });
    } catch (err) {
      this.logger.warn('generateKey prisma upsert failed', err as any);
    }
    await this.persistStream(next);
    return key;
  }

  async startStream(payload: { streamer?: string; title?: string; description?: string; playbackUrl?: string; tags?: string[]; streamKey?: string; key?: string; screenPlaybackUrl?: string; cameraPlaybackUrl?: string; screenWebrtcPlaybackUrl?: string; cameraWebrtcPlaybackUrl?: string; webrtcPlaybackUrl?: string; sourceMode?: 'camera' | 'screen'; cloudflareCustomerCode?: string; cloudflareScreenInputId?: string; cloudflareCameraInputId?: string }) {
    const streamer = this.defaultStreamer(payload.streamer);
    const streamKey = payload.streamKey ?? payload.key ?? this.streams.get(streamer)?.streamKey;
    const hlsBase = process.env.MEDIA_HLS_BASE_URL || '';
    const normalizedBase = hlsBase.endsWith('/') ? hlsBase.slice(0, -1) : hlsBase;
    const playbackUrl = payload.playbackUrl || (normalizedBase && streamKey ? `${normalizedBase}/${streamKey}/index.m3u8` : undefined);
    const sourceMode = payload.sourceMode;
    const screenPlaybackUrl =
      payload.screenPlaybackUrl ?? (sourceMode === 'screen' ? playbackUrl : undefined);
    const cameraPlaybackUrl = payload.cameraPlaybackUrl;
    const meta: StreamMeta = {
      ...(this.streams.get(streamer) ?? { id: streamer, streamer }),
      title: payload.title,
      description: payload.description,
      playbackUrl,
      screenPlaybackUrl,
      cameraPlaybackUrl,
      webrtcPlaybackUrl: payload.webrtcPlaybackUrl ?? this.streams.get(streamer)?.webrtcPlaybackUrl,
      screenWebrtcPlaybackUrl: payload.screenWebrtcPlaybackUrl ?? this.streams.get(streamer)?.screenWebrtcPlaybackUrl,
      cameraWebrtcPlaybackUrl: payload.cameraWebrtcPlaybackUrl ?? this.streams.get(streamer)?.cameraWebrtcPlaybackUrl,
      cloudflareCustomerCode: payload.cloudflareCustomerCode ?? this.streams.get(streamer)?.cloudflareCustomerCode,
      cloudflareScreenInputId: payload.cloudflareScreenInputId ?? this.streams.get(streamer)?.cloudflareScreenInputId,
      cloudflareCameraInputId: payload.cloudflareCameraInputId ?? this.streams.get(streamer)?.cloudflareCameraInputId,
      sourceMode,
      tags: payload.tags,
      streamKey,
      status: 'online',
      viewerCount: this.streams.get(streamer)?.viewerCount ?? 0
    };
    this.streams.set(streamer, meta);

    try {
      await prisma.stream.upsert({
        where: { streamId: streamer },
        update: {
          title: payload.title,
          streamer,
          status: 'online',
          streamKey,
          cloudflareCustomerCode: payload.cloudflareCustomerCode ?? undefined,
          cloudflareScreenInputId: payload.cloudflareScreenInputId ?? undefined,
          cloudflareCameraInputId: payload.cloudflareCameraInputId ?? undefined
        },
        create: {
          streamId: streamer,
          streamer,
          title: payload.title ?? 'Untitled',
          status: 'online',
          streamKey,
          cloudflareCustomerCode: payload.cloudflareCustomerCode ?? undefined,
          cloudflareScreenInputId: payload.cloudflareScreenInputId ?? undefined,
          cloudflareCameraInputId: payload.cloudflareCameraInputId ?? undefined
        }
      });
    } catch (err) {
      this.logger.warn('startStream prisma upsert failed', err as any);
    }

    await this.persistStream(meta);
    return meta;
  }

  async stopStream(streamer?: string) {
    const id = this.defaultStreamer(streamer);
    const meta = this.streams.get(id);
    if (meta) {
      this.streams.set(id, { ...meta, status: 'offline' });
    }
    try {
      await prisma.stream.updateMany({ where: { streamId: id }, data: { status: 'offline' } });
    } catch (err) {
      this.logger.warn('stopStream prisma failed', err as any);
    }
    await mongoMarkOffline(id);
    return this.streams.get(id) ?? null;
  }

  async updateMeta(streamer: string, data: Partial<StreamMeta>) {
    const id = this.defaultStreamer(streamer);
    const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    const next = { ...(this.streams.get(id) ?? { id, streamer: id, status: 'offline' as const }), ...clean };
    this.streams.set(id, next);
    try {
      await prisma.stream.upsert({
        where: { streamId: id },
        update: { title: next.title, streamer: id, status: next.status ?? 'offline', streamKey: next.streamKey },
        create: {
          streamId: id,
          streamer: id,
          title: next.title ?? 'Untitled',
          status: next.status ?? 'offline',
          streamKey: next.streamKey
        }
      });
    } catch (err) {
      this.logger.warn('updateMeta prisma failed', err as any);
    }
    await this.persistStream(next);
    return next;
  }

  listViewers(streamId: string) {
    return Array.from(this.viewers.get(streamId) ?? []);
  }

  addViewer(streamId: string, viewer: string) {
    const set = this.viewers.get(streamId) ?? new Set<string>();
    set.add(viewer);
    this.viewers.set(streamId, set);
    const meta = this.streams.get(streamId);
    if (meta) {
      meta.viewerCount = set.size;
      this.streams.set(streamId, meta);
      // persist viewer count without blocking
      void this.persistStream(meta);
    }
  }

  removeViewer(streamId: string, viewer: string) {
    const set = this.viewers.get(streamId);
    if (set) {
      set.delete(viewer);
      this.viewers.set(streamId, set);
      const meta = this.streams.get(streamId);
      if (meta) {
        meta.viewerCount = set.size;
        this.streams.set(streamId, meta);
        void this.persistStream(meta);
      }
    }
  }

  async related(streamId: string, take = 4): Promise<StreamMeta[]> {
    const active = await this.findActive();
    return active.filter(s => (s.streamer || s.id) !== streamId).slice(0, take);
  }

  async streamsForUser(username: string) {
    const all = Array.from(this.streams.values()).filter(s => s.streamer === username);
    if (all.length) return all;
    try {
      const rows = await prisma.stream.findMany({ where: { streamer: username } });
      return rows.map(r => this.mapStream({ ...r, streamId: r.streamId ?? r.streamer }));
    } catch {
      return [];
    }
  }

  async setStatusByKey(streamKey: string, status: 'online' | 'offline') {
    const stream = await this.findByStreamKey(streamKey);
    if (!stream) return null;
    const hlsBase = process.env.MEDIA_HLS_BASE_URL || '';
    const normalizedBase = hlsBase.endsWith('/') ? hlsBase.slice(0, -1) : hlsBase;
    const playbackUrl = stream.playbackUrl || (normalizedBase ? `${normalizedBase}/${streamKey}/index.m3u8` : undefined);
    return this.updateMeta(stream.streamer, { status, playbackUrl });
  }

  private mapStream(data: any): StreamMeta {
    return {
      id: data.streamId ?? data.streamer ?? data.id,
      streamer: data.streamer ?? data.streamId ?? data.id,
      title: data.title,
      description: data.description,
      status: (data.status as StreamMeta['status']) ?? 'offline',
      streamKey: data.streamKey,
      playbackUrl: data.playbackUrl,
      screenPlaybackUrl: data.screenPlaybackUrl,
      cameraPlaybackUrl: data.cameraPlaybackUrl,
      webrtcPlaybackUrl: data.webrtcPlaybackUrl,
      screenWebrtcPlaybackUrl: data.screenWebrtcPlaybackUrl,
      cameraWebrtcPlaybackUrl: data.cameraWebrtcPlaybackUrl,
      cloudflareCustomerCode: data.cloudflareCustomerCode,
      cloudflareScreenInputId: data.cloudflareScreenInputId,
      cloudflareCameraInputId: data.cloudflareCameraInputId,
      sourceMode: data.sourceMode,
      thumbnail: data.thumbnail,
      tags: data.tags,
      viewerCount: data.viewerCount,
      tips: data.tips
    };
  }

  private async persistStream(meta: StreamMeta) {
    await mongoUpsertStream({
      streamId: meta.id,
      streamer: meta.streamer,
      title: meta.title,
      description: meta.description,
      status: meta.status,
      streamKey: meta.streamKey,
      playbackUrl: meta.playbackUrl,
      screenPlaybackUrl: meta.screenPlaybackUrl,
      cameraPlaybackUrl: meta.cameraPlaybackUrl,
      webrtcPlaybackUrl: meta.webrtcPlaybackUrl,
      screenWebrtcPlaybackUrl: meta.screenWebrtcPlaybackUrl,
      cameraWebrtcPlaybackUrl: meta.cameraWebrtcPlaybackUrl,
      cloudflareCustomerCode: meta.cloudflareCustomerCode,
      cloudflareScreenInputId: meta.cloudflareScreenInputId,
      cloudflareCameraInputId: meta.cloudflareCameraInputId,
      sourceMode: meta.sourceMode,
      thumbnail: meta.thumbnail,
      tags: meta.tags,
      viewerCount: meta.viewerCount
    });
  }
}

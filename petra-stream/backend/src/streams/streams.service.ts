import { Injectable } from '@nestjs/common';
import prisma from '../prisma/client';

@Injectable()
export class StreamsService {
  // lightweight in-memory cache + DB fallback
  private streams = new Map<string, any>();

  findActive() {
    return Array.from(this.streams.values()).filter(s => s.status === 'online');
  }

  findById(id: string) {
    return this.streams.get(id) ?? null;
  }

  async findTips(streamId: string, limit = 50) {
    return prisma.tip.findMany({
      where: { streamId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  addTipToCache(streamId: string, tip: any) {
    // keep a small in-memory representation for quick UI reads
    const arr = (this.streams.get(streamId)?.tips ?? []);
    arr.unshift(tip);
    this.streams.set(streamId, { ...(this.streams.get(streamId) ?? {}), tips: arr.slice(0, 200) });
  }
}

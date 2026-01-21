import { Injectable, Logger } from '@nestjs/common';
import { mongoFindUser, mongoListNotifications, mongoSaveNotification } from '../db/mongo';
import { NotificationsGateway } from '../gateway/notifications.gateway';

export type NotificationKind = 'tip' | 'system' | 'stream' | 'follow' | 'mention' | 'reply';

export type NotificationItem = {
  id: string;
  user?: string;
  title: string;
  description?: string;
  kind: NotificationKind;
  ts: number;
};

type NotificationInput = Omit<NotificationItem, 'id' | 'ts'> & {
  id?: string;
  ts?: number;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private cache = new Map<string, NotificationItem[]>();
  private followersIndex = new Map<string, Set<string>>();
  private readonly maxCache = 200;

  constructor(private readonly gateway: NotificationsGateway) {}

  async addNotification(user: string, input: NotificationInput): Promise<NotificationItem> {
    const ts = typeof input.ts === 'number' ? input.ts : Date.now();
    const item: NotificationItem = {
      id: input.id || `n-${input.kind}-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      user,
      title: input.title,
      description: input.description,
      kind: input.kind,
      ts
    };

    const arr = this.cache.get(user) ?? [];
    const next = [item, ...arr].slice(0, this.maxCache);
    this.cache.set(user, next);
    this.gateway.notifyUser(user, item);

    try {
      await mongoSaveNotification({
        user,
        title: item.title,
        description: item.description,
        kind: item.kind,
        ts: item.ts
      });
    } catch (err) {
      this.logger.debug('mongoSaveNotification failed', err as any);
    }

    return item;
  }

  async listForUser(user: string, limit = 20): Promise<NotificationItem[]> {
    const cached = this.cache.get(user);
    if (cached && cached.length) {
      return cached.slice(0, limit);
    }
    try {
      const mongo = await mongoListNotifications(user, limit);
      if (mongo.length) {
        const normalized = mongo.map((m) => ({
          id: `n-${m.kind}-${m.ts}-${Math.random().toString(36).slice(2, 6)}`,
          user: m.user,
          title: m.title,
          description: m.description,
          kind: (m.kind as NotificationKind) || 'system',
          ts: m.ts
        }));
        this.cache.set(user, normalized);
        return normalized.slice(0, limit);
      }
    } catch (err) {
      this.logger.debug('mongoListNotifications failed', err as any);
    }
    return [];
  }

  recordFollow(target: string, follower: string, follow: boolean) {
    const set = this.followersIndex.get(target) ?? new Set<string>();
    if (follow) set.add(follower);
    else set.delete(follower);
    this.followersIndex.set(target, set);
  }

  async listFollowers(target: string): Promise<string[]> {
    const cached = this.followersIndex.get(target);
    if (cached && cached.size) {
      return Array.from(cached);
    }
    try {
      const mongoUser = await mongoFindUser(target);
      if (mongoUser?.followers && Array.isArray(mongoUser.followers)) {
        const set = new Set<string>(mongoUser.followers);
        this.followersIndex.set(target, set);
        return Array.from(set);
      }
    } catch (err) {
      this.logger.debug('mongoFindUser for followers failed', err as any);
    }
    return [];
  }

  async notifyFollow(target: string, follower: string) {
    if (!target || !follower || target === follower) return;
    await this.addNotification(target, {
      title: 'New follower',
      description: `${follower} started following you.`,
      kind: 'follow'
    });
  }

  async notifyStreamStatus(streamer: string, status: 'online' | 'offline', title?: string) {
    if (!streamer) return;
    const followers = await this.listFollowers(streamer);
    if (!followers.length) return;
    const label = status === 'online' ? 'Stream started' : 'Stream ended';
    const desc =
      status === 'online'
        ? `${streamer} is live${title ? `: ${title}` : ''}.`
        : `${streamer} went offline.`;
    await Promise.all(
      followers.map((follower) =>
        this.addNotification(follower, {
          title: label,
          description: desc,
          kind: 'stream'
        })
      )
    );
  }

  async notifyMention(target: string, from: string, text: string, streamId?: string) {
    if (!target || !from || target === from) return;
    const suffix = streamId ? ` in ${streamId}` : '';
    await this.addNotification(target, {
      title: 'Mentioned in chat',
      description: `${from} mentioned you${suffix}: "${text.slice(0, 140)}"`,
      kind: 'mention'
    });
  }

  async notifyReply(target: string, from: string, text: string, streamId?: string) {
    if (!target || !from || target === from) return;
    const suffix = streamId ? ` in ${streamId}` : '';
    await this.addNotification(target, {
      title: 'Reply received',
      description: `${from} replied${suffix}: "${text.slice(0, 140)}"`,
      kind: 'reply'
    });
  }

  async notifyTip(target: string, from: string, amount: string, token?: string) {
    if (!target || !from) return;
    const suffix = token ? ` ${token}` : '';
    await this.addNotification(target, {
      title: 'Tip received',
      description: `${from} tipped ${amount}${suffix}`,
      kind: 'tip'
    });
  }
}

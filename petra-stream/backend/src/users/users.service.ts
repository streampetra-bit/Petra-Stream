import { Injectable, Logger } from '@nestjs/common';
import { StreamsService } from '../streams/streams.service';
import prisma from '../prisma/client';
import { mongoFindUser, mongoToggleFollow, mongoUpsertUser } from '../db/mongo';
import { NotificationsService } from '../notifications/notifications.service';

export type UserProfile = {
  username: string;
  displayName?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  followers?: number;
  following?: number;
  isLive?: boolean;
  address?: string;
};

@Injectable()
export class UsersService {
  private users = new Map<string, UserProfile>();
  private followIndex = new Map<string, boolean>();
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly streamsService: StreamsService,
    private readonly notifications: NotificationsService
  ) {}

  async getUser(username: string): Promise<UserProfile | null> {
    const cached = this.users.get(username);
    if (cached) return cached;

    const prismaUser = await this.findPrismaUser(username);
    const mongoKey = prismaUser?.username ?? prismaUser?.address ?? username;
    const mongoUser = await mongoFindUser(mongoKey);
    if (prismaUser) {
      const profile = this.mergeUser(prismaUser, mongoUser);
      this.users.set(profile.username, profile);
      return profile;
    }
    if (mongoUser) {
      const profile = this.mapMongoUser(mongoUser);
      this.users.set(profile.username, profile);
      return profile;
    }

    // fallback placeholder
    const fromStream = await this.streamsService.findById(username);
    if (fromStream) {
      const profile = this.mapMongoUser({
        username,
        displayName: username,
        bio: 'Stream on Petra',
        followers: [],
        following: []
      });
      this.users.set(username, profile);
      return profile;
    }

    return null;
  }

  async updateUser(username: string, data: Partial<UserProfile>) {
    const existing = (await this.getUser(username)) ?? { username };
    const next: UserProfile = { ...existing, ...data };
    this.users.set(username, next);
    try {
      await this.upsertPrismaUser(username, next);
      await mongoUpsertUser({
        username,
        displayName: next.displayName,
        bio: next.bio,
        avatar: next.avatar
      });
    } catch (err) {
      this.logger.warn('updateUser mongo failed', err as any);
    }
    return next;
  }

  async follow(username: string, target: string) {
    if (await this.isFollowing(username, target)) {
      return { ok: true, following: true };
    }
    // optimistic local update
    const me = (await this.getUser(username)) ?? { username, followers: 0, following: 0 };
    const tgt = (await this.getUser(target)) ?? { username: target, followers: 0, following: 0 };
    me.following = (me.following ?? 0) + 1;
    tgt.followers = (tgt.followers ?? 0) + 1;
    this.users.set(username, me);
    this.users.set(target, tgt);
    this.followIndex.set(`${username}:${target}`, true);
    this.notifications.recordFollow(target, username, true);
    try {
      await mongoToggleFollow(username, target, true);
    } catch (err) {
      this.logger.warn('follow mongo failed', err as any);
    }
    await this.notifications.notifyFollow(target, username);
    return { ok: true, following: true };
  }

  async unfollow(username: string, target: string) {
    if (!(await this.isFollowing(username, target))) {
      return { ok: true, following: false };
    }
    const me = (await this.getUser(username)) ?? { username, followers: 0, following: 0 };
    const tgt = (await this.getUser(target)) ?? { username: target, followers: 0, following: 0 };
    me.following = Math.max(0, (me.following ?? 0) - 1);
    tgt.followers = Math.max(0, (tgt.followers ?? 0) - 1);
    this.users.set(username, me);
    this.users.set(target, tgt);
    this.followIndex.set(`${username}:${target}`, false);
    this.notifications.recordFollow(target, username, false);
    try {
      await mongoToggleFollow(username, target, false);
    } catch (err) {
      this.logger.warn('unfollow mongo failed', err as any);
    }
    return { ok: true, following: false };
  }

  async isFollowing(username: string, target: string): Promise<boolean> {
    const key = `${username}:${target}`;
    if (this.followIndex.has(key)) {
      return Boolean(this.followIndex.get(key));
    }
    try {
      const mongoUser = await mongoFindUser(username);
      if (mongoUser && Array.isArray(mongoUser.following)) {
        const follows = mongoUser.following.includes(target);
        this.followIndex.set(key, follows);
        return follows;
      }
    } catch (err) {
      this.logger.warn('isFollowing mongo failed', err as any);
    }
    return false;
  }

  async listStreams(username: string) {
    return this.streamsService.streamsForUser(username);
  }

  private mapMongoUser(raw: any): UserProfile {
    return {
      username: raw.username,
      displayName: raw.displayName ?? raw.username,
      bio: raw.bio,
      avatar: raw.avatar,
      followers: Array.isArray(raw.followers) ? raw.followers.length : raw.followers ?? 0,
      following: Array.isArray(raw.following) ? raw.following.length : raw.following ?? 0,
      isLive: false,
      address: raw.username
    };
  }

  private mapPrismaUser(raw: any, fallbackId?: string): UserProfile {
    const identifier = raw?.username || raw?.address || raw?.id || fallbackId || 'user';
    return {
      username: raw?.username || raw?.address || raw?.id || identifier,
      displayName: raw?.displayName || raw?.username || raw?.address || identifier,
      email: raw?.email,
      bio: raw?.bio,
      avatar: raw?.avatar,
      followers: 0,
      following: 0,
      isLive: false,
      address: raw?.address
    };
  }

  private mergeUser(prismaUser: any, mongoUser?: any): UserProfile {
    const base = this.mapPrismaUser(prismaUser);
    if (!mongoUser) return base;
    return {
      ...base,
      displayName: base.displayName || mongoUser.displayName,
      bio: base.bio ?? mongoUser.bio,
      avatar: base.avatar ?? mongoUser.avatar,
      followers: Array.isArray(mongoUser.followers) ? mongoUser.followers.length : mongoUser.followers ?? base.followers,
      following: Array.isArray(mongoUser.following) ? mongoUser.following.length : mongoUser.following ?? base.following
    };
  }

  private async findPrismaUser(identifier: string) {
    try {
      return await prisma.user.findFirst({
        where: {
          OR: [
            { id: identifier },
            { username: identifier },
            { address: identifier },
            { email: identifier }
          ]
        }
      });
    } catch (err) {
      this.logger.warn('findPrismaUser failed', err as any);
      return null;
    }
  }

  private async upsertPrismaUser(identifier: string, data: UserProfile) {
    try {
      const existing = await this.findPrismaUser(identifier);
      if (existing?.id) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            displayName: data.displayName,
            bio: data.bio,
            avatar: data.avatar
          }
        });
        return;
      }
      const isAddress = /^0x[a-fA-F0-9]{40}$/.test(identifier);
      await prisma.user.create({
        data: {
          username: isAddress ? undefined : identifier,
          address: isAddress ? identifier : undefined,
          displayName: data.displayName ?? identifier,
          bio: data.bio,
          avatar: data.avatar
        }
      });
    } catch (err) {
      this.logger.warn('upsertPrismaUser failed', err as any);
    }
  }
}

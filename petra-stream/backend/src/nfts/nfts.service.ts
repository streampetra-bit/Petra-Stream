import { Injectable, Logger } from '@nestjs/common';
import prisma from '../prisma/client';

type CreateNftInput = {
  tokenId?: string;
  contract?: string;
  creatorAddress?: string;
  creatorName?: string;
  title?: string;
  tokenUri?: string;
  coverUrl?: string;
  mediaUrl?: string;
  txHash?: string;
};

@Injectable()
export class NftsService {
  private readonly logger = new Logger(NftsService.name);

  async list(options: { limit?: number; creator?: string }) {
    const limit = options.limit ?? 24;
    const creator = options.creator?.toLowerCase();
    return prisma.clipNft.findMany({
      where: creator ? { creatorAddress: creator } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async create(input: CreateNftInput, identity?: { address?: string; username?: string }) {
    if (!input?.txHash) {
      throw new Error('Missing txHash');
    }
    if (!input?.title) {
      throw new Error('Missing title');
    }
    if (!input?.tokenUri) {
      throw new Error('Missing tokenUri');
    }

    const creatorAddress =
      input.creatorAddress ||
      identity?.address ||
      identity?.username ||
      'unknown';

    return prisma.clipNft.upsert({
      where: { txHash: input.txHash },
      update: {
        tokenId: input.tokenId,
        contract: input.contract || '',
        creatorAddress: creatorAddress.toLowerCase(),
        creatorName: input.creatorName || null,
        title: input.title,
        tokenUri: input.tokenUri,
        coverUrl: input.coverUrl || null,
        mediaUrl: input.mediaUrl || null
      },
      create: {
        tokenId: input.tokenId,
        contract: input.contract || '',
        creatorAddress: creatorAddress.toLowerCase(),
        creatorName: input.creatorName || null,
        title: input.title,
        tokenUri: input.tokenUri,
        coverUrl: input.coverUrl || null,
        mediaUrl: input.mediaUrl || null,
        txHash: input.txHash
      }
    });
  }
}

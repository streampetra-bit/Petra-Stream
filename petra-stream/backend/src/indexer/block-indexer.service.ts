import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketProvider, JsonRpcProvider, Interface } from 'ethers';
import prisma from '../prisma/client';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { StreamsService } from '../streams/streams.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BlockIndexerService implements OnModuleInit {
  private readonly logger = new Logger(BlockIndexerService.name);
  // keep provider as a loose type to avoid strict typing issues with different ethers exports
  private provider: WebSocketProvider | JsonRpcProvider | any;
  private ifaceRegistry!: Interface;
  private ifaceVault!: Interface;
  private ifaceMarketplace!: Interface;
  private enabled = true;

  constructor(
    private readonly notifications: NotificationsGateway,
    private readonly streamsService: StreamsService,
    private readonly notificationsService: NotificationsService
  ) {
    // prefer explicit Somnia endpoints; skip if not configured
    const wsOrHttp =
      process.env.SOMNIA_WS ||
      process.env.SOMNIA_TEST_WS ||
      process.env.SOMNIA_HTTP ||
      process.env.SOMNIA_TEST_HTTP ||
      process.env.SOMNIA_RPC_URL ||
      '';

    const isProduction = process.env.NODE_ENV === 'production';
    if (!wsOrHttp) {
      this.enabled = false;
      this.logger.warn('Block indexer disabled: no Somnia RPC configured');
      return;
    }
    if (isProduction && /localhost|127\.0\.0\.1/.test(wsOrHttp)) {
      this.enabled = false;
      this.logger.warn(`Block indexer disabled: invalid RPC for production (${wsOrHttp})`);
      return;
    }

    if (wsOrHttp.startsWith('ws')) {
      this.provider = new WebSocketProvider(wsOrHttp);
      const socket = (this.provider as any)._websocket || (this.provider as any).websocket;
      if (socket?.on) {
        socket.on('error', (err: any) => {
          this.logger.warn(`Indexer websocket error: ${err?.message || err}`);
        });
        socket.on('close', () => {
          this.logger.warn('Indexer websocket closed');
        });
      }
    } else {
      this.provider = new JsonRpcProvider(wsOrHttp);
    }

    // ABI fragments for events we care about
    this.ifaceRegistry = new Interface([
      'event StreamerRegistered(address indexed streamer, string metadataURI)'
    ]);

    this.ifaceVault = new Interface([
      'event TipReceived(address indexed from, address indexed to, address token, uint256 amount, uint256 netAmount, bytes32 memo)',
      'event NFTGift(address indexed from, address indexed to, address nft, uint256 tokenId)'
    ]);

    this.ifaceMarketplace = new Interface([
      'event ListingCreated(uint256 indexed tokenId, address indexed seller, uint256 price)',
      'event ListingCancelled(uint256 indexed tokenId, address indexed seller)',
      'event ListingPurchased(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)'
    ]);
  }

  async onModuleInit() {
    if (!this.enabled || !this.provider) {
      return;
    }
    this.logger.log('Block indexer starting, subscribing to logs...');

    const registryAddress = process.env.REGISTRY_ADDRESS;
    const vaultAddress = process.env.VAULT_ADDRESS;
    const marketplaceAddress = process.env.CLIP_MARKETPLACE_ADDRESS;

    if (registryAddress) {
      // explicitly type log as `any` here to avoid implicit any / wrong namespace type usage
      this.provider.on({ address: registryAddress }, (log: any) => this.handleLog(log, 'registry'));
      this.logger.log(`Subscribed to registry logs: ${registryAddress}`);
    }

    if (vaultAddress) {
      this.provider.on({ address: vaultAddress }, (log: any) => this.handleLog(log, 'vault'));
      this.logger.log(`Subscribed to vault logs: ${vaultAddress}`);
    }

    if (marketplaceAddress) {
      this.provider.on({ address: marketplaceAddress }, (log: any) =>
        this.handleLog(log, 'marketplace')
      );
      this.logger.log(`Subscribed to marketplace logs: ${marketplaceAddress}`);
    }
  }

  // Use `any` for the log parameter type to avoid depending on a specific ethers namespace type
  private async handleLog(log: any, source: 'registry' | 'vault' | 'marketplace') {
    try {
      const iface =
        source === 'registry'
          ? this.ifaceRegistry
          : source === 'vault'
            ? this.ifaceVault
            : this.ifaceMarketplace;

      let parsed: ReturnType<Interface['parseLog']> | null = null;
      try {
        parsed = iface.parseLog(log);
      } catch (parseErr) {
        // Not all logs on the contract will match our ABI fragment; ignore parse failures
        this.logger.debug('Log did not match ABI fragment or parse failed');
        return;
      }

      if (!parsed) return;
      // now parsed is non-null
      this.logger.debug(`Parsed event ${parsed.name}`, parsed.args);

      if (parsed.name === 'TipReceived') {
        const args: any = parsed.args;
        const [from, to, token, amount, netAmount, memo] = args;

        const tipAmountRaw = BigInt(netAmount.toString());
        const feeBps = Number(process.env.TIP_FEE_BPS ?? 300);
        const fee = (tipAmountRaw * BigInt(Math.max(0, feeBps))) / 10000n;
        const creatorCredit = tipAmountRaw - fee;
        const treasury = process.env.TREASURY_ADDRESS || 'treasury';

        await prisma.tip.create({
          data: {
            txHash: log.transactionHash ?? '',
            from: from.toString(),
            to: to.toString(),
            streamId: to.toString(),
            token: token.toString(),
            amount: BigInt(tipAmountRaw.toString()),
            memo: typeof memo === 'string' ? memo : memo?.toString()
          }
        });

        await prisma.balance.upsert({
          where: { id: `${to.toString()}_${token.toString()}` },
          update: { amount: { increment: creatorCredit } as any },
          create: {
            id: `${to.toString()}_${token.toString()}`,
            address: to.toString(),
            token: token.toString(),
            amount: creatorCredit
          }
        });
        if (fee > 0n) {
          await prisma.balance.upsert({
            where: { id: `${treasury}_${token.toString()}` },
            update: { amount: { increment: fee } as any },
            create: {
              id: `${treasury}_${token.toString()}`,
              address: treasury,
              token: token.toString(),
              amount: fee
            }
          });
        }

        await this.streamsService.recordTip(to.toString(), {
          txHash: log.transactionHash,
          from: from.toString(),
          to: to.toString(),
          token: token.toString(),
          amount: tipAmountRaw.toString(),
          memo: memo?.toString?.()
        });

        // notify connected clients
        this.notifications.notifyTip(to.toString(), {
          txHash: log.transactionHash,
          from: from.toString(),
          to: to.toString(),
          token: token.toString(),
          amount: netAmount.toString()
        });
        void this.notificationsService.notifyTip(
          to.toString(),
          from.toString(),
          netAmount.toString(),
          token.toString()
        );
      }

      if (parsed.name === 'NFTGift') {
        const args: any = parsed.args;
        const [from, to, nft, tokenId] = args;

        await prisma.tip.create({
          data: {
            txHash: log.transactionHash ?? '',
            from: from.toString(),
            to: to.toString(),
            streamId: to.toString(),
            token: nft.toString(),
            amount: BigInt(0),
            memo: `nft:${tokenId.toString()}`
          }
        });

        await this.streamsService.recordTip(to.toString(), {
          txHash: log.transactionHash,
          from: from.toString(),
          to: to.toString(),
          token: nft.toString(),
          amount: '0',
          memo: `nft:${tokenId.toString()}`
        });

        this.notifications.notifyTip(to.toString(), {
          txHash: log.transactionHash,
          from: from.toString(),
          to: to.toString(),
          token: nft.toString(),
          tokenId: tokenId.toString(),
          kind: 'nft'
        });
        void this.notificationsService.notifyTip(
          to.toString(),
          from.toString(),
          `NFT ${tokenId.toString()}`,
          nft.toString()
        );
      }

      if (parsed.name === 'ListingCreated') {
        const args: any = parsed.args;
        const [tokenId, seller, price] = args;
        const tokenIdValue = tokenId.toString();
        const sellerAddress = seller.toString().toLowerCase();
        const marketplace = (log.address || '').toString().toLowerCase();
        const nftContract = process.env.CLIP_NFT_ADDRESS?.toLowerCase() || null;
        const priceWei = BigInt(price.toString());

        await prisma.clipListing.upsert({
          where: {
            marketplace_tokenId: {
              marketplace,
              tokenId: tokenIdValue
            }
          },
          update: {
            seller: sellerAddress,
            buyer: null,
            price: priceWei,
            status: 'listed',
            txHash: log.transactionHash ?? '',
            nftContract
          },
          create: {
            marketplace,
            tokenId: tokenIdValue,
            seller: sellerAddress,
            price: priceWei,
            status: 'listed',
            txHash: log.transactionHash ?? '',
            nftContract
          }
        });
      }

      if (parsed.name === 'ListingCancelled') {
        const args: any = parsed.args;
        const [tokenId, seller] = args;
        const tokenIdValue = tokenId.toString();
        const sellerAddress = seller.toString().toLowerCase();
        const marketplace = (log.address || '').toString().toLowerCase();
        const nftContract = process.env.CLIP_NFT_ADDRESS?.toLowerCase() || null;

        await prisma.clipListing.upsert({
          where: {
            marketplace_tokenId: {
              marketplace,
              tokenId: tokenIdValue
            }
          },
          update: {
            seller: sellerAddress,
            buyer: null,
            price: BigInt(0),
            status: 'cancelled',
            txHash: log.transactionHash ?? '',
            nftContract
          },
          create: {
            marketplace,
            tokenId: tokenIdValue,
            seller: sellerAddress,
            price: BigInt(0),
            status: 'cancelled',
            txHash: log.transactionHash ?? '',
            nftContract
          }
        });
      }

      if (parsed.name === 'ListingPurchased') {
        const args: any = parsed.args;
        const [tokenId, seller, buyer, price] = args;
        const tokenIdValue = tokenId.toString();
        const sellerAddress = seller.toString().toLowerCase();
        const buyerAddress = buyer.toString().toLowerCase();
        const marketplace = (log.address || '').toString().toLowerCase();
        const nftContract = process.env.CLIP_NFT_ADDRESS?.toLowerCase() || null;
        const priceWei = BigInt(price.toString());

        await prisma.clipListing.upsert({
          where: {
            marketplace_tokenId: {
              marketplace,
              tokenId: tokenIdValue
            }
          },
          update: {
            seller: sellerAddress,
            buyer: buyerAddress,
            price: priceWei,
            status: 'sold',
            txHash: log.transactionHash ?? '',
            nftContract
          },
          create: {
            marketplace,
            tokenId: tokenIdValue,
            seller: sellerAddress,
            buyer: buyerAddress,
            price: priceWei,
            status: 'sold',
            txHash: log.transactionHash ?? '',
            nftContract
          }
        });
      }
    } catch (err: unknown) {
      // err may be unknown type — normalize safely for logging
      const message = (err && (err as any).message) ? (err as any).message : String(err);
      this.logger.debug('Non-matching log or parse error', message);
    }
  }
}

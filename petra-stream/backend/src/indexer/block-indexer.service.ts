import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketProvider, JsonRpcProvider, Interface } from 'ethers';
import prisma from '../prisma/client';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { StreamsService } from '../streams/streams.service';

@Injectable()
export class BlockIndexerService implements OnModuleInit {
  private readonly logger = new Logger(BlockIndexerService.name);
  // keep provider as a loose type to avoid strict typing issues with different ethers exports
  private provider: WebSocketProvider | JsonRpcProvider | any;
  private ifaceRegistry: Interface;
  private ifaceVault: Interface;

  constructor(
    private readonly notifications: NotificationsGateway,
    private readonly streamsService: StreamsService
  ) {
    // prefer explicit Somnia endpoints, then fall back to local
    const wsOrHttp =
      process.env.SOMNIA_WS ||
      process.env.SOMNIA_TEST_WS ||
      process.env.SOMNIA_HTTP ||
      process.env.SOMNIA_TEST_HTTP ||
      process.env.SOMNIA_RPC_URL ||
      'ws://127.0.0.1:8545';

    if (wsOrHttp.startsWith('ws')) {
      this.provider = new WebSocketProvider(wsOrHttp);
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
  }

  async onModuleInit() {
    this.logger.log('Block indexer starting, subscribing to logs...');

    const registryAddress = process.env.REGISTRY_ADDRESS;
    const vaultAddress = process.env.VAULT_ADDRESS;

    if (registryAddress) {
      // explicitly type log as `any` here to avoid implicit any / wrong namespace type usage
      this.provider.on({ address: registryAddress }, (log: any) => this.handleLog(log, 'registry'));
      this.logger.log(`Subscribed to registry logs: ${registryAddress}`);
    }

    if (vaultAddress) {
      this.provider.on({ address: vaultAddress }, (log: any) => this.handleLog(log, 'vault'));
      this.logger.log(`Subscribed to vault logs: ${vaultAddress}`);
    }
  }

  // Use `any` for the log parameter type to avoid depending on a specific ethers namespace type
  private async handleLog(log: any, source: 'registry' | 'vault') {
    try {
      const iface = source === 'registry' ? this.ifaceRegistry : this.ifaceVault;

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

        await prisma.tip.create({
          data: {
            txHash: log.transactionHash ?? '',
            from: from.toString(),
            to: to.toString(),
            streamId: to.toString(),
            token: token.toString(),
            amount: BigInt(amount.toString()),
            memo: typeof memo === 'string' ? memo : memo?.toString()
          }
        });

        await prisma.balance.upsert({
          where: { id: `${to.toString()}_${token.toString()}` },
          update: { amount: { increment: BigInt(netAmount.toString()) } as any },
          create: {
            id: `${to.toString()}_${token.toString()}`,
            address: to.toString(),
            token: token.toString(),
            amount: BigInt(netAmount.toString())
          }
        });

        await this.streamsService.recordTip(to.toString(), {
          txHash: log.transactionHash,
          from: from.toString(),
          to: to.toString(),
          token: token.toString(),
          amount: netAmount.toString(),
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
      }
    } catch (err: unknown) {
      // err may be unknown type — normalize safely for logging
      const message = (err && (err as any).message) ? (err as any).message : String(err);
      this.logger.debug('Non-matching log or parse error', message);
    }
  }
}

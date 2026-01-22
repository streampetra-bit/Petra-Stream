import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get('balance')
  async balance(@Req() req: any) {
    const identity = this.resolveIdentity(req);
    const snapshot = await this.wallet.getSnapshot(identity);
    return {
      address: snapshot.address,
      token: snapshot.token,
      tokenAddress: snapshot.tokenAddress,
      symbol: snapshot.symbol,
      decimals: snapshot.decimals,
      balanceRaw: snapshot.balanceRaw.toString(),
      balance: snapshot.balance,
      minWithdrawRaw: snapshot.minWithdrawRaw.toString(),
      minWithdraw: snapshot.minWithdraw,
      tipFeeBps: snapshot.tipFeeBps,
      withdrawFeeBps: snapshot.withdrawFeeBps,
      registered: snapshot.registered,
      source: snapshot.source,
      withdrawMode: snapshot.withdrawMode,
      vaultAddress: snapshot.vaultAddress
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  async withdraw(@Req() req: any, @Body('amount') amount: string) {
    const identity = this.resolveIdentity(req);
    return this.wallet.withdraw(identity, amount);
  }

  private resolveIdentity(req: any): string {
    const user = req?.user;
    return (
      user?.address ||
      user?.username ||
      user?.userId ||
      user?.id ||
      process.env.DEFAULT_STREAMER ||
      'demo-user'
    );
  }
}

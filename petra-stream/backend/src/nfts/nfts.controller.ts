import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NftsService } from './nfts.service';

@Controller('api/nfts')
export class NftsController {
  constructor(private readonly nfts: NftsService) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('creator') creator?: string) {
    const take = limit ? Number(limit) : undefined;
    return this.nfts.list({ limit: take, creator });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.nfts.create(body, req?.user);
  }
}

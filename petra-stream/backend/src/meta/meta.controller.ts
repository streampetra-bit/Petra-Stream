import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class MetaController {
  @Get('categories')
  categories() {
    return { data: [
      { id: 'gaming', label: 'Gaming' },
      { id: 'music', label: 'Music' },
      { id: 'art', label: 'Art' },
      { id: 'tech', label: 'Tech' },
      { id: 'finance', label: 'Finance' }
    ] };
  }

  @Get('trending')
  trending() {
    return { data: ['chill', 'onchain', 'live-coding', 'music', 'nft'] };
  }

  @Get('creator/stats')
  creatorStats() {
    return { viewers: 12, tips: 3, earnings: 1.24 };
  }
}

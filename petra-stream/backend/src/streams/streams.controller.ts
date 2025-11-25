import { Controller, Get, Param, Query } from '@nestjs/common';
import { StreamsService } from './streams.service';

@Controller('api/streams')
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

  @Get('active')
  findActive() {
    return this.streams.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streams.findById(id);
  }

  @Get(':id/tips')
  findTips(@Param('id') id: string, @Query('limit') limit = 50) {
    return this.streams.findTips(id, Number(limit));
  }
}

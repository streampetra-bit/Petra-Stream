import { Module } from '@nestjs/common';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';
import { CloudflareStreamService } from './cloudflare-stream.service';
import { CloudflareWebhookController } from './cloudflare-webhook.controller';
import { CloudflarePollingService } from './cloudflare-polling.service';

@Module({
  controllers: [StreamsController, CloudflareWebhookController],
  providers: [StreamsService, CloudflareStreamService, CloudflarePollingService],
  exports: [StreamsService]
})
export class StreamsModule {}

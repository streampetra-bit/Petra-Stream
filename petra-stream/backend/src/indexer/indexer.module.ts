import { Module } from '@nestjs/common';
import { BlockIndexerService } from './block-indexer.service';
import { StreamsModule } from '../streams/streams.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StreamsModule, NotificationsModule],
  providers: [BlockIndexerService],
  exports: [BlockIndexerService]
})
export class IndexerModule {}

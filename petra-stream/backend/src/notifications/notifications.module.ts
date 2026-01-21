import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { StreamsModule } from '../streams/streams.module';
import { NotificationsGateway } from '../gateway/notifications.gateway';

@Global()
@Module({
  imports: [StreamsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway]
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { StreamsModule } from '../streams/streams.module';

@Module({
  imports: [StreamsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService]
})
export class UsersModule {}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.users.getUser(id);
    return user ?? { username: id, displayName: id, bio: 'New user', followers: 0, following: 0, isLive: false };
  }

  @Get(':id/streams')
  streams(@Param('id') id: string) {
    return this.users.listStreams(id);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.users.updateUser(id, { displayName: body.displayName, bio: body.bio, avatar: body.avatar });
  }

  @Post(':id/follow')
  follow(@Param('id') id: string, @Body('follower') follower?: string) {
    const who = follower || 'demo-user';
    return this.users.follow(who, id);
  }
}

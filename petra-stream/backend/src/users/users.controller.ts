import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Req() req: any, @Param('id') id: string, @Body('action') action?: 'follow' | 'unfollow') {
    const who = this.resolveIdentity(req);
    if (action === 'unfollow') {
      return this.users.unfollow(who, id);
    }
    return this.users.follow(who, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/following')
  async following(@Req() req: any, @Param('id') id: string) {
    const who = this.resolveIdentity(req);
    const following = await this.users.isFollowing(who, id);
    return { following };
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

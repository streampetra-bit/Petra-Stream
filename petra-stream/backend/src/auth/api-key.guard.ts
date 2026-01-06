import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.STREAMER_API_KEY || process.env.ADMIN_PRIVATE_KEY || '';
    if (!apiKey) {
      // no key configured -> allow (dev default)
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const header = (req.headers['authorization'] as string) || '';
    const rawKey = (req.headers['x-api-key'] as string) || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const provided = rawKey || bearer;

    if (provided && provided === apiKey) return true;
    throw new UnauthorizedException('Invalid API key');
  }
}

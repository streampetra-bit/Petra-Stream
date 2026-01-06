import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = (req.headers['authorization'] as string) || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }

    try {
      const payload = jwt.verify(token, secret) as any;
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ethers } from 'ethers';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import prisma from '../prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  @Get('nonce')
  async nonce(@Query('address') address?: string) {
    if (!address) {
      throw new UnauthorizedException('Address is required');
    }
    const normalized = address.toLowerCase();
    const nonce = randomUUID();
    const message = `Sign in to Petra Stream\nAddress: ${normalized}\nNonce: ${nonce}`;

    await prisma.authNonce.upsert({
      where: { address: normalized },
      update: { nonce },
      create: { address: normalized, nonce }
    });

    return { address: normalized, nonce, message };
  }

  @Post('verify')
  async verify(@Req() req: any, @Body() body: { address?: string; signature?: string }) {
    const address = body.address?.toLowerCase();
    const signature = body.signature;

    if (!address || !signature) {
      throw new UnauthorizedException('Address and signature are required');
    }

    const nonceRow = await prisma.authNonce.findUnique({ where: { address } });
    if (!nonceRow) {
      throw new UnauthorizedException('Nonce missing or expired');
    }

    const message = `Sign in to Petra Stream\nAddress: ${address}\nNonce: ${nonceRow.nonce}`;
    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature).toLowerCase();
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }

    if (recovered !== address) {
      throw new UnauthorizedException('Signature does not match address');
    }

    // nonce is one-time use
    await prisma.authNonce.delete({ where: { address } }).catch(() => {});

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    const secretKey: Secret = secret;
    const expiresIn: SignOptions['expiresIn'] =
      (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d';

    const authHeader = req?.headers?.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let user = null as any;

    let decoded: any = null;
    if (bearer) {
      try {
        decoded = jwt.verify(bearer, secretKey);
      } catch {
        decoded = null;
      }
    }
    if (decoded?.userId) {
      const existing = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (existing) {
        const conflict = await prisma.user.findFirst({ where: { address } });
        if (conflict && conflict.id !== existing.id) {
          throw new UnauthorizedException('Wallet already linked to another account');
        }
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { address }
        });
      }
    }

    if (!user) {
      user = await prisma.user.upsert({
        where: { address },
        update: {},
        create: { address, displayName: address.slice(0, 10) }
      });
    }

    const token = jwt.sign({ address, userId: user?.id, username: user?.username }, secretKey, { expiresIn });
    return { token, address, expiresIn, user };
  }

  @Post('register')
  async register(@Body() body: { username?: string; email?: string; password?: string }) {
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || '';

    if (!username || !email || !password) {
      throw new UnauthorizedException('Username, email, and password are required');
    }
    if (password.length < 6) {
      throw new UnauthorizedException('Password must be at least 6 characters');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hash,
        displayName: username
      }
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    const secretKey: Secret = secret;
    const expiresIn: SignOptions['expiresIn'] =
      (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d';
    const token = jwt.sign({ userId: user.id, username: user.username, address: user.address }, secretKey, { expiresIn });
    return { token, user, expiresIn };
  }

  @Post('login')
  async login(@Body() body: { emailOrUsername?: string; password?: string }) {
    const emailOrUsername = body.emailOrUsername?.trim().toLowerCase();
    const password = body.password || '';
    if (!emailOrUsername || !password) {
      throw new UnauthorizedException('Email/username and password are required');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    const secretKey: Secret = secret;
    const expiresIn: SignOptions['expiresIn'] =
      (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d';
    const token = jwt.sign({ userId: user.id, username: user.username, address: user.address }, secretKey, { expiresIn });
    return { token, user, expiresIn };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const userId = req?.user?.userId;
    const address = req?.user?.address;
    if (!userId && !address) {
      throw new UnauthorizedException('Invalid token');
    }
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findFirst({ where: { address } });
    return { user };
  }
}

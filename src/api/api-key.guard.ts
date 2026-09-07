import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SEED_USER } from '@repository/in-memory/seed';
import { IS_PUBLIC_KEY } from './public.decorator';

interface RequestWithUserId {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
}

// Hashed-key lookup -> userId (1.overall-architecture.md, §7.1). There is no
// UserRepository for this take-home (User is schema-only) — the demo has exactly
// one tenant, seeded in storage/in-memory/seed.ts, so this compares directly
// against it rather than through a repository abstraction with one row in it.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const apiKey = request.headers['blotato-api-key'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new UnauthorizedException('Missing blotato-api-key header');
    }

    const hashed = createHash('sha256').update(apiKey).digest('hex');
    if (hashed !== SEED_USER.hashedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.userId = SEED_USER.id;
    return true;
  }
}

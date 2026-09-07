import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRepository } from '@repository/user.repository.contract';
import { USER_REPOSITORY } from '@repository/tokens';
import { IS_PUBLIC_KEY } from './public.decorator';

interface RequestWithUserId {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
}

// Hashed-key lookup -> userId (1.overall-architecture.md, §7.1). The presented key is
// hashed and matched against the stored hash through UserRepository, so this resolves
// whichever tenant owns the key rather than comparing against a single hardcoded one —
// the demo just happens to seed exactly one user (in-memory/seed.ts).
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const apiKey = request.headers['blotato-api-key'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new UnauthorizedException('Missing blotato-api-key header');
    }

    const hashed = createHash('sha256').update(apiKey).digest('hex');
    const user = await this.users.findByHashedApiKey(hashed);
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.userId = user.id;
    return true;
  }
}

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

interface RequestWithUserId {
  userId?: string;
}

// Reads what ApiKeyGuard attached to the request. Throwing if it's missing catches
// a controller that forgot the guard applies, rather than silently scoping to undefined.
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUserId>();
  if (!request.userId) {
    throw new Error('CurrentUserId used on a route without ApiKeyGuard');
  }
  return request.userId;
});

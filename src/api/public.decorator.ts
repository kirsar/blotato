import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Escape hatch from the global ApiKeyGuard (below) — health checks and the like
// need to answer with no API key at all.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

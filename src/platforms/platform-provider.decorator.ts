import { SetMetadata } from '@nestjs/common';
import type { PlatformId } from '@domain/platform-id';

export const PLATFORM_PROVIDER_METADATA = 'PLATFORM_PROVIDER_METADATA';

// Lets ProviderRegistry populate itself from metadata via DiscoveryService —
// nothing anywhere enumerates platforms by name or branches on platform === …
// (1.overall-architecture.md, "Iteration without naming").
export const PlatformProvider = (platform: PlatformId): ClassDecorator =>
  SetMetadata(PLATFORM_PROVIDER_METADATA, platform);

import { SetMetadata } from '@nestjs/common';
import type { PlatformId } from '@domain/platform-id';

export const POST_DTO_CONVERTER_METADATA = 'POST_DTO_CONVERTER_METADATA';

// Separate from @PlatformProvider — that one marks ICommentReader/ICommentWriter
// implementations, discovered by ProviderRegistry. This marks PostDtoConverter
// implementations, discovered by PostDtoConverterRegistry. Two decorators because a
// class could plausibly need to be discoverable as one without being the other, and
// because the two registries would otherwise have no way to tell their instances
// apart when scanning the same DiscoveryService.getProviders() list.
export const PostDtoConverterProvider = (platform: PlatformId): ClassDecorator =>
  SetMetadata(POST_DTO_CONVERTER_METADATA, platform);

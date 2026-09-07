import { Injectable, type OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { PlatformId } from '@domain/platform-id';
import type { PostDtoConverter } from './post-dto-converter.contract';
import { POST_DTO_CONVERTER_METADATA } from './post-dto-converter.decorator';

// Mirrors ProviderRegistry exactly (same discovery mechanism, same shape) — see that
// file's comments for the discovery reasoning. Kept as a separate class rather than
// folded into ProviderRegistry because the two hold different kinds of instances
// (ICommentReader/ICommentWriter vs. PostDtoConverter); merging them would mean
// one map serving two unrelated interfaces.
@Injectable()
export class PostDtoConverterRegistry implements OnModuleInit {
  private readonly converters = new Map<PlatformId, PostDtoConverter>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as PostDtoConverter | undefined;
      if (!instance || !instance.constructor) {
        continue;
      }
      const platform: PlatformId | undefined = Reflect.getMetadata(
        POST_DTO_CONVERTER_METADATA,
        instance.constructor,
      );
      if (platform) {
        this.converters.set(platform, instance);
      }
    }
  }

  get(platform: PlatformId): PostDtoConverter {
    const converter = this.converters.get(platform);
    if (!converter) {
      throw new UnprocessableEntityException(`No post DTO converter registered for platform: ${platform}`);
    }
    return converter;
  }
}

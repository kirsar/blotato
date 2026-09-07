import { Injectable, type OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { ICommentReader, ICommentWriter } from './comment-provider.contract';
import { PLATFORM_PROVIDER_METADATA } from './platform-provider.decorator';
import type { PlatformId } from '@domain/platform-id';

type Provider = ICommentReader & ICommentWriter;

@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly providers = new Map<PlatformId, Provider>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Provider | undefined;
      if (!instance || !instance.constructor) {
        continue;
      }
      const platform: PlatformId | undefined = Reflect.getMetadata(
        PLATFORM_PROVIDER_METADATA,
        instance.constructor,
      );
      if (platform) {
        this.providers.set(platform, instance);
      }
    }
  }

  reader(platform: PlatformId): ICommentReader {
    return this.get(platform);
  }

  writer(platform: PlatformId): ICommentWriter {
    return this.get(platform);
  }

  private get(platform: PlatformId): Provider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new UnprocessableEntityException(`No provider registered for platform: ${platform}`);
    }
    return provider;
  }
}

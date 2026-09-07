import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { InstagramModule } from './instagram/instagram.module';
import { YouTubeModule } from './youtube/youtube.module';
import { ProviderRegistry } from './provider-registry';

@Module({
  imports: [DiscoveryModule, InstagramModule, YouTubeModule],
  providers: [ProviderRegistry],
  // Re-exporting the child modules forwards their own exports (the extension
  // repository tokens CompositionService needs) to whatever imports PlatformsModule.
  exports: [ProviderRegistry, InstagramModule, YouTubeModule],
})
export class PlatformsModule {}

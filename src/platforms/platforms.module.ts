import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { InstagramModule } from './instagram/instagram.module';
import { YouTubeModule } from './youtube/youtube.module';
import { ProviderRegistry } from './provider/provider-registry';
import { PostDtoConverterRegistry } from './dto/post-dto-converter.registry';

// PostDtoConverterRegistry is why ApiRootModule now imports this whole module
// instead of InstagramModule/YouTubeModule directly — CompositionService needs it,
// and it needs DiscoveryService. That does mean ProviderRegistry (a worker-only
// concern — nothing in the web app calls a comment provider) is now also
// instantiated in the web process as a side effect of importing this module;
// harmless today (nothing calls it there), but worth a look once WorkerModule
// exists and this boundary matters for real.
@Module({
  imports: [DiscoveryModule, InstagramModule, YouTubeModule],
  providers: [ProviderRegistry, PostDtoConverterRegistry],
  // Re-exporting the child modules forwards their own exports (the extension
  // repository tokens CompositionService needs) to whatever imports PlatformsModule.
  exports: [ProviderRegistry, PostDtoConverterRegistry, InstagramModule, YouTubeModule],
})
export class PlatformsModule {}

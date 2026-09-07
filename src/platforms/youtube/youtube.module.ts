import { Module } from '@nestjs/common';
import { CredentialStoreModule } from '../credential-store.module';
import { YouTubeProvider } from './youtube.provider';
import { YouTubePostDtoConverter } from './youtube-post-dto.converter';
import { YOUTUBE_POST_REPOSITORY } from './youtube-post.repository.contract';
import { InMemoryYouTubePostRepository } from './youtube-post.repository';

@Module({
  imports: [CredentialStoreModule],
  providers: [
    { provide: YOUTUBE_POST_REPOSITORY, useClass: InMemoryYouTubePostRepository },
    YouTubeProvider,
    YouTubePostDtoConverter,
  ],
  exports: [YOUTUBE_POST_REPOSITORY],
})
export class YouTubeModule {}

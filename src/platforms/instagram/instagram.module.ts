import { Module } from '@nestjs/common';
import { CredentialStoreModule } from '../credential-store.module';
import { InstagramProvider } from './instagram.provider';
import { InstagramPostDtoConverter } from './instagram-post-dto.converter';
import { INSTAGRAM_POST_REPOSITORY } from './instagram-post.repository.contract';
import { InMemoryInstagramPostRepository } from './instagram-post.repository';

@Module({
  imports: [CredentialStoreModule],
  providers: [
    { provide: INSTAGRAM_POST_REPOSITORY, useClass: InMemoryInstagramPostRepository },
    InstagramProvider,
    InstagramPostDtoConverter,
  ],
  exports: [INSTAGRAM_POST_REPOSITORY],
})
export class InstagramModule {}

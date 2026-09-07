import { Module } from '@nestjs/common';
import { RepositoryModule } from '@repository/repository.module';
import { CREDENTIAL_STORE } from './credential-store.contract';
import { FakeCredentialStore } from './fake-credential-store';

// Sits below the platform modules so InstagramModule/YouTubeModule can depend on
// it without a circular import back from PlatformsModule (which needs to import
// them for discovery).
@Module({
  imports: [RepositoryModule],
  providers: [{ provide: CREDENTIAL_STORE, useClass: FakeCredentialStore }],
  exports: [CREDENTIAL_STORE],
})
export class CredentialStoreModule {}

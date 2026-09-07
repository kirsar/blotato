import { Controller, Get, Inject } from '@nestjs/common';
import type { AccountRepository } from '@repository/account.repository.contract';
import { ACCOUNT_REPOSITORY } from '@repository/tokens';
import { CurrentUserId } from '../current-user-id.decorator';
import { AccountResponseDto, toAccountResponse } from './account.dto';

@Controller('accounts')
export class AccountController {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  @Get()
  async getAll(@CurrentUserId() userId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.accounts.listByUserId(userId);
    return accounts.map(toAccountResponse);
  }
}

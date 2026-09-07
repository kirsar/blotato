import { Injectable } from '@nestjs/common';
import type { Composition } from '@domain/composition';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import { InMemoryRepository } from './in-memory-repository';

@Injectable()
export class InMemoryCompositionRepository
  extends InMemoryRepository<Composition>
  implements CompositionRepository
{
  constructor() {
    super((c) => c.id);
  }

  async create(composition: Composition): Promise<Composition> {
    return this.insert(composition);
  }

  async findById(id: string): Promise<Composition | null> {
    return super.findById(id);
  }

  async update(id: string, patch: Partial<Composition>): Promise<Composition> {
    return super.update(id, patch);
  }
}

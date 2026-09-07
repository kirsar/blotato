import type { Composition } from '@domain/composition';

export interface CompositionRepository {
  create(composition: Composition): Promise<Composition>;
  findById(id: string): Promise<Composition | null>;
  update(id: string, patch: Partial<Composition>): Promise<Composition>;
}

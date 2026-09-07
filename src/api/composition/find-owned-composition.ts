import { NotFoundException } from '@nestjs/common';
import type { Composition } from '@domain/composition';
import type { CompositionRepository } from '@repository/composition.repository.contract';

// Shared by CompositionService and CommentAutomationService — both inject
// CompositionRepository anyway, so this is a plain function rather than a method on
// either service, which would otherwise force one to depend on the other just for
// this check.
export async function findOwnedComposition(
  compositions: CompositionRepository,
  userId: string,
  id: string,
): Promise<Composition> {
  const composition = await compositions.findById(id);
  if (!composition || composition.userId !== userId) {
    throw new NotFoundException(`Composition not found: ${id}`);
  }
  return composition;
}

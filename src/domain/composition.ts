import type { AutomationLevel } from './automation';

export interface Composition {
  id: string;
  userId: string;
  content: string;
  commentAutomationLevel: AutomationLevel | null;
  createdAt: Date;
}

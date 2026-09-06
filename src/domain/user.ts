import type { AutomationLevel } from './automation';


export interface User {
  id: string;
  displayName: string;
  hashedApiKey: string;
  maxCommentAutomationLevel: AutomationLevel;
  createdAt: Date;
}

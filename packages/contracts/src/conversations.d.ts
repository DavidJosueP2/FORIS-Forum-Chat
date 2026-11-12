export interface Conversation {
  kind: 'community' | 'direct';
  id: string;
  name: string;
  imageId: string | null;
}
import type { Message, MessagePage } from './messages.js';

export interface ConversationState {
  permission: 'intro' | 'awaiting' | 'reply' | 'open';
  canCall: boolean;
}
export interface ConversationHistory extends MessagePage { state: ConversationState }
export interface ConversationSend { message: Message; state: ConversationState }

export type Role = 'user' | 'bot';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  status: MessageStatus;
}

export interface ChatState {
  messages: Message[];
  isBotTyping: boolean;
  isAtBottom: boolean;
}

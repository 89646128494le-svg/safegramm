/**
 * TypeScript типы для SafeGram Desktop
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  description?: string;
  members: string[];
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string;
  replyTo?: string;
  replyToMessage?: Message;
  forwardFrom?: string;
  forwardFromChatId?: string;
  createdAt: string;
  updatedAt?: string;
  readBy?: string[];
  reactions?: Array<{
    userId: string;
    emoji: string;
  }>;
}

export interface PinnedMessage {
  id: string;
  messageId: string;
  chatId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface SavedMessage {
  id: string;
  userId: string;
  messageId: string;
  savedAt: string;
}

export interface Poll {
  id: string;
  messageId: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  multiple: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  expiresAt: string;
  createdAt: string;
  views?: number;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  ownerId: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
  createdAt: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  detail?: string;
}

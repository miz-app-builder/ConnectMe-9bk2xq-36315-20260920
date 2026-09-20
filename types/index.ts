// ConnectMe — Core TypeScript Types

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  push_token?: string;
  is_online?: boolean;
  last_seen?: string;
}

export type MessageType = 'text' | 'image' | 'audio' | 'voice';
export type ReadStatus = 'sent' | 'delivered' | 'read';

export interface ReplyPreview {
  id: string;
  content?: string;
  message_type: MessageType;
  sender_name?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string;
  message_type: MessageType;
  image_url?: string;
  audio_url?: string;
  duration_secs?: number;
  reply_to_id?: string;
  reply_to?: ReplyPreview;
  forwarded_from_id?: string;
  deleted_for_everyone?: boolean;
  is_edited?: boolean;
  created_at: string;
  sender?: UserProfile;
  read_status?: ReadStatus;
  is_deleted_for_me?: boolean;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  is_group: boolean;
  name?: string;
  avatar_url?: string;
  created_by?: string;
  otherUser?: UserProfile; // for 1:1 chats
  participants?: UserProfile[]; // for group chats
  lastMessage?: Message;
  unread_count?: number;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  contact?: UserProfile;
}

export interface GroupMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: UserProfile;
}

export interface TypingUser {
  user_id: string;
  name: string;
}

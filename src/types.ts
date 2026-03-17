export type PostType = 'USER' | 'ORBIT';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';

export interface Post {
  id: string;
  type: PostType;
  author: {
    uid: string;
    name: string;
    avatar: string;
    badge?: string;
    subtitle?: string;
  };
  content: string;
  media?: { url: string, type: 'image' | 'video' }[];
  visibility: 'public' | 'friends' | 'community';
  timestamp: any;
  likes: number;
  comments: number;
  shares: number;
  moderationStatus?: ModerationStatus;
  flagReason?: string;
}

export interface KnowledgeItem {
  id: string;
  category: 'HADITH' | 'QURAN' | 'SCHOLARLY' | 'ETIQUETTE';
  title: string;
  content: string;
  source: string;
  explanation?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

export interface Community {
  id: string;
  name: string;
  members: number;
  image: string;
  description: string;
}

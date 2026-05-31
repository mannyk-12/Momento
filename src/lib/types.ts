export interface Club {
  id: string;
  name: string;
  createdAt: string;
}

export interface MomentoEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  coverImage: string | null;
  createdBy: string;
  clubId: string;
  isPrivate: boolean;
  createdAt: string;
  photoCount?: number;
  videoCount?: number;
  approvedUploaderIds?: string[];
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'Viewer' | 'Club Member' | 'Photographer' | 'Admin';
  clubId?: string | null;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  eventId: string;
  uploadedBy: string;
  url: string;
  type: 'image' | 'video';
  status: 'processing' | 'ready';
  createdAt: string;
  tags?: string[];
  likedBy?: string[];
  favoritedBy?: string[];
}

export interface Comment {
  id: string;
  mediaId: string;
  eventId: string;
  userId: string;
  userName: string;
  text: string;
  mentions: string[];
  likedBy?: string[];
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: 'like' | 'comment' | 'mention' | 'comment_like' | 'photo_tag';
  mediaId: string;
  eventId: string;
  read: boolean;
  createdAt: string;
}

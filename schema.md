# Firestore Database Schema

Momento utilizes Google Cloud Firestore as its primary database. The NoSQL structure is optimized for fast, scalable reads of event and media feeds.

## Collections

### 1. `users`
Stores user profiles and role-based access control (RBAC) information.
```typescript
interface User {
  uid: string;                 // Matches Firebase Auth UID
  name: string;                // Full name
  email: string;               // Email address
  role: 'Admin' | 'Photographer' | 'Club Member' | 'Viewer';
  clubId?: string;             // Reference to the user's primary club
  createdAt: string;           // ISO 8601 Timestamp
}
```

### 2. `clubs`
Organizations or groups hosting events.
```typescript
interface Club {
  id: string;                  // Firestore auto-generated ID
  name: string;                // Club name
  description?: string;        
  createdAt: string;           // ISO 8601 Timestamp
}
```

### 3. `events`
A specific party, meetup, or gathering.
```typescript
interface MomentoEvent {
  id: string;                  // Firestore auto-generated ID
  title: string;               // Event title
  description: string;
  category: string;            // 'Club Party', 'Workshop', etc.
  date: string;                // ISO 8601 Date string
  isPrivate: boolean;          // If true, only club members & admins can view
  clubId: string;              // Reference to host club
  createdBy: string;           // Reference to User ID who created it
  createdAt: string;           // ISO 8601 Timestamp
}
```

### 4. `media`
Images or videos uploaded to an event.
```typescript
interface MediaItem {
  id: string;                  // Firestore auto-generated ID
  eventId: string;             // Reference to parent Event
  url: string;                 // Firebase Storage Download URL
  type: 'image' | 'video';
  uploadedBy: string;          // Reference to User ID who uploaded
  likes: string[];             // Array of User IDs who liked the post
  createdAt: string;           // ISO 8601 Timestamp
}
```

### 5. `comments`
User comments on a specific piece of media.
```typescript
interface Comment {
  id: string;                  // Firestore auto-generated ID
  mediaId: string;             // Reference to parent MediaItem
  userId: string;              // Reference to User ID who wrote the comment
  text: string;                // Comment body
  createdAt: string;           // ISO 8601 Timestamp
}
```

## Security Rule Highlights
- **Events**: Public events are readable by anyone authenticated. Private events are only readable by Admins or users whose `token.clubId` matches the event's `clubId`.
- **Media**: Media reads cascade from Event access. Users can only update a media document to add their ID to the `likes` array. Media deletion is restricted strictly to Admins and the original uploader.

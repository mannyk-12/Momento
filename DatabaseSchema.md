# Database Schema & Architecture

Momento utilizes **Google Cloud Firestore**, a highly scalable, serverless NoSQL document database. Our schema is heavily optimized for fast, read-heavy workloads (like rendering high-volume media feeds) while maintaining strict role-based access control (RBAC).

This document outlines the precise data models, collection structures, relational strategies, and security paradigms used across the application.

---

## Core Collections

### 1. `users`
Acts as the central source of truth for user profiles, access control, and fallback security verification.

**Path:** `/users/{uid}` (Document ID matches Firebase Authentication UID)

```typescript
interface UserProfile {
  uid: string;                 // Primary Key (matches Firebase Auth)
  name: string;                // Display name
  email: string;               // Registered email
  role: 'Admin' | 'Photographer' | 'Club Member' | 'Viewer'; // RBAC role
  clubId?: string | null;      // Foreign Key -> clubs.id (Required for Club Members)
  createdAt: string;           // ISO 8601 UTC Timestamp
}
```
* **Security Rules:** Readable by any authenticated user (necessary for rendering names on comments). Writable only by the user themselves or an Admin.
* **Backend Sync:** When a user's role is updated, a Cloud Function (`/api/auth/set-role`) simultaneously updates this document AND the user's custom JWT Auth Claims to ensure synchronization.

### 2. `clubs`
Represents an organization or group that hosts events.

**Path:** `/clubs/{clubId}` (Auto-generated ID)

```typescript
interface Club {
  id: string;                  // Primary Key
  name: string;                // Club display name
  createdAt: string;           // ISO 8601 UTC Timestamp
}
```
* **Security Rules:** Readable by everyone. Writable/Deletable exclusively by Admins. 
* **Relationship:** Events and Users are strictly bound to a `clubId`.

### 3. `events`
A specific gathering, party, or photoshoot. Acts as a strict container for media.

**Path:** `/events/{eventId}` (Auto-generated ID)

```typescript
interface MomentoEvent {
  id: string;                  // Primary Key
  title: string;               // Event name
  description: string;         // Markdown/text description
  category: string;            // 'Club Party', 'Concert', 'Workshop', etc.
  date: string;                // Date of event occurrence (YYYY-MM-DD)
  coverImage: string | null;   // URL to the featured event image
  createdBy: string;           // Foreign Key -> users.uid
  clubId: string;              // Foreign Key -> clubs.id (Nullable for Photographers)
  isPrivate: boolean;          // Visibility flag
  createdAt: string;           // ISO 8601 UTC Timestamp
  
  // Denormalized Aggregations (Updated via client/functions)
  photoCount?: number;         
  videoCount?: number;         
  
  // Access Control Array
  approvedUploaderIds?: string[]; // Array of users explicitly allowed to upload here
}
```
* **Security Rules:** 
  * Read: Accessible to authenticated users (Client-side logic filters private events).
  * Create: Restricted to `Admin`, `Photographer`, or `Club Member`.
  * Update/Delete: Restricted to `Admin` or the original `createdBy` user.

### 4. `media`
Individual high-resolution images or videos uploaded under a specific event.

**Path:** `/media/{mediaId}` (Auto-generated ID)

```typescript
interface MediaItem {
  id: string;                  // Primary Key
  eventId: string;             // Foreign Key -> events.id
  uploadedBy: string;          // Foreign Key -> users.uid
  url: string;                 // Firebase Cloud Storage Download URL
  type: 'image' | 'video';     // Media type
  status: 'processing' | 'ready'; // Async processing status
  createdAt: string;           // ISO 8601 UTC Timestamp
  
  // Interactive Elements
  tags?: string[];             // Auto-generated via Google Cloud Vision API
  likedBy?: string[];          // Array of User UIDs who liked the media
  favoritedBy?: string[];      // Array of User UIDs who favorited the media
}
```
* **Security Rules:**
  * Read: Accessible to authenticated users.
  * Create: `Admin`, `Photographer`, `Club Member`, or anyone in the parent event's `approvedUploaderIds`.
  * Update: 
    * Uploader/Admin: Full access.
    * Standard User: Only allowed to update the `likedBy` and `favoritedBy` arrays.
  * Delete: `Admin` or the original `uploadedBy` user.

### 5. `comments`
User-generated comments attached to specific media items.

**Path:** `/comments/{commentId}` (Auto-generated ID)

```typescript
interface Comment {
  id: string;                  // Primary Key
  mediaId: string;             // Foreign Key -> media.id
  eventId: string;             // Foreign Key -> events.id (Optimizes cascading queries)
  userId: string;              // Foreign Key -> users.uid
  userName: string;            // Denormalized display name
  text: string;                // Comment payload
  mentions: string[];          // Array of User UIDs mentioned in the text
  likedBy?: string[];          // Array of User UIDs who liked the comment
  createdAt: string;           // ISO 8601 UTC Timestamp
}
```
* **Security Rules:** 
  * Create: Any authenticated user.
  * Update: Original author can edit text. Anyone can append to `likedBy`.
  * Delete: Original author or Admin.

### 6. `notifications`
Real-time alerting system for user engagement.

**Path:** `/notifications/{notificationId}` (Auto-generated ID)

```typescript
interface Notification {
  id: string;                  // Primary Key
  recipientId: string;         // Foreign Key -> users.uid
  senderId: string;            // Foreign Key -> users.uid
  senderName: string;          // Denormalized sender name
  type: 'like' | 'comment' | 'mention' | 'comment_like' | 'photo_tag';
  mediaId: string;             // Foreign Key -> media.id
  eventId: string;             // Foreign Key -> events.id
  read: boolean;               // Unread/Read status
  createdAt: string;           // ISO 8601 UTC Timestamp
}
```
* **Security Rules:**
  * Read/Update/Delete: ONLY the `recipientId` user or an Admin.
  * Create: Any authenticated user (triggered by their actions).

---

## Relational Strategy & NoSQL Patterns

### Denormalization
To minimize database reads and optimize UI rendering, we intentionally denormalize specific data:
- **`userName` in Comments & Notifications:** We store the string `userName` directly in the comment/notification payload. This prevents the frontend from having to fire off hundreds of individual user profile queries when rendering a comment thread.
- **`eventId` in Comments & Notifications:** By storing the parent `eventId` directly on these deep nested objects, we can easily query "All comments for an event" or securely cascade deletes when an event is deleted.
- **`photoCount` & `videoCount` in Events:** Instead of forcing the client to `count()` the media collection every time they view the dashboard, we store an aggregated count directly on the Event object.

### Composite Indexes
Due to the NoSQL nature of Firestore, complex queries require explicit Composite Indexes. 

We maintain a `firestore.indexes.json` file which automatically generates indexes for common queries, such as:
1. `media` collection: Filtering by `eventId` AND sorting by `createdAt` descending.
2. `comments` collection: Filtering by `mediaId` AND sorting by `createdAt` ascending.
3. `notifications` collection: Filtering by `recipientId` AND sorting by `createdAt` descending.

---

## Security Architecture

Momento implements an advanced **Dual-Verification Security Model**.

Normally, Firestore rules rely entirely on the JWT token provided by the browser (`request.auth.token.role`). However, JWT claims can get out of sync if a user's role is updated on the backend while their browser session is active.

To prevent false permission errors, our `firestore.rules` uses a custom `getUserRole()` function:

```javascript
// Safely gets the user's actual database role as a fallback
function getUserRole() {
  return isAuth() ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role : null;
}

// Evaluates the JWT Token first, and falls back to a secure database read
function isAdmin() {
  return isAuth() && (request.auth.token.role == 'Admin' || getUserRole() == 'Admin');
}
```
This guarantees that permissions are absolutely unbreakable and immune to local client caching issues.

# Momento 📸

**Preserve Every Momento.** 
A centralized platform for university clubs, professional photographers, and members to share, organize, and interact with event media in stunning high quality.

Momento solves the chaotic problem of post-event media sharing. Instead of losing high-quality photos to compressed social media algorithms or messy group chats, Momento provides a beautiful, secure, and organized hub for all your event memories.

---

## Live Production Application
**Deployed Link:** [https://momento-eb6d7.web.app/](https://momento-eb6d7.web.app/)

The application is fully hosted on Firebase Hosting using Firebase Web Frameworks to support Next.js App Router and Server-Side Rendering.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Frontend Library:** React 19
- **Styling:** Vanilla CSS Modules & CSS Variables (Custom Design System)
- **Authentication:** Firebase Auth (Email/Password & Google OAuth)
- **Database:** Firebase Firestore (NoSQL)
- **Storage:** Firebase Cloud Storage
- **Image Processing:** Google Cloud Vision API (Auto-tagging)
- **Deployment:** Firebase Hosting (Web Frameworks)

---

## Key Features

- **Role-Based Access Control (RBAC):** Distinct roles for **Admin** (universal access and user management), **Club Member** (can view and engage with their club's media), **Photographer** (can upload high-res media to assigned events), and **Viewer**. Role management is securely handled via backend custom claims and Firestore rules.
- **Event-wise Organization:** Media is strictly categorized by events and clubs. Photographers can create public events, while club members can create private events restricted to their club.
- **Media Lightbox & Engagement:** Beautiful image viewing experience with real-time comments, photo liking, zooming, and downloading.
- **Smart Auto-Tagging:** Images uploaded by photographers are automatically analyzed by Google Cloud Vision API to generate contextual tags.
- **Admin Dashboard:** A centralized control panel to manage user access, visualize platform growth via charts, and securely delete users.
- **Robust Security Rules:** Firestore and Storage rules are rigorously configured to prevent unauthorized data access, guaranteeing privacy for exclusive club events.

---

## Local Development Setup

Follow these precise instructions to get a copy of the project running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18.17 or higher recommended)
- [npm](https://www.npmjs.com/) or yarn
- A Firebase Project (Create one at [Firebase Console](https://console.firebase.google.com/))
- A Google Cloud Platform (GCP) Project (usually created automatically with your Firebase project)

### 1. Firebase Configuration

1. Create a new Firebase project in the Firebase Console.
2. Enable **Authentication**:
   - Enable the **Email/Password** provider.
   - Enable the **Google** provider.
3. Enable **Firestore Database**:
   - Start in Test Mode or Production Mode (you will deploy strict security rules later via the codebase).
4. Enable **Firebase Storage**:
   - This will be used to store high-resolution images and videos.
5. Generate a Service Account Key:
   - Navigate to **Project Settings > Service Accounts**.
   - Click **Generate new private key** and download the JSON file. You will need the values inside this file for your local environment variables.

### 2. Google Cloud Console Configuration (CRITICAL FOR AUTH)

To ensure Google OAuth (Sign-in with Google) works seamlessly in production, you must explicitly configure your OAuth credentials in Google Cloud Platform:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project from the top dropdown.
3. Search for **"APIs & Services"** and navigate to the **Credentials** tab.
4. Under **OAuth 2.0 Client IDs**, click the automatically generated `Web client (auto created by Google Service)`.
5. Under **Authorized JavaScript origins**, click **Add URI** and paste exactly:
   - `https://momento-eb6d7.web.app` (Or your custom Firebase Hosting domain)
6. Under **Authorized redirect URIs**, click **Add URI** and paste exactly:
   - `https://momento-eb6d7.web.app/__/auth/handler`
7. Click **Save** at the bottom of the page.

*Note: Without these exact configurations, Google Sign-In will throw an "Invalid Request" or "Cross-Origin" error in production.*

### 3. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/momento.git

# Navigate into the directory
cd momento

# Install dependencies
npm install
```

### 4. Environment Variables

You must create two environment files in the root of your project: `.env.local` (for development) and `.env.production` (for deployment). 

**`.env.local`** (Copy from `.env.example`):
```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"

# Firebase Admin Configuration (Backend only - KEEP SECRET)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com"
# For the private key, replace actual line breaks with \n
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\n-----END PRIVATE KEY-----\n"

# Admin Configuration
NEXT_PUBLIC_ADMIN_EMAIL="your.email@gmail.com"
```

**`.env.production`**:
This should be identical to `.env.local`, with one critical exception to fix Next.js routing bugs:
```env
# Use the web.app URL for the Auth Domain to prevent cross-origin tracking blocks
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="momento-eb6d7.web.app"
```

### 5. Run the Local Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment Guide

Momento uses **Firebase Hosting with Web Frameworks** to support Next.js App Router SSR out of the box.

### Prerequisites for Deployment
1. Ensure you have the Firebase CLI installed globally:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Firebase account:
   ```bash
   firebase login
   ```
3. Initialize Firebase if you haven't already:
   ```bash
   firebase init
   ```
   Select **Hosting**, **Firestore**, and **Storage**. When asked about Web Frameworks, say **Yes**.

### Deploying the Application

To deploy the entire application (Next.js Frontend, Backend API Routes, Firestore Rules, and Storage Rules):

```bash
firebase deploy
```

**Note on Caching and Routing:**
The `firebase.json` file is specifically configured with `Cache-Control` headers for the Next.js App Router. This ensures that Firebase CDN does not aggressively cache the HTML files, which would break Next.js client-side navigations (RSC payloads).

To deploy ONLY the frontend UI changes (skipping database rules to save time):
```bash
firebase deploy --only hosting
```

To deploy ONLY the Firestore security rules:
```bash
firebase deploy --only firestore:rules
```

---

## Security Architecture

- **Server-Side Role Assignment:** Role assignment is handled strictly via backend API routes (`/api/auth/set-role`) using the Firebase Admin SDK to assign Custom JWT Claims. Normal users cannot spoof their role on the client side.
- **Double Verification:** `firestore.rules` securely checks BOTH the user's JWT token and their fallback database profile document to guarantee permissions are never bypassed due to out-of-sync tokens.
- **Admin Auto-provisioning:** If a user signs up with the exact email defined in `NEXT_PUBLIC_ADMIN_EMAIL`, they are automatically granted maximum privileges. Keep this environment variable highly secure.

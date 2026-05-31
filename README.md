# Momento 📸

**Preserve Every Momento.** 
A centralized platform for university clubs, professional photographers, and members to share, organize, and interact with event media in stunning high quality.

Momento solves the chaotic problem of post-event media sharing. Instead of losing high-quality photos to compressed social media algorithms or messy group chats, Momento provides a beautiful, secure, and organized hub for all your event memories.

## 🚀 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Frontend Library:** React 19
- **Styling:** Vanilla CSS Modules & CSS Variables (Custom Design System)
- **Authentication:** Firebase Auth (Email/Password & Google OAuth)
- **Database:** Firebase Firestore (NoSQL)
- **Storage:** Firebase Cloud Storage
- **Icons:** Lucide React
- **Animation:** Framer Motion

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Distinct roles for **Admin** (universal access and user management), **Club Member** (can view and engage with their club's media), **Photographer** (can upload high-res media to assigned events), and **Viewer**.
- **Event-wise Organization:** Media is strictly categorized by events and clubs.
- **Media Lightbox & Engagement:** Beautiful image viewing experience with real-time comments, photo liking, and zooming.
- **Tagging System:** Users can tag themselves and others in specific locations on a photo.
- **Real-time Notifications:** Users are instantly notified via a dropdown when someone likes their photo, replies to their comment, or tags them.
- **Admin Dashboard:** A centralized control panel to manage user access, approve uploaders for specific events, and analyze basic stats.

---

## 🛠️ Getting Started (Local Development)

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18.17 or higher recommended)
- [npm](https://www.npmjs.com/) or yarn
- A Firebase Project (Create one at [Firebase Console](https://console.firebase.google.com/))

### 1. Firebase Setup

1. Create a new Firebase project.
2. Enable **Authentication** (turn on Email/Password and Google sign-in methods).
3. Enable **Firestore Database** (start in test mode for local dev, configure security rules later).
4. Enable **Firebase Storage**.
5. Go to **Project Settings > Service Accounts**, click "Generate new private key", and download the JSON file. You will need this for the backend admin SDK.

### 2. Clone and Install

```bash
# Clone the repository (once uploaded to GitHub)
git clone https://github.com/yourusername/momento.git

# Navigate into the directory
cd momento

# Install dependencies
npm install
```

### 3. Environment Variables

Create a file named `.env.local` in the root of the project. Use `.env.example` as a template. Fill in the values from your Firebase Project Settings:

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
# The email address that will automatically be granted the Admin role upon signing-in with the same email from Google Sign In.
NEXT_PUBLIC_ADMIN_EMAIL="your.email@gmail.com"
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🏗️ Project Structure

- `/src/app`: Next.js App Router pages (Dashboard, Admin, Events, Search, Login, Signup).
- `/src/app/api`: Serverless API routes (e.g., setting custom auth claims, securely searching users).
- `/src/components`: Reusable UI components (Navbar, Lightbox, CustomSelect, MediaUploader).
- `/src/lib`: Core utilities (Firebase config, contexts, types).

## 🔒 Security Notes

- **Role Assignment:** Role assignment is handled securely via custom Firebase Auth claims set by the `/api/auth/set-role` route. Normal users cannot spoof their role on the client side.
- **Admin Auto-provisioning:** If a user signs up with the email defined in `NEXT_PUBLIC_ADMIN_EMAIL`, they are automatically granted maximum privileges. Make sure this environment variable is kept secure in production.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

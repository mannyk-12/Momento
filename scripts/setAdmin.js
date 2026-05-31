require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin (use similar logic as admin.ts)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function setAdmin() {
  try {
    const user = await auth.getUserByEmail(process.env.ADMIN_EMAIL || 'your-admin@email.com');
    await auth.setCustomUserClaims(user.uid, { role: 'Admin', clubId: '' });
    await db.collection('users').doc(user.uid).update({ role: 'Admin' });
    console.log("SUCCESS: Granted Admin to " + user.email);
  } catch(e) {
    console.error("ERROR:", e);
  }
}

setAdmin();

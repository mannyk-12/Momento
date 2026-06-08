import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

export async function GET() {
  try {
    const mediaSnap = await db.collection('media').get();
    
    let updatedCount = 0;

    const tokenize = (text: string) => {
      const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return clean.split(' ').filter(w => w.length > 2);
    };

    const updatePromises = mediaSnap.docs.map(async (mediaDoc) => {
      const data = mediaDoc.data();
      const currentTags = data.tags || [];
      
      if (currentTags.length === 0) return Promise.resolve();

      let tokenizedTags: string[] = [...currentTags];
      currentTags.forEach((tag: string) => {
        const tokens = tokenize(tag);
        tokenizedTags = tokenizedTags.concat(tokens);
      });
      
      const newTags = Array.from(new Set(tokenizedTags));
      
      // Only update if there are actually new tokens
      if (newTags.length > currentTags.length) {
        updatedCount++;
        return mediaDoc.ref.update({
          tags: newTags
        });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully migrated ${updatedCount} media documents.`
    });
  } catch (error: any) {
    console.error("Migration failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

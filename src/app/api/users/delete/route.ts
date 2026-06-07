import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { uid, adminUid } = await req.json();

    if (!uid || !adminUid) {
      return NextResponse.json({ error: 'Missing uid or adminUid' }, { status: 400 });
    }

    // Security Check: Ensure the requester is an admin
    const adminUser = await adminAuth.getUser(adminUid);
    if (adminUser.customClaims?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Only admins can delete users.' }, { status: 403 });
    }

    if (uid === adminUid) {
      return NextResponse.json({ error: 'Cannot delete yourself.' }, { status: 400 });
    }

    // 1. Delete user from Firebase Auth
    await adminAuth.deleteUser(uid);

    // 2. Delete user document from Firestore
    await adminDb.collection('users').doc(uid).delete();

    // Note: To be fully robust, we would also delete their events, media, and comments here.
    // For now, we will leave them orphaned or let the Admin delete them manually.

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

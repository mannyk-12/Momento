import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { uid, role, clubId } = await req.json();

    if (!uid || !role) {
      return NextResponse.json({ error: 'Missing uid or role' }, { status: 400 });
    }

    // Security check: Automatically grant Developer account the Admin role.
    const userRecord = await adminAuth.getUser(uid);
    let assignedRole = role;

    if (userRecord.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      assignedRole = 'Admin';
    } else if (role === 'Admin') {
      return NextResponse.json({ error: 'Unauthorized: Cannot grant Admin role' }, { status: 403 });
    }

    // Set custom user claims on Firebase Auth
    const claims: any = { role: assignedRole };
    if (clubId) {
      claims.clubId = clubId;
    }

    await adminAuth.setCustomUserClaims(uid, claims);
    
    // Also update the Firestore users document directly from the backend to bypass client rules
    const adminDb = (await import('firebase-admin/firestore')).getFirestore();
    await adminDb.collection('users').doc(uid).update({ role: assignedRole });

    return NextResponse.json({ message: `Role ${role} assigned successfully` });
  } catch (error: any) {
    console.error('Error setting role:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

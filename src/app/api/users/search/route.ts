import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase() || '';
    const ids = searchParams.get('ids'); // comma separated

    const snap = await adminDb.collection('users').get();
    
    const results: any[] = [];
    const idSet = ids ? new Set(ids.split(',')) : null;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.role === 'Admin') continue; // Never return Admins
      
      if (idSet) {
        if (idSet.has(data.uid)) {
          results.push(data);
        }
      } else if (q) {
        const name = (data.name || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        
        if (name.includes(q) || email.includes(q)) {
          results.push(data);
          if (results.length >= 10) break; // Limit search results to 10
        }
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

'use client';

import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../../lib/firebase/config';
import { doc, setDoc, collection, getDocs, addDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './signup.module.css';
import { Loader2 } from 'lucide-react';
import { Club } from '../../lib/types';
import CustomSelect from '../../components/CustomSelect';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  // Club selection state
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [isCreatingClub, setIsCreatingClub] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'clubs'));
        const fetchedClubs: Club[] = [];
        querySnapshot.forEach((doc) => {
          fetchedClubs.push({ id: doc.id, ...doc.data() } as Club);
        });
        setClubs(fetchedClubs);
      } catch (err) {
        console.error("Failed to fetch clubs", err);
      }
    };
    fetchClubs();
  }, []);

  const validateClubSelection = async () => {
    let finalClubId = null;
    if (role === 'Club Member') {
      if (isCreatingClub) {
        if (!newClubName.trim()) throw new Error("Please enter a new club name.");
        // Create the new club (Must happen AFTER authentication)
        const clubDocRef = await addDoc(collection(db, 'clubs'), {
          name: newClubName.trim(),
          createdAt: new Date().toISOString()
        });
        finalClubId = clubDocRef.id;
      } else {
        if (!selectedClubId) throw new Error("Please select a club.");
        finalClubId = selectedClubId;
      }
    }
    return finalClubId;
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!role) throw new Error("Please select a role before signing up.");
      
      // Pre-flight check for club inputs before creating auth account
      if (role === 'Club Member') {
        if (isCreatingClub && !newClubName.trim()) throw new Error("Please enter a new club name.");
        if (!isCreatingClub && !selectedClubId) throw new Error("Please select a club.");
      }

      // Create user in Firebase Auth FIRST
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // NOW validate and create club in Firestore (since isAuth() is true)
      const finalClubId = await validateClubSelection();

      // Save user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        role: email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ? 'Admin' : role,
        clubId: finalClubId,
        createdAt: new Date().toISOString()
      });

      // Call API to set custom claim for Role-Based Access Control
      await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, role, clubId: finalClubId })
      });

      // Force token refresh to get new claims
      await user.getIdToken(true);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError('');

    try {
      if (!role) throw new Error("Please select a role before signing up.");
      
      // Pre-flight check
      if (role === 'Club Member') {
        if (isCreatingClub && !newClubName.trim()) throw new Error("Please enter a new club name.");
        if (!isCreatingClub && !selectedClubId) throw new Error("Please select a club.");
      }

      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user already exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        // They already signed up previously, just log them in
        router.push('/dashboard');
        return;
      }

      // NOW validate and create club in Firestore
      const finalClubId = await validateClubSelection();

      // Save new user profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || name || 'Unknown User', // Use Google's provided name
        email: user.email,
        role: user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ? 'Admin' : role,
        clubId: finalClubId,
        createdAt: new Date().toISOString()
      });

      // Set custom claims
      await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, role, clubId: finalClubId })
      });

      await user.getIdToken(true);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google Sign Up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassPanel}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Join Momento and experience events like never before.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSignup} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="role">I am a...</label>
            <CustomSelect
              id="role"
              value={role}
              onChange={(value) => {
                setRole(value);
                if (value === 'Viewer') {
                  setSelectedClubId('');
                  setIsCreatingClub(false);
                }
              }}
              options={[
                { value: 'Viewer', label: 'Viewer' },
                { value: 'Club Member', label: 'Club Member' },
                { value: 'Photographer', label: 'Photographer' }
              ]}
              placeholder="Select your role"
            />
          </div>

          {role === 'Club Member' && (
            <div className={styles.clubSection}>
              {!isCreatingClub ? (
                <div className={styles.inputGroup}>
                  <label htmlFor="club">Select your Club</label>
                  <CustomSelect
                    id="club"
                    value={selectedClubId}
                    onChange={(value) => setSelectedClubId(value)}
                    options={clubs.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="-- Choose a Club --"
                  />
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => setIsCreatingClub(true)}
                  >
                    Don't see your club? Create a new one.
                  </button>
                </div>
              ) : (
                <div className={styles.inputGroup}>
                  <label htmlFor="newClub">New Club Name</label>
                  <input
                    type="text"
                    id="newClub"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    required
                    placeholder="Club Name"
                  />
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => {
                      setIsCreatingClub(false);
                      setNewClubName('');
                    }}
                  >
                    Cancel and select an existing club.
                  </button>
                </div>
              )}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 className={styles.spinner} /> : 'Sign Up'}
          </button>
          
          <div className={styles.divider}>
            <span>OR</span>
          </div>
          
          <button 
            type="button" 
            className={styles.googleBtn} 
            onClick={handleGoogleSignup}
            disabled={loading}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className={styles.googleIcon} />
            Sign up with Google
          </button>
        </form>

        <p className={styles.footerText}>
          Already have an account? <Link href="/login" className={styles.link}>Log in here</Link>
        </p>
      </div>
    </div>
  );
}

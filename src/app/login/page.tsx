'use client';

import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase/config';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Auto-provision Admin role if it's the developer's email
      if (userCredential.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        try {
          await fetch('/api/auth/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userCredential.user.uid, role: 'Admin', clubId: '' })
          });
          await userCredential.user.getIdToken(true); // Force token refresh
        } catch (e) { console.error("Error auto-provisioning Admin", e) }
      }

      router.push('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Auto-provision Admin role if it's the developer's email
      if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        try {
          await fetch('/api/auth/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, role: 'Admin', clubId: '' })
          });
          await user.getIdToken(true); // Force token refresh
        } catch (e) { console.error("Error auto-provisioning Admin", e) }
      }

      // STRICT CHECK: Ensure they have an account (selected a club)
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        // If it's the developer, let's create their document so they don't get blocked
        if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: user.displayName || 'Developer',
            email: user.email,
            role: 'Admin',
            clubId: '',
            createdAt: new Date().toISOString()
          });
        } else {
          // Log them out immediately
          await signOut(auth);
          throw new Error("Account not found. Please Sign Up first");
        }
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google Sign In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassPanel}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>Log in to access your Momento dashboard.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
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
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 className={styles.spinner} /> : 'Sign In'}
          </button>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className={styles.googleIcon} />
            Sign in with Google
          </button>
        </form>

        <p className={styles.footerText}>
          Don't have an account? <Link href="/signup" className={styles.link}>Sign up here</Link>
        </p>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/contexts/AuthContext';
import styles from './landing.module.css';
import { Camera, Layers, Shield, Users, ArrowRight, Image as ImageIcon, MessageCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return null; // Return nothing while checking auth or redirecting
  }

  return (
    <div className={styles.pageContainer}>
      {/* Landing Navbar */}
      <nav className={styles.navbar}>
        <Link href="/" className={styles.logo}>
          Momento
        </Link>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#about" className={styles.navLink}>About</a>
        </div>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.loginBtn}>Log In</Link>
          <Link href="/signup" className={styles.signupBtn}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.blob1}></div>
          <div className={styles.blob2}></div>
        </div>
        
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            ✨ The Future of Event Media
          </div>
          <h1 className={styles.heroTitle}>
            Preserve Every <span>Momento.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            A centralized platform for clubs, photographers, and members to share, organize, and interact with event media in stunning high quality.
          </p>
          
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.primaryCta}>
              Get Started <ArrowRight size={18} />
            </Link>
            <a href="#features" className={styles.secondaryCta}>
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresHeader}>
          <h2 className={styles.featuresTitle}>Everything you need to manage event media.</h2>
          <p className={styles.featuresSubtitle}>Designed for scale, built for beautiful experiences. Momento handles everything from fast uploads to community interaction.</p>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Layers size={24} />
            </div>
            <h3>Event-wise Organization</h3>
            <p>Keep your photos neatly categorized by event. No more messy folders or lost memories. Everything is where it belongs.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Shield size={24} />
            </div>
            <h3>Secure Cloud Storage</h3>
            <p>Your memories are safe with us. We use enterprise-grade cloud storage to securely back up and serve your media at lightning speed.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <MessageCircle size={24} />
            </div>
            <h3>Real-time Interactions</h3>
            <p>Engage with your community. Like photos, leave comments, and receive real-time notifications when friends interact with your uploads.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Camera size={24} />
            </div>
            <h3>Public & Private Albums</h3>
            <p>Total control over your privacy. Keep sensitive events locked to verified club members, or open them up to the public.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Users size={24} />
            </div>
            <h3>Smart Role Management</h3>
            <p>Assign specific permissions to Admins, Photographers, and Members. Only authorized users can upload or delete content.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <ImageIcon size={24} />
            </div>
            <h3>Uncompressed Quality</h3>
            <p>We respect the art of photography. Upload high-resolution images without aggressive compression ruining the details.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={styles.about}>
        <div className={styles.aboutContent}>
          <div className={styles.aboutText}>
            <h2>About Momento</h2>
            <p>
              Momento was built with a simple vision: to give communities a beautiful, centralized place to store and share their memories. 
              We believe that the photos taken at your events deserve more than being lost in a chaotic group chat or compressed beyond recognition on social media.
            </p>
            <p>
              Whether you are a university club, a professional photographer, or just a group of friends, Momento provides the tools you need to organize, secure, and celebrate your shared experiences.
            </p>
          </div>
          <div className={styles.aboutVisual}>
            <div className={`${styles.aboutCard} ${styles.card1}`}></div>
            <div className={`${styles.aboutCard} ${styles.card2}`}></div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo}>Momento</Link>
            <p>The premium event and media management platform built for modern communities.</p>
          </div>
          
          <div className={styles.footerCol}>
            <h4>Platform</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#features">Features</a></li>
              <li><Link href="/login">Log In</Link></li>
              <li><Link href="/signup">Sign Up</Link></li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h4>Legal</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} Momento. All rights reserved.</p>
          <p>Made with ❤️ by MrManny.</p>
        </div>
      </footer>
    </div>
  );
}

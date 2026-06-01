'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../lib/contexts/AuthContext';
import { db } from '../../../lib/firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Lock, Globe, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import styles from './new-event.module.css';

export default function NewEventPage() {
  const { user, role, clubId, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Club Party');
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (authLoading) return <div className={styles.loaderContainer}><div className={styles.spinner} /></div>;

  // Protect route
  if (!user || (role !== 'Admin' && role !== 'Photographer' && role !== 'Club Member')) {
    return (
      <div className={styles.container}>
        <div className={styles.glassPanel}>
          <h2 className={styles.title}>Access Denied</h2>
          <p className={styles.subtitle}>You do not have permission to create events.</p>
          <Link href="/dashboard" className={styles.backBtn}>Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Club Members must have a club to create events
  if (role === 'Club Member' && !clubId) {
    return (
      <div className={styles.container}>
        <div className={styles.glassPanel}>
          <h2 className={styles.title}>Club Required</h2>
          <p className={styles.subtitle}>You must be associated with a club to create events.</p>
          <Link href="/dashboard" className={styles.backBtn}>Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const eventData = {
        title,
        description,
        category: category === 'Other' ? customCategory : category,
        date,
        coverImage: null,
        createdBy: user.uid,
        clubId: clubId,
        isPrivate: role === 'Photographer' ? false : isPrivate,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'events'), eventData);
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Error creating event:", err);
      setError("Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        <h1 className={styles.pageTitle}>Create New Event</h1>
      </div>

      <div className={styles.glassPanel}>
        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleCreateEvent} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="title">Event Title</label>
            <input 
              type="text" 
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required 
              placeholder="Summer Beats Festival 2026"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label htmlFor="date">Event Date</label>
              <input 
                type="date" 
                id="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required 
              />
            </div>

            <div className={styles.inputGroup} onMouseLeave={() => setIsDropdownOpen(false)}>
              <label>Category</label>
              <div 
                className={styles.customDropdown} 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={styles.dropdownSelected}>
                  {category === 'Other' ? 'Other (Custom)' : category}
                </span>
                <ChevronDown size={16} className={`${styles.dropdownChevron} ${isDropdownOpen ? styles.open : ''}`} />
                
                {isDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    {['Club Party', 'Concert', 'Workshop', 'Meetup', 'Photoshoot', 'Other'].map(cat => (
                      <div 
                        key={cat} 
                        className={`${styles.dropdownItem} ${category === cat ? styles.activeItem : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategory(cat);
                          if (cat !== 'Other') {
                            setCustomCategory('');
                          }
                          setIsDropdownOpen(false);
                        }}
                      >
                        {cat === 'Other' ? 'Other (Custom)' : cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {category === 'Other' && (
            <div className={styles.inputGroup}>
              <label htmlFor="customCategory">Custom Category</label>
              <input 
                type="text" 
                id="customCategory"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required 
                placeholder="Type your category here..."
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="description">Description</label>
            <textarea 
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required 
              placeholder="Tell us about the event..."
              rows={4}
            />
          </div>

          {role !== 'Photographer' && (
            <div className={styles.privacySection}>
              <label className={styles.privacyLabel}>Event Privacy</label>
              <div className={styles.privacyOptions}>
                <div 
                  className={`${styles.privacyCard} ${!isPrivate ? styles.activePrivacy : ''}`}
                  onClick={() => setIsPrivate(false)}
                >
                  <Globe size={24} />
                  <div className={styles.privacyContent}>
                    <h4>Public Event</h4>
                    <p>Visible to everyone on the platform.</p>
                  </div>
                </div>

                <div 
                  className={`${styles.privacyCard} ${isPrivate ? styles.activePrivacy : ''}`}
                  onClick={() => setIsPrivate(true)}
                >
                  <Lock size={24} />
                  <div className={styles.privacyContent}>
                    <h4>Private Event</h4>
                    <p>Visible only to members of your club.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 className={styles.spinnerIcon} /> : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}

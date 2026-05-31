'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { MomentoEvent, MediaItem } from '../../lib/types';
import { Search, ArrowLeft, Image as ImageIcon, Calendar, User as UserIcon, Lock, Globe, Video, Heart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './search.module.css';
import { useAuth } from '../../lib/contexts/AuthContext';
import MediaLightbox from '../../components/MediaLightbox';

type Tab = 'Photos' | 'Events' | 'Users';

export default function SearchPage() {
  const { clubId, role } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('Photos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Data States
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [events, setEvents] = useState<MomentoEvent[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // When tab changes, clear results if needed or automatically trigger search
  useEffect(() => {
    if (searchQuery.length > 2) {
      handleSearch();
    }
  }, [activeTab]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    try {
      if (activeTab === 'Photos') {
        const lowerQuery = searchQuery.trim().toLowerCase();
        // Array-contains requires exact match on the element
        const mediaQ = query(
          collection(db, 'media'), 
          where('tags', 'array-contains', lowerQuery),
          limit(50)
        );
        const snap = await getDocs(mediaQ);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem));
        setMedia(results);
      } 
      else if (activeTab === 'Events') {
        // Since we don't have full-text search, we fetch events and filter client-side
        // For a real app, use Algolia. For this resume app, fetching is fine.
        const eventsQ = query(collection(db, 'events'), orderBy('date', 'desc'));
        const snap = await getDocs(eventsQ);
        
        const lowerQuery = searchQuery.toLowerCase();
        const results: MomentoEvent[] = [];
        
        snap.forEach(doc => {
          const e = { id: doc.id, ...doc.data() } as MomentoEvent;
          // Apply privacy filter
          if (role !== 'Admin' && e.isPrivate && e.clubId !== clubId) return;
          
          if (e.title.toLowerCase().includes(lowerQuery) || e.description.toLowerCase().includes(lowerQuery)) {
            results.push(e);
          }
        });
        setEvents(results);
      }
      else if (activeTab === 'Users') {
        // Find users by exact name match or prefix (client-side filter)
        const usersQ = query(collection(db, 'users'));
        const snap = await getDocs(usersQ);
        
        const lowerQuery = searchQuery.toLowerCase();
        const results: any[] = [];
        
        snap.forEach(doc => {
          const u = { id: doc.id, ...doc.data() } as any;
          if (u.name?.toLowerCase().includes(lowerQuery)) {
            results.push(u);
          }
        });
        setUsers(results);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/dashboard" className={styles.backLink}>
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Advanced Search</h1>
        <p className={styles.subtitle}>Discover photos, events, and people using AI tags</p>
      </header>

      <div className={styles.searchBox}>
        <Search size={24} className={styles.searchIcon} />
        <input 
          type="text" 
          placeholder={
            activeTab === 'Photos' ? "Search AI tags (e.g. mountains, concert)..." :
            activeTab === 'Events' ? "Search event names or descriptions..." :
            "Search for a user..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'Photos' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('Photos')}
        >
          Photos & AI Tags
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'Events' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('Events')}
        >
          Events
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'Users' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('Users')}
        >
          Users
        </button>
      </div>

      {isSearching ? (
        <div className={styles.loaderContainer}><div className={styles.spinner} /></div>
      ) : (
        <div className={styles.resultsArea}>
          
          {/* PHOTOS TAB */}
          {activeTab === 'Photos' && (
            media.length > 0 ? (
              <div className={styles.masonryGrid}>
                {media.map((item) => (
                  <div key={item.id} className={styles.mediaItem} onClick={() => setSelectedMedia(item)}>
                    {item.type === 'image' ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={item.url} 
                        alt="Search Result" 
                        className={styles.mediaContent} 
                      />
                    ) : (
                      <video src={item.url} className={styles.mediaContent} />
                    )}
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className={styles.emptyState}>No photos found with that tag. Try simple nouns like "mountain" or "smile".</div>
            ) : null
          )}

          {/* EVENTS TAB */}
          {activeTab === 'Events' && (
            events.length > 0 ? (
              <div className={styles.eventGrid}>
                {events.map((event) => (
                  <Link href={`/events/${event.id}`} key={event.id} className={styles.card} style={{ textDecoration: 'none' }}>
                    <div className={styles.cardImagePlaceholder} style={{ height: '160px', backgroundColor: 'var(--surface-3)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', position: 'relative', overflow: 'hidden' }}>
                      {event.coverImage ? (
                        <Image src={event.coverImage} alt={event.title} fill style={{objectFit: 'cover'}} />
                      ) : (
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)'}}>No Image</div>
                      )}
                      <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '0.8rem' }}>
                        {event.isPrivate ? <Lock size={12} style={{display:'inline', marginRight:'4px'}}/> : <Globe size={12} style={{display:'inline', marginRight:'4px'}}/>}
                        {event.isPrivate ? 'Private' : 'Public'}
                      </div>
                    </div>
                    <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--surface-2)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                      <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--text-primary)' }}>{event.title}</h3>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {new Date(event.date).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : searchQuery ? (
              <div className={styles.emptyState}>No events found.</div>
            ) : null
          )}

          {/* USERS TAB */}
          {activeTab === 'Users' && (
            users.length > 0 ? (
              <div className={styles.userGrid}>
                {users.map(u => (
                  <div key={u.id} className={styles.userCard}>
                    <div className={styles.userAvatar}>
                      <UserIcon size={32} />
                    </div>
                    <h3 className={styles.userName}>{u.name || 'Anonymous'}</h3>
                    <p className={styles.userRole}>{u.role}</p>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className={styles.emptyState}>No users found.</div>
            ) : null
          )}

        </div>
      )}

      {selectedMedia && (
        <MediaLightbox 
          media={selectedMedia} 
          onClose={() => setSelectedMedia(null)} 
        />
      )}
    </div>
  );
}

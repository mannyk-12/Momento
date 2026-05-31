'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/contexts/AuthContext';
import { db } from '../../lib/firebase/config';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { MomentoEvent } from '../../lib/types';
import { Plus, Search, Calendar, Filter, Lock, Globe, ImageIcon, Video, ChevronDown } from 'lucide-react';
import styles from './dashboard.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EventWithStats extends MomentoEvent {
  photoCount: number;
  videoCount: number;
  dynamicCoverImage: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, clubId, loading } = useAuth();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    const fetchEvents = async () => {
      try {
        const eventsRef = collection(db, 'events');
        const q = query(eventsRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedEvents: EventWithStats[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const baseData = { id: doc.id, ...data } as MomentoEvent;
          const eventData: EventWithStats = {
            ...baseData,
            photoCount: data.photoCount || 0,
            videoCount: data.videoCount || 0,
            dynamicCoverImage: data.coverImage || null
          };
          
          // Privacy Filter: Include if Admin, or Public, or Private & matches club
          if (role === 'Admin' || !eventData.isPrivate || eventData.clubId === clubId) {
            fetchedEvents.push(eventData);
          }
        });
        
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events", error);
      } finally {
        setLoadingEvents(false);
      }
    };

    if (!loading && user) {
      if (role === 'Admin') {
        router.replace('/admin');
        return;
      }
      fetchEvents();
    }
  }, [user, loading, clubId, role, router]);

  if (loading) {
    return <div className={styles.loaderContainer}><div className={styles.spinner} /></div>;
  }

  const canCreateEvent = role === 'Admin' || role === 'Photographer' || role === 'Club Member';

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Events Dashboard</h1>
          <p className={styles.subtitle}>Discover and manage your Momento events</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {canCreateEvent && (
            <Link href="/events/new" className={styles.createBtn}>
              <Plus size={20} /> Create Event
            </Link>
          )}
          <Link href="/search" className={styles.createBtn} style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <Search size={20} /> Advanced Search
          </Link>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search events by name..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(12); // reset pagination on search
            }}
          />
        </div>
        <div className={styles.filterBox} onMouseLeave={() => setIsDropdownOpen(false)}>
          <Filter size={20} className={styles.filterIcon} />
          <div 
            className={styles.customDropdown} 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className={styles.dropdownSelected}>
              {categoryFilter === 'All' ? 'All Categories' : categoryFilter}
            </span>
            <ChevronDown size={16} className={`${styles.dropdownChevron} ${isDropdownOpen ? styles.open : ''}`} />
            
            {isDropdownOpen && (
              <div className={styles.dropdownMenu}>
                {['All', 'Club Party', 'Concert', 'Workshop', 'Meetup'].map(cat => (
                  <div 
                    key={cat} 
                    className={`${styles.dropdownItem} ${categoryFilter === cat ? styles.activeItem : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryFilter(cat);
                      setVisibleCount(12);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {cat === 'All' ? 'All Categories' : cat}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loadingEvents ? (
        <div className={styles.loaderContainer}><div className={styles.spinner} /></div>
      ) : (
        <>
          <div className={styles.grid}>
            {visibleEvents.length > 0 ? (
              visibleEvents.map((event) => (
                <Link href={`/events/${event.id}`} key={event.id} className={styles.card} style={{ textDecoration: 'none' }}>
                  <div className={styles.cardImagePlaceholder}>
                    {event.coverImage ? (
                      <img src={event.coverImage} alt={event.title} className={styles.cardImage} />
                    ) : (
                      <div className={styles.noImage}>No Image</div>
                    )}
                    <span className={styles.categoryBadge}>{event.category}</span>
                    
                    {/* Privacy Indicator */}
                    <div className={styles.privacyIndicator}>
                      {event.isPrivate ? <Lock size={14} /> : <Globe size={14} />}
                      <span>{event.isPrivate ? 'Private' : 'Public'}</span>
                    </div>
                  </div>
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>{event.title}</h3>
                    <div className={styles.cardMeta}>
                      <Calendar size={14} />
                      <span>{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <p className={styles.cardDescription}>{event.description}</p>
                    
                    {/* Media Stats */}
                    <div className={styles.mediaStats}>
                      <div className={styles.statItem}>
                        <ImageIcon size={14} /> <span>{event.photoCount || 0}</span>
                      </div>
                      <div className={styles.statItem}>
                        <Video size={14} /> <span>{event.videoCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className={styles.emptyState}>
                <p>No events found matching your criteria.</p>
              </div>
            )}
          </div>
          
          {hasMore && (
            <div className={styles.loadMoreContainer}>
              <button 
                className={styles.loadMoreBtn}
                onClick={() => setVisibleCount(prev => prev + 12)}
              >
                Load More Events
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

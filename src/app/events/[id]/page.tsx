'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/config';
import { MomentoEvent, MediaItem } from '../../../lib/types';
import MediaUploader from '../../../components/MediaUploader';
import MediaLightbox from '../../../components/MediaLightbox';
import ManageUploadersModal from '../../../components/ManageUploadersModal';
import { ArrowLeft, Calendar, Image as ImageIcon, Video, Lock, Heart, Trash2, Loader2, Users, Globe } from 'lucide-react';
import Link from 'next/link';
import styles from './event-details.module.css';
import Image from 'next/image';
import { useAuth } from '../../../lib/contexts/AuthContext';

export default function EventDetailsPage() {
  const { id } = useParams();
  const eventId = id as string;
  const { user, role, clubId, loading: authLoading } = useAuth();
  
  const [event, setEvent] = useState<MomentoEvent | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showUploaderModal, setShowUploaderModal] = useState(false);

  // Auto-open media from query params (e.g. from notifications)
  useEffect(() => {
    const mediaId = searchParams?.get('media');
    if (mediaId && media.length > 0 && !selectedMedia) {
      const target = media.find(m => m.id === mediaId);
      if (target) {
        setSelectedMedia(target);
        router.replace(`/events/${eventId}`, { scroll: false });
      }
    }
  }, [searchParams, media, selectedMedia, router, eventId]);

  // Fetch Event Details
  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Fetch Event Details
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, 'events', eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() } as MomentoEvent;
          
          // Enforce Privacy at the route level
          if (eventData.isPrivate && eventData.clubId !== clubId && role !== 'Admin') {
            setAccessDenied(true);
          } else {
            setEvent(eventData);
          }
        }
      } catch (error) {
        console.error("Error fetching event details", error);
      } finally {
        setLoading(false);
      }
    };
    if (clubId !== undefined) {
      // wait until auth is loaded
      fetchEvent();
    }
  }, [eventId, clubId]);

  // Real-time listener for Media
  useEffect(() => {
    if (accessDenied || !event) return;

    const mediaRef = collection(db, 'media');
    const q = query(mediaRef, where('eventId', '==', eventId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMedia: MediaItem[] = [];
      snapshot.forEach((doc) => {
        fetchedMedia.push({ id: doc.id, ...doc.data() } as MediaItem);
      });
      // Sort by creation date (newest first)
      fetchedMedia.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setMedia(fetchedMedia);
      
      // Update selected media if it changes (e.g. someone liked it) without adding it to deps
      setSelectedMedia(prev => {
        if (!prev) return null;
        const updated = fetchedMedia.find(m => m.id === prev.id);
        return updated || prev;
      });
    });

    return () => unsubscribe();
  }, [eventId, accessDenied, event]);

  const [visibleMediaCount, setVisibleMediaCount] = useState(20);

  // To upload, you must be associated with the club (unless you are a global Admin)
  // Or, you must be an explicitly approved uploader for this event.
  const isCorrectClub = event?.clubId === clubId;
  const isApprovedUploader = event?.approvedUploaderIds?.includes(user?.uid || '');
  const canUpload = (role !== 'Viewer' && isCorrectClub) || role === 'Admin' || isApprovedUploader;
  const canManageEvent = event && user && (role === 'Admin' || user.uid === event.createdBy);

  const handleDeleteEvent = async () => {
    if (!confirm("Are you sure you want to delete this event and ALL its media? This cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
      const mediaRef = collection(db, 'media');
      const q = query(mediaRef, where('eventId', '==', eventId));
      const mediaSnap = await getDocs(q);
      
      const deletePromises = mediaSnap.docs.map(async (mediaDoc) => {
        const mediaData = mediaDoc.data() as MediaItem;
        try {
          const fileRef = ref(storage, mediaData.url);
          await deleteObject(fileRef);
        } catch(e) { console.error("Error deleting file", e) }
        await deleteDoc(doc(db, 'media', mediaDoc.id));
      });
      
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'events', eventId));
      router.replace('/dashboard');
    } catch(err) {
      console.error("Error deleting event", err);
      alert("Failed to delete event.");
      setIsDeleting(false);
    }
  };

  if (loading || isDeleting) return <div className={styles.loaderContainer}><div className={styles.spinner} /></div>;
  if (accessDenied) return (
    <div className={styles.container}>
      <Link href="/dashboard" className={styles.backLink}><ArrowLeft size={20} /> Back to Dashboard</Link>
      <div className={styles.notFound}>
        <Lock size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
        <h2>Private Event</h2>
        <p>This event is private and you do not have permission to view it.</p>
      </div>
    </div>
  );
  if (!event) return <div className={styles.notFound}>Event not found</div>;

  const visibleMedia = media.slice(0, visibleMediaCount);
  const hasMoreMedia = visibleMediaCount < media.length;

  return (
    <div className={styles.container}>
      <Link href="/dashboard" className={styles.backLink}>
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1 className={styles.title}>{event.title}</h1>
            {canManageEvent && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setShowUploaderModal(true)}
                  className={styles.actionBtn}
                  title="Manage Upload Access"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <Users size={18} /> Manage Access
                </button>
                <button 
                  onClick={handleDeleteEvent}
                  className={styles.deleteBtn}
                  title="Delete Event"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
          <div className={styles.meta}>
            <span className={styles.badge}>{event.category}</span>
            <span className={styles.date}>
              <Calendar size={16} /> {new Date(event.date).toLocaleDateString()}
            </span>
          </div>
          <p className={styles.description}>{event.description}</p>
        </div>
      </header>

      {canUpload && (
        <section className={styles.uploadSection}>
          <MediaUploader eventId={eventId} />
        </section>
      )}

      <section className={styles.gallerySection}>
        <h2 className={styles.galleryTitle}>Event Gallery ({media.length})</h2>
        
        {media.length > 0 ? (
          <>
            <div className={styles.masonryGrid}>
              {visibleMedia.map((item) => (
                <div 
                  key={item.id} 
                  className={styles.mediaItem}
                  onClick={() => setSelectedMedia(item)}
                >
                  {item.type === 'image' ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={item.url} 
                      alt="Event Media" 
                      className={styles.mediaContent} 
                    />
                  ) : (
                    <video src={item.url} className={styles.mediaContent} />
                  )}
                  
                  <div className={styles.mediaOverlay}>
                    <div className={styles.overlayTop}>
                      {item.type === 'image' ? <ImageIcon size={20} /> : <Video size={20} />}
                    </div>
                    <div className={styles.overlayBottom}>
                      <span className={styles.likeCount}>
                        <Heart size={16} fill="currentColor" /> {item.likedBy?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMoreMedia && (
              <div className={styles.loadMoreContainer}>
                <button 
                  className={styles.loadMoreBtn}
                  onClick={() => setVisibleMediaCount(prev => prev + 20)}
                >
                  Load More Media
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyGallery}>
            <p>No media uploaded yet. Be the first to add memories!</p>
          </div>
        )}
      </section>

      {selectedMedia && (
        <MediaLightbox 
          media={selectedMedia} 
          onClose={() => setSelectedMedia(null)} 
        />
      )}
      {showUploaderModal && event && (
        <ManageUploadersModal
          eventId={event.id}
          eventClubId={event.clubId}
          currentUserRole={role || 'Viewer'}
          currentApprovedIds={event.approvedUploaderIds || []}
          onClose={() => setShowUploaderModal(false)}
          onUpdate={(newIds) => setEvent({ ...event, approvedUploaderIds: newIds })}
        />
      )}
    </div>
  );
}

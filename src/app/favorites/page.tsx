'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MediaItem } from '../../lib/types';
import MediaLightbox from '../../components/MediaLightbox';
import { Heart, Image as ImageIcon, Video, Bookmark } from 'lucide-react';
import { useAuth } from '../../lib/contexts/AuthContext';
import styles from './favorites.module.css';

export default function FavoritesPage() {
  const { user } = useAuth();
  
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Fetch Favorited Media
  useEffect(() => {
    if (!user) return;

    const mediaRef = collection(db, 'media');
    // We query media where the favoritedBy array contains the current user's UID
    const q = query(mediaRef, where('favoritedBy', 'array-contains', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMedia: MediaItem[] = [];
      snapshot.forEach((doc) => {
        fetchedMedia.push({ id: doc.id, ...doc.data() } as MediaItem);
      });
      // Sort by creation date (newest first)
      fetchedMedia.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMedia(fetchedMedia);
      
      if (selectedMedia) {
        const updated = fetchedMedia.find(m => m.id === selectedMedia.id);
        if (updated) setSelectedMedia(updated);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedMedia]);

  if (loading) return <div className={styles.loaderContainer}><div className={styles.spinner} /></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleWrapper}>
            <Bookmark size={32} className={styles.titleIcon} />
            <h1 className={styles.title}>Your Favorites</h1>
          </div>
          <p className={styles.description}>
            All the photos and videos you have bookmarked across all events.
          </p>
        </div>
      </header>

      <section className={styles.gallerySection}>
        {media.length > 0 ? (
          <div className={styles.masonryGrid}>
            {media.map((item) => (
              <div 
                key={item.id} 
                className={styles.mediaItem}
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt="Favorited Media" loading="lazy" className={styles.mediaContent} />
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
        ) : (
          <div className={styles.emptyGallery}>
            <Bookmark size={48} className={styles.emptyIcon} />
            <h3>No Favorites Yet</h3>
            <p>Go to an event and click the bookmark icon on any photo to save it here!</p>
          </div>
        )}
      </section>

      {selectedMedia && (
        <MediaLightbox 
          media={selectedMedia} 
          onClose={() => setSelectedMedia(null)} 
        />
      )}
    </div>
  );
}

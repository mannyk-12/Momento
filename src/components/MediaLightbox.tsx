'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../lib/firebase/config';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '../lib/contexts/AuthContext';
import { MediaItem, Comment } from '../lib/types';
import { X, Heart, Bookmark, MessageCircle, Share2, Download, Send, Loader2, Trash2 } from 'lucide-react';
import styles from './MediaLightbox.module.css';

interface MediaLightboxProps {
  media: MediaItem;
  onClose: () => void;
}

export default function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  const { user, role } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Initial Like/Favorite status
  useEffect(() => {
    if (!user) return;
    setIsLiked(media.likedBy?.includes(user.uid) || false);
    setIsFavorited(media.favoritedBy?.includes(user.uid) || false);
  }, [media, user]);

  // Fetch comments
  useEffect(() => {
    const q = query(collection(db, 'comments'), where('mediaId', '==', media.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Comment[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Comment);
      });
      // Sort oldest first for chat-like view
      fetched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(fetched);
      
      // Scroll to bottom
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [media.id]);

  const toggleLike = async () => {
    if (!user) return;
    const mediaRef = doc(db, 'media', media.id);
    const currentlyLiked = isLiked;
    
    // Optimistic update
    setIsLiked(!currentlyLiked);

    try {
      if (currentlyLiked) {
        await updateDoc(mediaRef, { likedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(mediaRef, { likedBy: arrayUnion(user.uid) });
        // Create Notification (Only if not liking own media)
        if (user.uid !== media.uploadedBy) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: media.uploadedBy,
            senderId: user.uid,
            senderName: user.displayName || user.email?.split('@')[0] || 'Someone',
            type: 'like',
            mediaId: media.id,
            eventId: media.eventId,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("Error toggling like", err);
      setIsLiked(currentlyLiked); // Revert on failure
    }
  };

  const toggleFavorite = async () => {
    if (!user) return;
    const mediaRef = doc(db, 'media', media.id);
    const currentlyFav = isFavorited;
    
    setIsFavorited(!currentlyFav);

    try {
      if (currentlyFav) {
        await updateDoc(mediaRef, { favoritedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(mediaRef, { favoritedBy: arrayUnion(user.uid) });
      }
    } catch (err) {
      console.error("Error toggling favorite", err);
      setIsFavorited(currentlyFav);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this photo on Momento!',
          url: window.location.href, // Sharing the event URL
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error("Error sharing", err);
    }
  };

  const canDeleteMedia = user && (role === 'Admin' || user.uid === media.uploadedBy);

  const handleDeleteMedia = async () => {
    if (!confirm("Are you sure you want to delete this media?")) return;
    try {
      const fileRef = ref(storage, media.url);
      await deleteObject(fileRef);
    } catch(e) { 
      // If it's an old file uploaded before metadata rules, it might fail.
      // We log quietly so it doesn't trigger the Next.js red error overlay
      console.warn("Could not delete file from storage (might be legacy):", e); 
    }
    
    try {
      await deleteDoc(doc(db, 'media', media.id));
      
      // Update event cover image and counters if this was part of an event
      if (media.eventId) {
        const eventRef = doc(db, 'events', media.eventId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data();
          
          // Recalculate counts
          const mediaQuery = query(
            collection(db, 'media'), 
            where('eventId', '==', media.eventId)
          );
          const mediaSnap = await getDocs(mediaQuery);
          
          let totalPhotos = 0;
          let totalVideos = 0;
          let newCoverImage = eventData.coverImage;

          mediaSnap.forEach(m => {
            if (m.data().type === 'image') totalPhotos++;
            if (m.data().type === 'video') totalVideos++;
          });

          if (eventData.coverImage === media.url) {
            const firstImage = mediaSnap.docs.find(d => d.data().type === 'image');
            newCoverImage = firstImage ? firstImage.data().url : null;
          }

          const updates: any = {
            photoCount: totalPhotos,
            videoCount: totalVideos
          };
          if (newCoverImage !== undefined) {
            updates.coverImage = newCoverImage;
          }

          await updateDoc(eventRef, updates);
        }
      }

      onClose();
    } catch(e) { console.error("Error deleting media doc", e) }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch(e) { console.error("Error deleting comment", e) }
  };

  const handleReply = (userName: string) => {
    setNewComment(prev => {
      const mention = `@${userName} `;
      return prev.includes(mention) ? prev : `${mention}${prev}`;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 10);
  };

  const toggleCommentLike = async (comment: Comment) => {
    if (!user) return;
    const commentRef = doc(db, 'comments', comment.id);
    const hasLiked = comment.likedBy?.includes(user.uid);
    
    try {
      if (hasLiked) {
        await updateDoc(commentRef, { likedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(commentRef, { likedBy: arrayUnion(user.uid) });
        // Send notification
        if (comment.userId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: comment.userId,
            senderId: user.uid,
            senderName: user.displayName || user.email?.split('@')[0] || 'Someone',
            type: 'comment_like',
            mediaId: media.id,
            eventId: media.eventId,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("Error toggling comment like", err);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    const text = newComment.trim();
    setNewComment(''); // Clear input

    try {
      // Extract @mentions reliably by checking against all known user names
      const usersSnap = await getDocs(collection(db, 'users'));
      const mentions: string[] = [];
      const mentionedUserDocs: any[] = [];
      
      usersSnap.forEach(doc => {
        const userName = doc.data().name;
        if (userName && text.includes(`@${userName}`)) {
          mentions.push(userName);
          mentionedUserDocs.push({ id: doc.id, ...doc.data() });
        }
      });
      await addDoc(collection(db, 'comments'), {
        mediaId: media.id,
        eventId: media.eventId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'User',
        text,
        mentions,
        createdAt: new Date().toISOString()
      });

      // Notification for comment
      if (user.uid !== media.uploadedBy) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: media.uploadedBy,
          senderId: user.uid,
          senderName: user.displayName || user.email?.split('@')[0] || 'Someone',
          type: 'comment',
          mediaId: media.id,
          eventId: media.eventId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      // Notify mentioned users
      if (mentionedUserDocs.length > 0) {
        mentionedUserDocs.forEach((userDoc) => {
          if (userDoc.id !== user.uid) {
            addDoc(collection(db, 'notifications'), {
              recipientId: userDoc.id,
              senderId: user.uid,
              senderName: user.displayName || user.email?.split('@')[0] || 'Someone',
              type: 'mention',
              mediaId: media.id,
              eventId: media.eventId,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

    } catch (err) {
      console.error("Error submitting comment", err);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (media.type === 'video') {
      // Videos are hard to composite client-side, just download normally
      window.open(media.url, '_blank');
      return;
    }

    setIsDownloading(true);
    try {
      // 1. Fetch Event and Club metadata
      const eventDoc = await getDoc(doc(db, 'events', media.eventId));
      let eventTitle = 'Momento Event';
      let clubName = '';
      
      if (eventDoc.exists()) {
        eventTitle = eventDoc.data().title;
        const clubId = eventDoc.data().clubId;
        if (clubId) {
          const clubDoc = await getDoc(doc(db, 'clubs', clubId));
          if (clubDoc.exists()) {
            clubName = clubDoc.data().name;
          }
        }
      }

      // 2. Fetch the image via proxy to bypass CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(media.url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // 3. Draw on Canvas
      const img = new Image();
      img.src = objectUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // 4. Configure Text Rendering
      // We'll scale font size based on image width to keep it consistent
      const fontSize = Math.max(16, Math.floor(canvas.width * 0.012)); 
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      
      // Shadow for readability on light/dark backgrounds
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Text color
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

      // 5. Construct Watermark Text
      const parts = ['Momento'];
      if (clubName) parts.push(clubName);
      parts.push(eventTitle);
      
      const watermarkText = parts.join(' | ');

      // Position: bottom right with some padding
      const paddingX = Math.floor(canvas.width * 0.03);
      const paddingY = Math.floor(canvas.height * 0.03);

      ctx.fillText(watermarkText, canvas.width - paddingX, canvas.height - paddingY);

      // 6. Convert to Blob and Download
      canvas.toBlob((watermarkedBlob) => {
        if (!watermarkedBlob) {
          setIsDownloading(false);
          return;
        }
        
        const downloadUrl = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `momento_${media.id}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(objectUrl);
        setIsDownloading(false);
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error("Error creating watermark", err);
      // Fallback to normal download if canvas trick fails
      window.open(media.url, '_blank');
      setIsDownloading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeBtn} onClick={onClose}>
        <X size={24} />
      </button>

      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        
        {/* Left Side: Media Display */}
        <div className={styles.mediaContainer}>
          {media.type === 'video' ? (
            <video src={media.url} controls autoPlay className={styles.mediaElement} />
          ) : (
            <img src={media.url} alt="Event Media" className={styles.mediaElement} />
          )}
        </div>

        {/* Right Side: Interactions & Comments */}
        <div className={styles.sidebar}>
          
          {/* Action Bar */}
          <div className={styles.actionBar}>
            <div className={styles.actionGroup}>
              <button onClick={toggleLike} className={`${styles.actionBtn} ${isLiked ? styles.activeLike : ''}`}>
                <Heart size={24} fill={isLiked ? "currentColor" : "none"} />
                <span>{media.likedBy?.length || 0}</span>
              </button>
              
              <button onClick={() => {}} className={styles.actionBtn}>
                <MessageCircle size={24} />
                <span>{comments.length}</span>
              </button>

              <button onClick={handleShare} className={styles.actionBtn}>
                <Share2 size={24} />
              </button>
            </div>

            <div className={styles.actionGroup}>
              {canDeleteMedia && (
                <button 
                  onClick={handleDeleteMedia} 
                  className={styles.actionBtn}
                  style={{ color: '#ef4444' }}
                  title="Delete Media"
                >
                  <Trash2 size={24} />
                </button>
              )}
              <button 
                onClick={handleDownload} 
                className={styles.actionBtn}
                disabled={isDownloading}
                title="Download Watermarked Image"
              >
                {isDownloading ? <Loader2 size={24} className={styles.spinnerIcon} /> : <Download size={24} />}
              </button>
              <button onClick={toggleFavorite} className={`${styles.actionBtn} ${isFavorited ? styles.activeFav : ''}`}>
                <Bookmark size={24} fill={isFavorited ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          {/* Comments Feed */}
          <div className={styles.commentsFeed}>
            {comments.length === 0 ? (
              <div className={styles.emptyComments}>
                <p>No comments yet. Be the first to start the conversation!</p>
              </div>
            ) : (
              comments.map(c => (
                <div key={c.id} className={styles.commentItem}>
                  <div className={styles.commentAvatar}>
                    {c.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.commentContent}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentUser}>{c.userName}</span>
                      <span className={styles.commentTime}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={styles.commentText}>
                      {(() => {
                        const text = c.text;
                        const mentions = c.mentions || [];
                        if (!mentions || mentions.length === 0) return text;
                        
                        const escapedMentions = mentions.map(m => `@${m}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                        const regex = new RegExp(`(${escapedMentions.join('|')})`, 'gi');
                        const parts = text.split(regex);
                        
                        return parts.map((part, i) => {
                          if (escapedMentions.some(m => new RegExp(`^${m}$`, 'i').test(part))) {
                            return <span key={i} className={styles.mention}>{part}</span>;
                          }
                          return <span key={i}>{part}</span>;
                        });
                      })()}
                    </p>
                    <div className={styles.commentActions}>
                      <button 
                        className={styles.commentActionBtn}
                        onClick={() => handleReply(c.userName)}
                      >
                        Reply
                      </button>
                      {(role === 'Admin' || user?.uid === c.userId) && (
                        <button 
                          className={styles.commentActionBtn}
                          style={{ color: '#ef4444' }}
                          onClick={() => handleDeleteComment(c.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <button 
                    className={styles.commentLikeBtn}
                    onClick={() => toggleCommentLike(c)}
                  >
                    <Heart 
                      size={14} 
                      fill={c.likedBy?.includes(user?.uid || '') ? "#ef4444" : "none"} 
                      color={c.likedBy?.includes(user?.uid || '') ? "#ef4444" : "currentColor"}
                    />
                  </button>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Comment Input */}
          {user && (
            <form onSubmit={submitComment} className={styles.commentForm}>
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Add a comment... (use @ to mention)"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className={styles.commentInput}
              />
              <button type="submit" disabled={!newComment.trim()} className={styles.sendBtn}>
                <Send size={20} />
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

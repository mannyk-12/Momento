'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, UserMinus } from 'lucide-react';
import { updateDoc, doc, collection, query, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { UserProfile } from '../lib/types';
import styles from './ManageUploadersModal.module.css';

interface Props {
  eventId: string;
  eventClubId: string;
  currentApprovedIds: string[];
  currentUserRole: string;
  onClose: () => void;
  onUpdate: (newIds: string[]) => void;
}

export default function ManageUploadersModal({ eventId, eventClubId, currentApprovedIds, currentUserRole, onClose, onUpdate }: Props) {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch only approved users on mount
  useEffect(() => {
    const fetchApproved = async () => {
      if (currentApprovedIds.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const chunk = currentApprovedIds.slice(0, 30);
        const q = query(collection(db, 'users'), where('uid', 'in', chunk));
        const snap = await getDocs(q);
        const data: UserProfile[] = [];
        snap.forEach(doc => data.push(doc.data() as UserProfile));
        setUsersList(data);
      } catch (err) {
        console.error("Failed to fetch approved users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchApproved();
  }, [currentApprovedIds]);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      if (!searchQuery.trim()) {
        // Revert to showing approved users
        if (currentApprovedIds.length === 0) {
          setUsersList([]);
          setLoading(false);
          return;
        }
        try {
          const chunk = currentApprovedIds.slice(0, 30);
          const q = query(collection(db, 'users'), where('uid', 'in', chunk));
          const snap = await getDocs(q);
          const data: UserProfile[] = [];
          snap.forEach(doc => data.push(doc.data() as UserProfile));
          setUsersList(data);
        } catch (err) {
          console.error("Failed to fetch approved users", err);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        // We will perform a client-side query to avoid backend admin SDK credential issues
        // Since Firestore range queries are case-sensitive, we'll try to find by exact email first,
        // or prefix match on name. To avoid complex indexes, we'll just fetch a small chunk
        // and filter in memory. Since we can't do case-insensitive search easily, we'll just fetch 
        // a limited number of users (e.g. 50) and filter them.
        const q = query(collection(db, 'users'), limit(100));
        const snap = await getDocs(q);
        
        let data: UserProfile[] = [];
        const searchLower = searchQuery.trim().toLowerCase();
        
        snap.forEach(doc => {
          const u = doc.data() as UserProfile;
          if (u.name.toLowerCase().includes(searchLower) || u.email.toLowerCase().includes(searchLower)) {
            data.push(u);
          }
        });
        
        // Filter out users who inherently have access if the current user is NOT an Admin
        if (currentUserRole !== 'Admin') {
          data = data.filter((u: UserProfile) => !(u.role !== 'Viewer' && u.clubId === eventClubId));
        }
        
        setUsersList(data.slice(0, 10)); // Only show top 10 results
      } catch (err) {
        console.error("Failed to search users", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, eventClubId, currentUserRole, currentApprovedIds]);

  const filteredUsers = usersList;

  const toggleAccess = async (userId: string) => {
    setProcessingId(userId);
    try {
      const isCurrentlyApproved = currentApprovedIds.includes(userId);
      let newApprovedIds;
      
      if (isCurrentlyApproved) {
        newApprovedIds = currentApprovedIds.filter(id => id !== userId);
      } else {
        newApprovedIds = [...currentApprovedIds, userId];
      }

      await updateDoc(doc(db, 'events', eventId), {
        approvedUploaderIds: newApprovedIds
      });

      onUpdate(newApprovedIds);
    } catch (err) {
      console.error("Failed to update access", err);
      alert("Failed to update access. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Manage Upload Access</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search users by name or email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
          </div>

          <div className={styles.photographerList}>
            {loading ? (
              <div className={styles.loaderContainer}><div className={styles.spinner} /></div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No users found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredUsers.map(u => {
                const isApproved = currentApprovedIds.includes(u.uid);
                const isProcessing = processingId === u.uid;

                return (
                  <div key={u.uid} className={styles.photographerItem}>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{u.name} <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>({u.role})</span></span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                    
                    <button 
                      className={`${styles.actionBtn} ${isApproved ? styles.removeBtn : styles.addBtn}`}
                      onClick={() => toggleAccess(u.uid)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />
                      ) : isApproved ? (
                        <><UserMinus size={14} /> Remove Access</>
                      ) : (
                        <><UserPlus size={14} /> Grant Access</>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

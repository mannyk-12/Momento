'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/contexts/AuthContext';
import { db } from '../lib/firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { Bell, User as UserIcon, LogOut, Check, Bookmark, Database } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './Navbar.module.css';
import { Notification } from '../lib/types';

export default function Navbar() {
  const { user, logout, role } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real-time notifications
  useEffect(() => {
    if (!user) return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const fetched: Notification[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(fetched);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) return null; // Don't show navbar if not logged in

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/dashboard" className={styles.logo}>
          Momento
        </Link>

        <div className={styles.navActions}>
          {/* Notifications Dropdown */}
          <div className={styles.dropdownContainer} ref={notifRef}>
            <button
              className={styles.iconBtn}
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownHeader}>
                  <h4>Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className={styles.textBtn}>
                      <Check size={14} /> Mark all read
                    </button>
                  )}
                </div>
                <div className={styles.notifList}>
                  {notifications.length === 0 ? (
                    <p className={styles.emptyText}>No notifications yet.</p>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`${styles.notifItem} ${!notif.read ? styles.unread : ''}`}
                        onClick={() => {
                          markAsRead(notif.id);
                          const url = notif.mediaId ? `/events/${notif.eventId}?media=${notif.mediaId}` : `/events/${notif.eventId}`;
                          router.push(url);
                          setShowNotifications(false);
                        }}
                      >
                        <div className={styles.notifContent}>
                          <p>
                            <strong>@{notif.senderName}</strong>{' '}
                            {notif.type === 'like' && 'liked your photo.'}
                            {notif.type === 'comment' && 'commented on your photo.'}
                            {notif.type === 'mention' && 'replied to you in a comment.'}
                            {notif.type === 'comment_like' && 'liked your comment.'}
                            {notif.type === 'photo_tag' && 'tagged you in a photo.'}
                          </p>
                          <span className={styles.timeAgo}>
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {!notif.read && <div className={styles.unreadDot} />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className={styles.dropdownContainer} ref={profileRef}>
            <button
              className={styles.iconBtn}
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
            >
              <UserIcon size={20} />
            </button>

            {showProfileMenu && (
              <div className={styles.dropdownMenu}>
                <div className={styles.profileHeader}>
                  <p className={styles.profileEmail}>{user.email}</p>
                  <p className={styles.profileRole}>{role}</p>
                </div>
                <div className={styles.menuActions}>
                  {role === 'Admin' && (
                    <Link href="/admin" className={styles.menuLink} onClick={() => setShowProfileMenu(false)}>
                      <Database size={16} /> Developer Console
                    </Link>
                  )}
                  <Link href="/favorites" className={styles.menuLink} onClick={() => setShowProfileMenu(false)}>
                    <Bookmark size={16} /> My Favorites
                  </Link>
                  <button onClick={handleLogout} className={styles.logoutBtn}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

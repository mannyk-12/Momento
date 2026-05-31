'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../../lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Calendar, Image as ImageIcon, BarChart3, Database, Lock, Globe, Plus, Search, Trash2 } from 'lucide-react';
import styles from './admin.module.css';
import { MomentoEvent } from '../../lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type Tab = 'Analytics' | 'Events' | 'Users';

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<Tab>('Analytics');
  
  const [stats, setStats] = useState({
    users: 0,
    events: 0,
    media: 0,
    clubs: 0,
    comments: 0
  });
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<MomentoEvent[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (role !== 'Admin') {
        router.replace('/dashboard');
        return;
      }
    }

    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const eventsQ = query(collection(db, 'events'), orderBy('date', 'desc'));
        const eventsSnap = await getDocs(eventsQ);
        const mediaSnap = await getDocs(collection(db, 'media'));
        const clubsSnap = await getDocs(collection(db, 'clubs'));
        const commentsSnap = await getDocs(collection(db, 'comments'));

        setStats({
          users: usersSnap.size,
          events: eventsSnap.size,
          media: mediaSnap.size,
          clubs: clubsSnap.size,
          comments: commentsSnap.size
        });

        const usersList: any[] = [];
        usersSnap.forEach(d => usersList.push({ id: d.id, ...d.data() }));
        setAllUsers(usersList);

        const eventsList: MomentoEvent[] = [];
        eventsSnap.forEach(d => eventsList.push({ id: d.id, ...d.data() } as MomentoEvent));
        setAllEvents(eventsList);

      } catch (err) {
        console.error("Error fetching admin stats", err);
      } finally {
        setStatsLoading(false);
      }
    };

    if (role === 'Admin') {
      fetchData();
    }
  }, [role, loading, router]);

  // Chart Data Processors
  const roleDistributionData = useMemo(() => {
    const counts: Record<string, number> = {
      'Admin': 0, 'Photographer': 0, 'Club Member': 0, 'Viewer': 0
    };
    allUsers.forEach(u => {
      if (counts[u.role] !== undefined) {
        counts[u.role]++;
      } else {
        counts['Viewer']++; // Fallback
      }
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).filter(item => item.value > 0);
  }, [allUsers]);

  const eventGrowthData = useMemo(() => {
    const monthlyCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const date = new Date(e.createdAt || e.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });
    
    // Sort chronologically
    return Object.keys(monthlyCounts).sort().map(key => ({
      name: key,
      events: monthlyCounts[key]
    }));
  }, [allEvents]);

  const COLORS = ['#818cf8', '#34d399', '#60a5fa', '#9ca3af'];

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!user) return;
    if (uid === user.uid) {
      alert("You cannot delete yourself.");
      return;
    }
    
    const confirmDelete = window.confirm(`Are you sure you want to completely delete user ${name}? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, adminUid: user.uid })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      // Update UI
      setAllUsers(prev => prev.filter(u => u.id !== uid));
      setStats(prev => ({ ...prev, users: prev.users - 1 }));
      alert("User deleted successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting user');
    }
  };

  if (loading || statsLoading) {
    return <div className={styles.loaderContainer}><div className={styles.spinner} /></div>;
  }

  if (role !== 'Admin') return null;

  return (
    <div className={styles.container}>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.iconWrapper}>
            <Database size={48} className={styles.headerIcon} />
          </div>
          <div>
            <h1 className={styles.title}>Developer Console</h1>
            <p className={styles.subtitle}>Ultimate platform oversight and management</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <Link href="/events/new" className={styles.createBtn}>
            <Plus size={20} /> Create Event
          </Link>
          <Link href="/search" className={styles.createBtn} style={{ backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <Search size={20} /> Advanced Search
          </Link>
        </div>
      </header>

      <div className={styles.tabsContainer}>
        {(['Analytics', 'Events', 'Users'] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Analytics' && (
        <>
          <div className={styles.grid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>
                <Users size={32} />
              </div>
              <div className={styles.statInfo}>
                <h3>Total Users</h3>
                <p className={styles.statValue}>{stats.users}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                <Calendar size={32} />
              </div>
              <div className={styles.statInfo}>
                <h3>Total Events</h3>
                <p className={styles.statValue}>{stats.events}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }}>
                <ImageIcon size={32} />
              </div>
              <div className={styles.statInfo}>
                <h3>Total Media Items</h3>
                <p className={styles.statValue}>{stats.media}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
                <BarChart3 size={32} />
              </div>
              <div className={styles.statInfo}>
                <h3>Total Comments</h3>
                <p className={styles.statValue}>{stats.comments}</p>
              </div>
            </div>
          </div>

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3>Role Distribution</h3>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={roleDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {roleDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <h3>Event Growth (Monthly)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={eventGrowthData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                  <YAxis allowDecimals={false} stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="events" stroke="var(--accent-primary)" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'Events' && (
        <div className={styles.eventsGrid}>
          {allEvents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No events on the platform.</p>
          ) : (
            allEvents.map((event) => (
              <Link href={`/events/${event.id}`} key={event.id} className={styles.eventCard}>
                <div className={styles.cardImagePlaceholder}>
                  {event.coverImage ? (
                    <img src={event.coverImage} alt={event.title} className={styles.cardImage} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                  <span className={styles.categoryBadge}>{event.category}</span>
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
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === 'Users' && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name || 'Unknown'}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`${styles.roleBadge} ${u.role === 'Admin' ? styles.admin : u.role === 'Photographer' ? styles.photographer : styles.member}`}>
                      {u.role || 'Viewer'}
                    </span>
                  </td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {user?.uid !== u.id && (
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                        className={styles.deleteUserBtn}
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

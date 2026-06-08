'use client';

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { storage, db } from '../lib/firebase/config';
import { useAuth } from '../lib/contexts/AuthContext';
import styles from './MediaUploader.module.css';
import imageCompression from 'browser-image-compression';

interface MediaUploaderProps {
  eventId: string;
}

export default function MediaUploader({ eventId }: MediaUploaderProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [fileTags, setFileTags] = useState<{ [key: string]: string }>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles: File[] = [];
    const heicFileNames: string[] = [];

    for (const file of acceptedFiles) {
      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
        heicFileNames.push(file.name);
      } else {
        validFiles.push(file);
      }
    }

    if (heicFileNames.length > 0) {
      alert(`Apple HEIC format is not supported. Please convert the following files to JPG before uploading:\n\n${heicFileNames.join(', ')}`);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true, // We will use a dedicated button for clicking
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi']
    }
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileTags(prev => {
      const newTags = { ...prev };
      delete newTags[fileToRemove.name];
      return newTags;
    });

    // Adjust selected index if needed
    if (index === selectedIndex) {
      setSelectedIndex(0);
    } else if (index < selectedIndex) {
      setSelectedIndex(prev => prev - 1);
    }
  };

  const cancelUpload = () => {
    if (uploading) return;
    setFiles([]);
    setFileTags({});
    setSelectedIndex(0);
  };

  const handleTagChange = (fileName: string, tags: string) => {
    setFileTags(prev => ({
      ...prev,
      [fileName]: tags
    }));
  };

  const uploadFiles = async () => {
    if (!user) return;
    setUploading(true);

    const promises = files.map(async (file) => {
      let finalFile: File | Blob = file;
      const isVideo = file.type.startsWith('video');

      // Compress Images
      if (!isVideo) {
        try {
          const imageCompression = (await import('browser-image-compression')).default;
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          finalFile = await imageCompression(file, options);
        } catch (error) {
          console.warn("Compression warning:", error);
          // fallback to original file
        }
      }

      // Start Cloud Vision API request concurrently
      const getVisionTags = async (): Promise<string[]> => {
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || isVideo) return [];
        try {
          const toBase64 = (f: File | Blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = e => reject(e);
          });

          // Downscale the image to a small thumbnail to save Vision API bandwidth/processing time
          const thumbnailFile = await imageCompression(finalFile as File, {
            maxWidthOrHeight: 500,
            useWebWorker: true
          });
          const base64Image = await toBase64(thumbnailFile);
          const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Image },
                features: [
                  { type: 'LABEL_DETECTION', maxResults: 5 },
                  { type: 'WEB_DETECTION', maxResults: 5 }
                ]
              }]
            })
          });
          const data = await response.json();
          const annotations = data.responses?.[0] || {};
          
          const labelTags = (annotations.labelAnnotations || [])
            .filter((l: any) => l.score > 0.75)
            .map((l: any) => l.description.toLowerCase());

          const webTags = (annotations.webDetection?.webEntities || [])
            .filter((w: any) => w.score > 0.75 && w.description)
            .map((w: any) => w.description.toLowerCase());

          return Array.from(new Set([...labelTags, ...webTags]));
        } catch (err) {
          console.error("Vision API Error:", err);
          return [];
        }
      };

      const visionTagsPromise = getVisionTags();

      return new Promise<{ type: 'image' | 'video', url: string }>((resolve, reject) => {
        const fileId = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `events/${eventId}/${fileId}`);
        // Explicitly set contentType to ensure Firebase serves it correctly
        const uploadTask = uploadBytesResumable(storageRef, finalFile, { 
          contentType: finalFile.type,
          customMetadata: {
            uploadedBy: user.uid
          }
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(prev => ({ ...prev, [file.name]: progressValue }));
          },
          (error) => {
            console.error("Upload failed", error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const rawTags = fileTags[file.name] || '';

              // Extract manual mentions/tags
              let manualTags: string[] = [];
              const rawParts = rawTags.split(',').map(name => name.trim()).filter(name => name.length > 0);
              
              rawParts.forEach(part => {
                if (part.startsWith('@')) {
                  manualTags.push(part.substring(1));
                } else {
                  manualTags.push(part);
                }
              });

              // Await Vision API tags (it likely finished during the upload)
              const aiTags = await visionTagsPromise;
              const combinedTags = Array.from(new Set([...manualTags, ...aiTags]));

              // Tokenization function to allow fuzzy matching in search
              const tokenize = (text: string) => {
                const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                return clean.split(' ').filter(w => w.length > 2); // only keep words > 2 letters
              };
              
              // Tokenize all tags and combine them with the original full strings
              let tokenizedTags: string[] = [...combinedTags];
              combinedTags.forEach(tag => {
                const tokens = tokenize(tag);
                tokenizedTags = tokenizedTags.concat(tokens);
              });
              // Remove any duplicates that arose from tokenization
              tokenizedTags = Array.from(new Set(tokenizedTags));

              // Save reference in Firestore
              const docRef = await addDoc(collection(db, 'media'), {
                eventId,
                uploadedBy: user.uid,
                url: downloadURL,
                type: isVideo ? 'video' : 'image',
                status: 'ready',
                createdAt: new Date().toISOString(),
                tags: tokenizedTags
              });

              // Create notifications for tagged users (only manual tags which are user names)
              for (const mentionedName of manualTags) {
                const usersQuery = query(collection(db, 'users'), where('name', '==', mentionedName));
                const usersSnap = await getDocs(usersQuery);

                const notificationPromises = usersSnap.docs.map(userDoc => {
                  const targetUid = userDoc.id;
                  if (targetUid !== user.uid) { // don't notify self
                    return addDoc(collection(db, 'notifications'), {
                      recipientId: targetUid,
                      senderId: user.uid,
                      senderName: user.displayName || user.email?.split('@')[0] || 'Someone',
                      type: 'photo_tag',
                      mediaId: docRef.id,
                      eventId: eventId,
                      read: false,
                      createdAt: new Date().toISOString()
                    });
                  }
                  return Promise.resolve();
                });
                await Promise.all(notificationPromises);
              }

              resolve({ type: isVideo ? 'video' : 'image', url: downloadURL });
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    });

    try {
      const results = await Promise.all(promises);

      // Calculate Stats
      let newPhotos = 0;
      let newVideos = 0;
      let firstImage: string | null = null;

      results.forEach(res => {
        if (res.type === 'image') {
          newPhotos++;
          if (!firstImage) firstImage = res.url;
        }
        if (res.type === 'video') newVideos++;
      });

      // Update Event Document with stats
      if (newPhotos > 0 || newVideos > 0) {
        const { doc, getDoc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);

        const updates: any = {};

        if (eventSnap.exists()) {
          const eData = eventSnap.data();

          // ALWAYS RECALCULATE: To ensure consistency across old and new events,
          // we fetch the exact number of media items. (This is fast because it's only scoped to one event)
          const mediaQ = query(collection(db, 'media'), where('eventId', '==', eventId));
          const mediaSnap = await getDocs(mediaQ);

          let totalPhotos = 0;
          let totalVideos = 0;
          mediaSnap.forEach(m => {
            if (m.data().type === 'image') totalPhotos++;
            if (m.data().type === 'video') totalVideos++;
          });

          updates.photoCount = totalPhotos;
          updates.videoCount = totalVideos;

          if (!eData.coverImage && firstImage) {
            updates.coverImage = firstImage;
          }
        }

        await updateDoc(eventRef, updates);
      }

      setFiles([]);
      setProgress({});
      setFileTags({});
      setSelectedIndex(0);
    } catch (err) {
      console.error("Some files failed to upload", err);
    } finally {
      setUploading(false);
    }
  };

  const selectedFile = files[selectedIndex];
  const selectedObjectUrl = selectedFile ? URL.createObjectURL(selectedFile) : '';
  const selectedIsVideo = selectedFile?.type.startsWith('video');

  return (
    <div className={styles.container}>
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}
      >
        <input {...getInputProps()} />
        <UploadCloud size={48} className={styles.icon} />
        <p className={styles.text}>
          {isDragActive ? "Drop files here..." : "Drag & drop photos or videos here"}
        </p>
        <button type="button" onClick={open} className={styles.browseBtn}>
          Browse Device Files
        </button>
      </div>

      {files.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className={styles.studioModal}>
          <div className={styles.studioHeader}>
            <h2 className={styles.studioTitle}>Media Preview</h2>
            <button onClick={cancelUpload} className={styles.closeStudioBtn} disabled={uploading}>
              <X size={24} />
            </button>
          </div>

          <div className={styles.studioContent}>
            <div className={styles.mainStage}>
              {files.length > 1 && (
                <button
                  className={styles.navArrow}
                  onClick={() => !uploading && setSelectedIndex(prev => (prev === 0 ? files.length - 1 : prev - 1))}
                  disabled={uploading}
                >
                  <ChevronLeft size={32} />
                </button>
              )}

              <div className={styles.stageMediaContainer}>
                {selectedIsVideo ? (
                  <video src={selectedObjectUrl} className={styles.stageMedia} controls autoPlay muted />
                ) : (
                  <img src={selectedObjectUrl} alt={selectedFile.name} className={styles.stageMedia} />
                )}
              </div>

              {files.length > 1 && (
                <button
                  className={styles.navArrow}
                  onClick={() => !uploading && setSelectedIndex(prev => (prev === files.length - 1 ? 0 : prev + 1))}
                  disabled={uploading}
                >
                  <ChevronRight size={32} />
                </button>
              )}
            </div>

            <div className={styles.inspector}>
              <div>
                <h3 className={styles.inspectorTitle}>File Details</h3>
                <p className={styles.inspectorMeta}>{selectedFile.name}</p>
                <p className={styles.inspectorMeta}>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>

              <div>
                <h3 className={styles.inspectorTitle} style={{ marginBottom: '8px' }}>Tags</h3>
                <input
                  type="text"
                  placeholder="E.g. @john, concert"
                  className={styles.tagInput}
                  value={fileTags[selectedFile.name] || ''}
                  onChange={(e) => handleTagChange(selectedFile.name, e.target.value)}
                  disabled={uploading}
                  style={{ width: '100%' }}
                />
              </div>

              {!uploading && (
                <button onClick={() => removeFile(selectedIndex)} className={styles.removeStageBtn}>
                  <X size={18} /> Remove File
                </button>
              )}

              <button
                className={styles.studioUploadBtn}
                onClick={uploadFiles}
                disabled={uploading}
              >
                {uploading ? <><Loader2 size={20} className={styles.spinner} /> Uploading...</> : <><UploadCloud size={20} /> Upload {files.length} Files</>}
              </button>
            </div>
          </div>

          <div className={styles.filmstripContainer}>
            {files.map((file, index) => {
              const objectUrl = URL.createObjectURL(file);
              const isVideo = file.type.startsWith('video');
              const isActive = index === selectedIndex;
              const fileProgress = progress[file.name] || 0;

              return (
                <div
                  key={index}
                  className={`${styles.filmstripItem} ${isActive ? styles.activeThumbnail : ''}`}
                  onClick={() => !uploading && setSelectedIndex(index)}
                >
                  {isVideo ? (
                    <video src={objectUrl} className={styles.filmstripMedia} muted />
                  ) : (
                    <img src={objectUrl} alt={file.name} className={styles.filmstripMedia} />
                  )}
                  {uploading && fileProgress > 0 && (
                    <div className={styles.miniProgress} style={{ width: `${fileProgress}%` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

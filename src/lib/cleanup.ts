import { 
  collection, 
  query, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  doc, 
  where 
} from 'firebase/firestore';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function runSixMonthCleanup(db: any, _storage?: any) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // 1. Clean Chat Messages across all hostels (Older than 6 months and has fileUrl/filePublicId)
  try {
    const hostelsSnap = await getDocs(collection(db, 'hostels'));
    const hostelIds = hostelsSnap.empty ? ['default-hostel'] : hostelsSnap.docs.map(d => d.id);
    
    for (const hId of hostelIds) {
      const chatRef = collection(db, 'hostels', hId, 'chatMessages');
      const chatSnap = await getDocs(chatRef);
      for (const docSnap of chatSnap.docs) {
        const data = docSnap.data();
        if (data.fileUrl && data.sentAt) {
          const sentDate = data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
          if (sentDate < sixMonthsAgo) {
            if (data.filePublicId) {
              try {
                const type = data.fileType?.startsWith("image/") ? "image" : "raw";
                await deleteFromCloudinary(data.filePublicId, type);
                console.log("Purged old chat file from Cloudinary:", data.filePublicId);
              } catch (e) {
                console.warn("Cloudinary chat file delete failed:", e);
              }
            }
            await updateDoc(docSnap.ref, {
              fileUrl: null,
              filePublicId: null,
              fileName: null,
              fileType: null,
              content: "[Attachment deleted - older than 6 months]"
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("6-month Chat cleanup error:", e);
  }

  // 2. Clean Permissions (Older than 6 months and has documentUrl/documentPublicId)
  try {
    const permsRef = collection(db, 'permissions');
    const permsSnap = await getDocs(permsRef);
    for (const docSnap of permsSnap.docs) {
      const data = docSnap.data();
      if (data.documentUrl && data.createdAt) {
        const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (createdDate < sixMonthsAgo) {
          if (data.documentPublicId) {
            try {
              const type = data.documentUrl.includes("/raw/") ? "raw" : "image";
              await deleteFromCloudinary(data.documentPublicId, type);
              console.log("Purged old permission file from Cloudinary:", data.documentPublicId);
            } catch (e) {
              console.warn("Cloudinary permission file delete failed:", e);
            }
          }
          await updateDoc(docSnap.ref, {
            documentUrl: null,
            documentName: null,
            documentPublicId: null
          });
        }
      }
    }
  } catch (e) {
    console.error("6-month Permissions cleanup error:", e);
  }

  // 3. Clean Complaints (Older than 6 months and has documentUrl/documentPublicId)
  try {
    const complaintsRef = collection(db, 'complaints');
    const complaintsSnap = await getDocs(complaintsRef);
    for (const docSnap of complaintsSnap.docs) {
      const data = docSnap.data();
      if (data.documentUrl && data.createdAt) {
        const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (createdDate < sixMonthsAgo) {
          if (data.documentPublicId) {
            try {
              const type = data.documentUrl.includes("/raw/") ? "raw" : "image";
              await deleteFromCloudinary(data.documentPublicId, type);
              console.log("Purged old complaint file from Cloudinary:", data.documentPublicId);
            } catch (e) {
              console.warn("Cloudinary complaint file delete failed:", e);
            }
          }
          await updateDoc(docSnap.ref, {
            documentUrl: null,
            documentName: null,
            documentPublicId: null
          });
        }
      }
    }
  } catch (e) {
    console.error("6-month Complaints cleanup error:", e);
  }
}

export async function runOneYearUserCleanup(db: any, _storage?: any) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    
    for (const docSnap of usersSnap.docs) {
      const userData = docSnap.data();
      if (userData.isRemoved && userData.removedAt) {
        const removedDate = new Date(userData.removedAt);
        if (removedDate < oneYearAgo) {
          const userId = docSnap.id;
          console.log(`Purging user data for removed user: ${userId}`);

          // 1. Delete avatar from Cloudinary
          if (userData.avatarPublicId) {
            try {
              await deleteFromCloudinary(userData.avatarPublicId, "image");
              console.log("Purged avatar from Cloudinary for deleted user:", userData.avatarPublicId);
            } catch (e) {
              console.warn("Avatar delete fail during user purge:", e);
            }
          }

          // 2. Delete user permissions and their files
          const permsRef = collection(db, 'permissions');
          const permsQuery = query(permsRef, where('studentId', '==', userId));
          const permsSnap = await getDocs(permsQuery);
          for (const pDoc of permsSnap.docs) {
            const pData = pDoc.data();
            if (pData.documentPublicId) {
              try {
                const type = pData.documentUrl?.includes("/raw/") ? "raw" : "image";
                await deleteFromCloudinary(pData.documentPublicId, type);
              } catch (e) {
                console.warn("Permission document delete fail during user purge:", e);
              }
            }
            await deleteDoc(pDoc.ref);
          }

          // 3. Delete user complaints and their files
          const complaintsRef = collection(db, 'complaints');
          const complaintsQuery = query(complaintsRef, where('studentId', '==', userId));
          const complaintsSnap = await getDocs(complaintsQuery);
          for (const cDoc of complaintsSnap.docs) {
            const cData = cDoc.data();
            if (cData.documentPublicId) {
              try {
                const type = cData.documentUrl?.includes("/raw/") ? "raw" : "image";
                await deleteFromCloudinary(cData.documentPublicId, type);
              } catch (e) {
                console.warn("Complaint document delete fail during user purge:", e);
              }
            }
            await deleteDoc(cDoc.ref);
          }

          // 4. Delete user attendance subcollection documents
          const userAttRef = collection(db, 'users', userId, 'attendance');
          const userAttSnap = await getDocs(userAttRef);
          for (const attDoc of userAttSnap.docs) {
            await deleteDoc(attDoc.ref);
          }

          // 5. Remove user ID from daily attendance documents
          const attendanceRef = collection(db, 'attendance');
          const attendanceSnap = await getDocs(attendanceRef);
          for (const dayDoc of attendanceSnap.docs) {
            const dayData = dayDoc.data();
            const morningPresentIds = dayData.morningPresentIds || [];
            const eveningPresentIds = dayData.eveningPresentIds || [];
            
            const hasMorning = morningPresentIds.includes(userId);
            const hasEvening = eveningPresentIds.includes(userId);
            if (hasMorning || hasEvening) {
              await updateDoc(dayDoc.ref, {
                morningPresentIds: morningPresentIds.filter((id: string) => id !== userId),
                eveningPresentIds: eveningPresentIds.filter((id: string) => id !== userId)
              });
            }
          }

          // 6. Delete user document from Firestore
          await deleteDoc(docSnap.ref);
          console.log(`Purged user doc ${userId} completely.`);
        }
      }
    }
  } catch (e) {
    console.error("1-year user purge cleanup error:", e);
  }
}

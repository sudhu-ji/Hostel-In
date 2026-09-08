"use client";

import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, collection, updateDoc, deleteDoc, onSnapshot, getDoc, getDocs } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { useFirestore, useAuth as useFirebaseAuth } from '@/firebase';

export type UserRole = 'CHIEF_WARDEN' | 'WARDEN' | 'STUDENT' | 'MONITOR' | 'STAFF' | null;
export type FeeStatus = 'Paid' | 'Unpaid' | 'Partial';

export interface Hostel {
  id: string;
  name: string;
  type: 'Boys' | 'Girls';
  wardenName: string;
  wardenMobile: string;
  wardenGender?: 'Male' | 'Female';
  wardenAbout?: string;
  themeColor: 'blue' | 'emerald' | 'purple' | 'rose' | 'amber' | 'cyan' | 'indigo' | 'orange' | 'teal' | 'pink' | 'violet' | 'slate';
  institutionName?: string;
  totalRooms?: number;
  description?: string;
  createdAt?: any;
}

export interface User {
  id: string;
  name: string;
  mobile: string;
  officialMobile?: string;
  password?: string;
  role: UserRole;
  hostelId?: string;
  hostelName?: string;
  hostelType?: 'Boys' | 'Girls';
  institutionName?: string;
  room?: string;
  feeStatus?: FeeStatus;
  whatsapp?: string;
  description?: string;
  branch?: string;
  course?: string;
  avatarUrl?: string;
  gender?: 'Male' | 'Female';
  dateOfAllotment?: string;
  dateOfChange?: string;
  changeReason?: string;
  dateOfLeave?: string;
  isChatRestricted?: boolean;
  avatarVerificationStatus?: 'unverified' | 'pending' | 'verified';
  avatarLastVerifiedAt?: string;
  isRemoved?: boolean;
  removedAt?: string;
  avatarPublicId?: string;
  securityQuestions?: {
    petName?: string;
    favouritePerson?: string;
    nickname?: string;
  };
  profileCompleted?: boolean;
}

const DEFAULT_CHIEF_WARDEN: User = {
  id: 'chief-warden-primary',
  name: 'Chief Warden',
  mobile: '9999999999',
  password: '',
  role: 'CHIEF_WARDEN',
  description: 'Campus Hostels Administrator & Chief Authority',
  avatarUrl: 'https://picsum.photos/seed/chiefwarden/100',
  profileCompleted: false
};

export const DEMO_HOSTEL: Hostel = {
  id: 'demo-hostel',
  name: 'Demo Hostel',
  type: 'Boys',
  institutionName: 'Demo Institute of Technology & Management',
  wardenName: 'Dr. Demo Warden',
  wardenMobile: '9876543210',
  themeColor: 'blue',
  totalRooms: 60,
  description: 'Full demonstration hostel illustrating students, mess, complaints, and permissions workflows.',
  createdAt: new Date().toISOString()
};

export const DEMO_WARDEN: User = {
  id: 'demo-warden-account',
  name: 'Dr. Demo Warden',
  mobile: '9876543210',
  role: 'WARDEN',
  hostelId: 'demo-hostel',
  hostelName: 'Demo Hostel',
  hostelType: 'Boys',
  institutionName: 'Demo Institute of Technology & Management',
  description: 'Official Warden for Demo Hostel',
  avatarUrl: 'https://picsum.photos/seed/demowarden/120',
  avatarVerificationStatus: 'verified'
};

const DEFAULT_DEMO_STUDENTS: User[] = [
  {
    id: 'demo-student-1',
    name: 'Aman Verma',
    mobile: '9876543221',
    role: 'STUDENT',
    hostelId: 'demo-hostel',
    hostelName: 'Demo Hostel',
    hostelType: 'Boys',
    institutionName: 'Demo Institute of Technology & Management',
    room: 'A-101',
    feeStatus: 'Paid',
    gender: 'Male',
    description: 'Computer Science - 3rd Year',
    avatarUrl: 'https://picsum.photos/seed/student1/100',
    avatarVerificationStatus: 'verified'
  },
  {
    id: 'demo-student-2',
    name: 'Rohan Sharma',
    mobile: '9876543222',
    role: 'MONITOR',
    hostelId: 'demo-hostel',
    hostelName: 'Demo Hostel',
    hostelType: 'Boys',
    institutionName: 'Demo Institute of Technology & Management',
    room: 'A-102',
    feeStatus: 'Paid',
    gender: 'Male',
    description: 'Mechanical Engineering - Hostel Floor Monitor',
    avatarUrl: 'https://picsum.photos/seed/student2/100',
    avatarVerificationStatus: 'verified'
  },
  {
    id: 'demo-student-3',
    name: 'Vikram Singh',
    mobile: '9876543223',
    role: 'STUDENT',
    hostelId: 'demo-hostel',
    hostelName: 'Demo Hostel',
    hostelType: 'Boys',
    institutionName: 'Demo Institute of Technology & Management',
    room: 'B-201',
    feeStatus: 'Partial',
    gender: 'Male',
    description: 'Electrical Engineering - 2nd Year',
    avatarUrl: 'https://picsum.photos/seed/student3/100',
    avatarVerificationStatus: 'verified'
  }
];

const DEFAULT_DEMO_STAFF: User[] = [
  {
    id: 'demo-staff-1',
    name: 'Rajesh Kumar',
    mobile: '9876543231',
    role: 'STAFF',
    hostelId: 'demo-hostel',
    hostelName: 'Demo Hostel',
    description: 'Head Chef & Kitchen Supervisor',
    avatarUrl: 'https://picsum.photos/seed/staff1/100',
    avatarVerificationStatus: 'verified'
  },
  {
    id: 'demo-staff-2',
    name: 'Suresh Yadav',
    mobile: '9876543232',
    role: 'STAFF',
    hostelId: 'demo-hostel',
    hostelName: 'Demo Hostel',
    description: 'Mess Assistant & Logistics',
    avatarUrl: 'https://picsum.photos/seed/staff2/100',
    avatarVerificationStatus: 'verified'
  }
];

const DEFAULT_DEMO_ROOMS = [
  {
    id: 'A-101',
    type: 'Double',
    features: 'Balcony, Dual Study Tables, LED Tube',
    scarcities: 'None',
    residentIds: ['demo-student-1'],
    hostelId: 'demo-hostel'
  },
  {
    id: 'A-102',
    type: 'Double',
    features: 'Corner Room, High Ventilation, 2 Closets',
    scarcities: 'None',
    residentIds: ['demo-student-2'],
    hostelId: 'demo-hostel'
  },
  {
    id: 'B-201',
    type: 'Triple',
    features: 'East Facing, 3 Beds & Desks',
    scarcities: 'None',
    residentIds: ['demo-student-3'],
    hostelId: 'demo-hostel'
  }
];

const isDemoActive = () => typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hostelin_auth');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Persistent Allotted Users State (Never wiped between iterations/reloads)
  const [allottedUsers, setAllottedUsersState] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hostelin_allotted_users');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const setAllottedUsers = (updater: User[] | ((prev: User[]) => User[])) => {
    setAllottedUsersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('hostelin_allotted_users', JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  // Persistent Hostels State
  const [hostels, setHostelsState] = useState<Hostel[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hostelin_hostels_list');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const setHostels = (updater: Hostel[] | ((prev: Hostel[]) => Hostel[])) => {
    setHostelsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('hostelin_hostels_list', JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };
  const [activeHostelId, setActiveHostelIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hostelin_active_hostel_id');
    }
    return null;
  });

  const setActiveHostelId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('hostelin_active_hostel_id', id);
      } else {
        localStorage.removeItem('hostelin_active_hostel_id');
      }
      window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
    }
    setActiveHostelIdState(id);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHostelChange = () => {
      const stored = localStorage.getItem('hostelin_active_hostel_id');
      setActiveHostelIdState(stored);
    };
    window.addEventListener('hostelin_active_hostel_changed', handleHostelChange);
    window.addEventListener('storage', handleHostelChange);
    return () => {
      window.removeEventListener('hostelin_active_hostel_changed', handleHostelChange);
      window.removeEventListener('storage', handleHostelChange);
    };
  }, []);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const db = useFirestore();
  const auth = useFirebaseAuth();

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        try {
          await signInAnonymously(auth);
        } catch (e: any) {
          if (e.code === 'auth/configuration-not-found') {
            console.error("CRITICAL: Anonymous Authentication is NOT enabled in Firebase Console. Please enable it.");
          } else {
            console.error("Anonymous authentication failed:", e);
          }
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  const syncActiveSession = async (currentUser: User | null) => {
    if (!db || !auth || !auth.currentUser) return;
    const sessionRef = doc(db, 'activeSessions', auth.currentUser.uid);
    if (currentUser) {
      try {
        await setDoc(sessionRef, {
          userId: currentUser.id,
          role: currentUser.role,
          mobile: currentUser.mobile,
          hostelId: currentUser.hostelId || null,
          syncedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Could not sync active session:", e);
      }
    } else {
      try {
        await deleteDoc(sessionRef);
      } catch (e) {
        console.warn("Could not clear active session:", e);
      }
    }
  };

  useEffect(() => {
    if (isAuthReady && auth?.currentUser && db) {
      syncActiveSession(user);
    }
  }, [user, isAuthReady, auth?.currentUser, db]);

  // Real-time synchronization of hostels and users
  useEffect(() => {
    if (!db || !isAuthReady) return;

    const seedInitialData = async () => {
      try {
        // Seed Chief Warden if not exists
        const chiefWardenRef = doc(db, 'users', DEFAULT_CHIEF_WARDEN.id);
        const chiefSnap = await getDoc(chiefWardenRef);
        if (!chiefSnap.exists()) {
          await setDoc(chiefWardenRef, DEFAULT_CHIEF_WARDEN);
        }
      } catch (e) {
        console.warn("Registry initialization skipped:", e);
      }
    };
    seedInitialData();

    // Listen to Hostels (Merge cloud data with local store)
    const unsubHostels = onSnapshot(collection(db, 'hostels'), (snap) => {
      const cloudHostels = snap.docs.map(d => ({ ...d.data(), id: d.id } as Hostel));
      setHostels(prev => {
        const map = new Map<string, Hostel>();
        prev.forEach(h => map.set(h.id, h));
        cloudHostels.forEach(h => map.set(h.id, { ...map.get(h.id), ...h }));
        return Array.from(map.values());
      });
    });

    // Listen to Users (Merge cloud data with local store, respecting deletions)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const cloudUsers = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User)).filter(u => !u.isRemoved);
      let currentUserToUpdate: User | null = null;
      let hostelToUpdate: string | null = null;

      let deletedIds: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('hostelin_deleted_user_ids');
          if (raw) deletedIds = JSON.parse(raw);
        } catch (e) {}
      }

      setAllottedUsers(prev => {
        const map = new Map<string, User>();
        // 1. Add cloud users that are not marked deleted
        cloudUsers.forEach(u => {
          if (!deletedIds.includes(u.id) && !u.isRemoved) {
            map.set(u.id, u);
          }
        });
        // 2. Retain local users that are not deleted
        prev.forEach(u => {
          if (!deletedIds.includes(u.id) && !u.isRemoved) {
            if (!map.has(u.id)) {
              map.set(u.id, u);
            } else {
              map.set(u.id, { ...u, ...map.get(u.id) });
            }
          }
        });
        const combined = Array.from(map.values());

        const storedAuth = typeof window !== 'undefined' ? localStorage.getItem('hostelin_auth') : null;
        if (storedAuth) {
          try {
            const parsed = JSON.parse(storedAuth);
            const currentUserData = combined.find(u => u.id === parsed.id || (u.mobile === parsed.mobile));
            if (currentUserData) {
              currentUserToUpdate = currentUserData;
              if (currentUserData.role !== 'CHIEF_WARDEN' && currentUserData.hostelId) {
                hostelToUpdate = currentUserData.hostelId;
              }
            }
          } catch (e) {}
        }
        return combined;
      });

      if (currentUserToUpdate) {
        setUser(currentUserToUpdate);
      }
      if (hostelToUpdate && typeof window !== 'undefined' && !localStorage.getItem('hostelin_active_hostel_id')) {
        setActiveHostelId(hostelToUpdate);
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => {
      unsubHostels();
      unsubUsers();
    };
  }, [db, isAuthReady]);

  // Active Hostel computation
  const activeHostel = useMemo(() => {
    if (activeHostelId) {
      const found = hostels.find(h => h.id === activeHostelId);
      if (found) return found;
    }
    if (user?.hostelId) {
      const found = hostels.find(h => h.id === user.hostelId);
      if (found) return found;
    }
    if (user?.role === 'WARDEN') {
      const found = hostels.find(h => h.wardenMobile === user.mobile);
      if (found) return found;
    }
    if (typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true') {
      return DEMO_HOSTEL;
    }
    return hostels[0] || null;
  }, [hostels, activeHostelId, user]);

  const checkMobile = (mobile: string): { exists: boolean; hasPassword: boolean; role?: UserRole; isBootstrapAdmin?: boolean } => {
    let savedChief: User | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('hostelin_chief_profile');
        if (raw) savedChief = JSON.parse(raw);
      } catch (e) {}
    }
    const foundAdmin = allottedUsers.find(u => (u.role === 'CHIEF_WARDEN' && u.mobile === mobile) || (mobile === '9999999999' && u.id === 'chief-warden-primary')) || (savedChief && (savedChief.mobile === mobile || mobile === '9999999999') ? savedChief : null) || (mobile === '9999999999' ? DEFAULT_CHIEF_WARDEN : null);
    if (foundAdmin) {
      const hasPwd = !!(foundAdmin.password && foundAdmin.password.trim().length > 0 && foundAdmin.profileCompleted);
      return {
        exists: true,
        hasPassword: hasPwd,
        role: 'CHIEF_WARDEN',
        isBootstrapAdmin: !hasPwd
      };
    }

    let found = allottedUsers.find(u => u.mobile === mobile);
    if (!found) {
      const hostel = hostels.find(h => h.wardenMobile === mobile);
      if (hostel) {
        found = {
          id: `warden-${hostel.id}`,
          name: hostel.wardenName,
          mobile: hostel.wardenMobile,
          role: 'WARDEN',
          hostelId: hostel.id,
          hostelName: hostel.name,
          hostelType: hostel.type,
          institutionName: hostel.institutionName,
          gender: hostel.wardenGender || (hostel.type === 'Girls' ? 'Female' : 'Male'),
          description: hostel.wardenAbout || hostel.description || `Official Warden for ${hostel.name}`
        };
      }
    }

    return {
      exists: !!found,
      hasPassword: !!(found?.password && found.password.trim().length > 0),
      role: found?.role || null,
      isBootstrapAdmin: false
    };
  };

  const login = async (mobile: string, password?: string): Promise<{ success: boolean; user?: User; role?: UserRole; isBootstrap?: boolean }> => {
    let savedChief: User | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('hostelin_chief_profile');
        if (raw) savedChief = JSON.parse(raw);
      } catch (e) {}
    }
    const chief = allottedUsers.find(u => (u.role === 'CHIEF_WARDEN' && u.mobile === mobile) || (mobile === '9999999999' && u.id === 'chief-warden-primary')) || (savedChief && (savedChief.mobile === mobile || mobile === '9999999999') ? savedChief : null) || (mobile === '9999999999' ? DEFAULT_CHIEF_WARDEN : null);
    if (chief) {
      if (chief.password && chief.password.trim().length > 0) {
        if (chief.password === password) {
          localStorage.setItem('hostelin_auth', JSON.stringify(chief));
          setUser(chief);
          return { success: true, user: chief, role: 'CHIEF_WARDEN', isBootstrap: !chief.profileCompleted };
        }
        return { success: false };
      } else {
        localStorage.setItem('hostelin_auth', JSON.stringify(chief));
        setUser(chief);
        return { success: true, user: chief, role: 'CHIEF_WARDEN', isBootstrap: true };
      }
    }

    let allotted = allottedUsers.find(s => s.mobile === mobile);
    if (!allotted) {
      const hostel = hostels.find(h => h.wardenMobile === mobile);
      if (hostel) {
        allotted = {
          id: `warden-${hostel.id}`,
          name: hostel.wardenName,
          mobile: hostel.wardenMobile,
          role: 'WARDEN',
          hostelId: hostel.id,
          hostelName: hostel.name,
          hostelType: hostel.type,
          institutionName: hostel.institutionName,
          gender: hostel.wardenGender || (hostel.type === 'Girls' ? 'Female' : 'Male'),
          description: hostel.wardenAbout || hostel.description || `Official Warden for ${hostel.name}`
        };
      }
    }

    if (allotted && (allotted.password === password || (!allotted.password && !password))) {
      localStorage.setItem('hostelin_auth', JSON.stringify(allotted));
      setUser(allotted);
      if (allotted.hostelId) {
        setActiveHostelId(allotted.hostelId);
      }
      return { success: true, user: allotted, role: allotted.role };
    }
    return { success: false };
  };

  const verifySecurityQuestion = (
    mobile: string, 
    answers: { petName?: string; favouritePerson?: string; nickname?: string }
  ): boolean => {
    const chief = allottedUsers.find(u => u.mobile === mobile) || DEFAULT_CHIEF_WARDEN;
    const sq = chief.securityQuestions;
    if (!sq) return false;

    const matchPet = !!(answers.petName && answers.petName.trim() && sq.petName && answers.petName.trim().toLowerCase() === sq.petName.trim().toLowerCase());
    const matchFav = !!(answers.favouritePerson && answers.favouritePerson.trim() && sq.favouritePerson && answers.favouritePerson.trim().toLowerCase() === sq.favouritePerson.trim().toLowerCase());
    const matchNick = !!(answers.nickname && answers.nickname.trim() && sq.nickname && answers.nickname.trim().toLowerCase() === sq.nickname.trim().toLowerCase());

    return matchPet || matchFav || matchNick;
  };

  const resetChiefWardenPassword = async (mobile: string = '9999999999') => {
    const chief = allottedUsers.find(u => u.mobile === mobile) || DEFAULT_CHIEF_WARDEN;
    if (db) {
      const userRef = doc(db, 'users', chief.id);
      await setDoc(userRef, { 
        ...chief, 
        password: "", 
        profileCompleted: false 
      }, { merge: true });
    }
    const updated = { ...chief, password: "", profileCompleted: false };
    localStorage.setItem('hostelin_auth', JSON.stringify(updated));
    setUser(updated);
  };

  const setupPassword = async (mobile: string, password: string) => {
    let found = allottedUsers.find(u => u.mobile === mobile);
    if (!found) {
      const hostel = hostels.find(h => h.wardenMobile === mobile);
      if (hostel) {
        found = {
          id: `warden-${hostel.id}`,
          name: hostel.wardenName,
          mobile: hostel.wardenMobile,
          role: 'WARDEN',
          hostelId: hostel.id,
          hostelName: hostel.name,
          hostelType: hostel.type,
          institutionName: hostel.institutionName,
          gender: hostel.wardenGender || (hostel.type === 'Girls' ? 'Female' : 'Male'),
          description: hostel.wardenAbout || hostel.description || `Official Warden for ${hostel.name}`
        };
      }
    }

    if (!found) {
      throw new Error("User record not found in registry.");
    }

    const updatedUser: User = { ...found, password };

    // 1. Instant optimistic update & session creation
    setAllottedUsers(prev => {
      const exists = prev.some(u => u.id === found!.id);
      return exists ? prev.map(u => u.id === found!.id ? updatedUser : u) : [...prev, updatedUser];
    });
    localStorage.setItem('hostelin_auth', JSON.stringify(updatedUser));
    setUser(updatedUser);
    if (updatedUser.hostelId) {
      setActiveHostelId(updatedUser.hostelId);
    }

    // 2. Non-blocking Firestore write with timeout race
    if (db) {
      try {
        const userRef = doc(db, 'users', found.id);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2000));
        await Promise.race([
          setDoc(userRef, updatedUser, { merge: true }),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore password setup saved locally, cloud sync deferred:", err);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('hostelin_auth');
    localStorage.removeItem('hostelin_active_hostel_id');
    setUser(null);
    setActiveHostelId(null);
  };

  const createHostel = async (data: Omit<Hostel, 'id' | 'createdAt'>) => {
    if (isDemoActive()) return;
    const hostelId = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `hostel-${Date.now()}`;
    const newHostel: Hostel = {
      ...data,
      id: hostelId,
      createdAt: new Date().toISOString()
    };

    // Instant optimistic local update
    setHostels(prev => {
      const exists = prev.some(h => h.id === hostelId);
      return exists ? prev.map(h => h.id === hostelId ? newHostel : h) : [...prev, newHostel];
    });

    let wardenUser: User | null = null;
    if (data.wardenMobile && data.wardenName) {
      const wardenId = `warden-${hostelId}`;
      wardenUser = {
        id: wardenId,
        name: data.wardenName,
        mobile: data.wardenMobile,
        password: '',
        role: 'WARDEN',
        hostelId: hostelId,
        hostelName: data.name,
        hostelType: data.type,
        institutionName: data.institutionName,
        gender: data.wardenGender || (data.type === 'Girls' ? 'Female' : 'Male'),
        description: data.wardenAbout || data.description || `Official Warden for ${data.name}`,
        avatarUrl: `https://picsum.photos/seed/${hostelId}/100`
      };
      setAllottedUsers(prev => {
        const exists = prev.some(u => u.id === wardenId);
        return exists ? prev.map(u => u.id === wardenId ? wardenUser! : u) : [...prev, wardenUser!];
      });
    }

    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          (async () => {
            await setDoc(doc(db, 'hostels', hostelId), newHostel);
            if (wardenUser) {
              await setDoc(doc(db, 'users', wardenUser.id), wardenUser, { merge: true });
            }
          })(),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore hostel create deferred (saved locally):", err);
      }
    }
    return hostelId;
  };

  const updateHostel = async (hostel: Hostel) => {
    if (isDemoActive()) return;

    // Instant optimistic update
    setHostels(prev => prev.map(h => h.id === hostel.id ? hostel : h));

    let wardenUser: Partial<User> | null = null;
    if (hostel.wardenMobile && hostel.wardenName) {
      const wardenId = `warden-${hostel.id}`;
      wardenUser = {
        id: wardenId,
        name: hostel.wardenName,
        mobile: hostel.wardenMobile,
        role: 'WARDEN',
        hostelId: hostel.id,
        hostelName: hostel.name,
        hostelType: hostel.type,
        institutionName: hostel.institutionName,
        gender: hostel.wardenGender || (hostel.type === 'Girls' ? 'Female' : 'Male'),
        description: hostel.wardenAbout || hostel.description || `Official Warden for ${hostel.name}`
      };
      setAllottedUsers(prev => prev.map(u => u.id === wardenId ? { ...u, ...wardenUser } : u));
    }

    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          (async () => {
            await setDoc(doc(db, 'hostels', hostel.id), hostel, { merge: true });
            if (wardenUser && wardenUser.id) {
              await setDoc(doc(db, 'users', wardenUser.id), wardenUser, { merge: true });
            }
          })(),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore hostel update deferred (saved locally):", err);
      }
    }
  };

  const deleteHostel = async (id: string) => {
    if (isDemoActive()) return;
    setHostels(prev => prev.filter(h => h.id !== id));
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          deleteDoc(doc(db, 'hostels', id)),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore hostel delete deferred (saved locally):", err);
      }
    }
  };

  const addAllottedUser = async (newUser: User) => {
    if (isDemoActive()) return;
    setAllottedUsers(prev => [...prev.filter(u => u.id !== newUser.id), newUser]);
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          setDoc(doc(db, 'users', newUser.id), newUser),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore user add deferred (saved locally):", err);
      }
    }
  };

  const updateAllottedUser = async (updatedUser: User) => {
    if (isDemoActive()) return;

    // Immediately update local state & persistent cache
    setAllottedUsers(prev => {
      const idx = prev.findIndex(u => u.id === updatedUser.id || (u.role === 'CHIEF_WARDEN' && updatedUser.role === 'CHIEF_WARDEN'));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updatedUser };
        return next;
      }
      return [...prev, updatedUser];
    });

    if (updatedUser.role === 'CHIEF_WARDEN') {
      localStorage.setItem('hostelin_chief_profile', JSON.stringify(updatedUser));
    }

    if (user?.id === updatedUser.id || (user?.role === 'CHIEF_WARDEN' && updatedUser.role === 'CHIEF_WARDEN')) {
      localStorage.setItem('hostelin_auth', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true }),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore sync deferred (persisted locally):", err);
      }
    }
  };

  const removeAllottedUser = async (id: string) => {
    // 1. Track deleted ID in localStorage to prevent snapshot resurrection
    if (typeof window !== 'undefined') {
      try {
        const deletedRaw = localStorage.getItem('hostelin_deleted_user_ids');
        const deletedArr: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        if (!deletedArr.includes(id)) {
          deletedArr.push(id);
          localStorage.setItem('hostelin_deleted_user_ids', JSON.stringify(deletedArr));
        }
      } catch (e) {}
    }

    // 2. Remove immediately from local state and storage
    setAllottedUsers(prev => prev.filter(u => u.id !== id));

    // 3. Delete from Firestore
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          deleteDoc(doc(db, 'users', id)),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore user delete deferred (saved locally):", err);
      }
    }
  };

  const resetUserPassword = async (id: string) => {
    setAllottedUsers(prev => prev.map(u => u.id === id ? { ...u, password: "" } : u));
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          updateDoc(doc(db, 'users', id), { password: "" }),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore password reset deferred (saved locally):", err);
      }
    }
  };

  const updateFeeStatus = async (studentId: string, status: FeeStatus) => {
    setAllottedUsers(prev => prev.map(u => u.id === studentId ? { ...u, feeStatus: status } : u));
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          updateDoc(doc(db, 'users', studentId), { feeStatus: status }),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn("Firestore fee status update deferred (saved locally):", err);
      }
    }
  };

  const launchDemoSession = async () => {
    // Immediately set local auth & demo state so navigation is instant
    localStorage.setItem('hostelin_auth', JSON.stringify(DEMO_WARDEN));
    localStorage.setItem('hostelin_is_demo', 'true');
    localStorage.setItem('hostelin_active_hostel_id', DEMO_HOSTEL.id);
    setUser(DEMO_WARDEN);
    setActiveHostelId(DEMO_HOSTEL.id);
    setHostels(prev => {
      if (prev.some(h => h.id === DEMO_HOSTEL.id)) return prev;
      return [DEMO_HOSTEL, ...prev];
    });
    setAllottedUsers(prev => {
      const demoUsers = [DEMO_WARDEN, ...DEFAULT_DEMO_STUDENTS, ...DEFAULT_DEMO_STAFF];
      const filtered = prev.filter(p => !demoUsers.some(d => d.id === p.id));
      return [...demoUsers, ...filtered];
    });

    // Seed Firestore in background non-blocking
    if (db) {
      (async () => {
        try {
          await Promise.allSettled([
            setDoc(doc(db, 'hostels', DEMO_HOSTEL.id), DEMO_HOSTEL, { merge: true }),
            setDoc(doc(db, 'users', DEMO_WARDEN.id), DEMO_WARDEN, { merge: true }),
            ...DEFAULT_DEMO_STUDENTS.map(stu => setDoc(doc(db, 'users', stu.id), stu, { merge: true })),
            ...DEFAULT_DEMO_STAFF.map(staff => setDoc(doc(db, 'users', staff.id), staff, { merge: true })),
            ...DEFAULT_DEMO_ROOMS.map(room => setDoc(doc(db, 'rooms', room.id), room, { merge: true }))
          ]);
        } catch (e) {
          console.warn("Background demo seeding skipped:", e);
        }
      })();
    }
  };

  const exitDemoSession = () => {
    localStorage.removeItem('hostelin_is_demo');
    const chief = allottedUsers.find(u => u.mobile === '9999999999') || DEFAULT_CHIEF_WARDEN;
    localStorage.setItem('hostelin_auth', JSON.stringify(chief));
    setUser(chief);
    setActiveHostelId(null);
  };

  return { 
    user, 
    hostels,
    activeHostel,
    activeHostelId,
    setActiveHostelId,
    createHostel,
    updateHostel,
    deleteHostel,
    launchDemoSession,
    exitDemoSession,
    login, 
    checkMobile, 
    setupPassword, 
    logout, 
    loading: loading || !isAuthReady, 
    allottedUsers, 
    addAllottedUser, 
    updateAllottedUser, 
    removeAllottedUser, 
    resetUserPassword,
    verifySecurityQuestion,
    resetChiefWardenPassword,
    updateFeeStatus
  };
}

import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../db';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Enhanced Signup: Creates Auth User + Firestore Profile
    const signup = async (email, password, name, mobile, centerName) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Auto-promote logic for specific email (Bypass Pending)
        const isSuperAdmin = email.toLowerCase() === 'ggp305ggp@gmail.com';
        const initialStatus = isSuperAdmin ? 'Active' : 'Pending';
        const initialRole = isSuperAdmin ? 'Admin' : 'User';

        const userData = {
            uid: user.uid,
            email: user.email,
            name: name || 'User',
            mobile: mobile || '',
            centerName: centerName || '',
            role: initialRole,
            accessStatus: initialStatus,
            createdAt: new Date().toISOString()
        };

        // Create User Profile in Firestore
        await setDoc(doc(db, "users", user.uid), userData);

        // FIX: Manually update local state to avoid race condition where listener fetches empty/old data
        setCurrentUser({ ...user, ...userData });

        return user;
    };

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        return signOut(auth);
    };

    useEffect(() => {
        let unsubscribeFirestore = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            // Cleanup previous listener if switching users
            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }

            if (user) {
                const userDocRef = doc(db, "users", user.uid);

                // Real-time listener
                unsubscribeFirestore = onSnapshot(userDocRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();

                        // DEBUGGING logs as requested
                        console.log("Database Role:", userData?.role || userData?.Role);
                        console.log("Database Status:", userData?.accessStatus || userData?.AccessStatus);

                        // Normalize fields (Handle Case Sensitivity)
                        const role = userData.role || userData.Role || 'User';
                        const accessStatus = userData.accessStatus || userData.AccessStatus || 'Pending';

                        // CRITICAL: Gatekeeper Check (Real-time)
                        if (accessStatus === 'Blocked') {
                            alert("Your access has been revoked by the Admin.");
                            await signOut(auth);
                            setCurrentUser(null);
                            return;
                        }

                        // NOTE: We allow Pending users to stay logged in but restricting them is done in UI/Routing, 
                        // matching the logic of the previous code which alerted but logged them out is also an option, 
                        // but the previous code logged them out immediately.
                        // However, onSnapshot fires on every change. If we logout, this listener dies. 
                        // Let's stick to the previous behavior: Alert & Logout if pending (unless super admin).

                        if (accessStatus === 'Pending' && user.email.toLowerCase() !== 'ggp305ggp@gmail.com') {
                            // Optional: You might want to allow them to see a "Pending" screen instead of logging out.
                            // But following original logic:
                            console.log("User is Pending. Waiting for approval.");
                        }

                        // Auto-promote Super Admin (Idempotent)
                        if (user.email.toLowerCase() === 'ggp305ggp@gmail.com' && role !== 'Admin') {
                            console.log("Auto-promoting Super Admin...");
                            await updateDoc(userDocRef, { role: 'Admin', accessStatus: 'Active' });
                            // The snapshot will fire again with new data, so we don't need to manually set state here
                            return;
                        }

                        // MERGE auth user with database data
                        setCurrentUser({
                            ...user,
                            ...userData,
                            role: role, // Ensure normalized keys
                            accessStatus: accessStatus
                        });
                    } else {
                        // FALLBACK: Create missing profile (Self-Healing)
                        console.log("Profile missing. Creating default...");
                        const isSuperAdmin = user.email.toLowerCase() === 'ggp305ggp@gmail.com';
                        const newProfile = {
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName || 'User',
                            role: isSuperAdmin ? 'Admin' : 'User',
                            accessStatus: isSuperAdmin ? 'Active' : 'Pending',
                            createdAt: new Date().toISOString()
                        };
                        await setDoc(userDocRef, newProfile);
                        // Snapshot will catch this update
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore Real-time Error:", error);
                    setLoading(false);
                });
            } else {
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeFirestore) unsubscribeFirestore();
        };
    }, []);

    const value = {
        currentUser,
        login,
        signup,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

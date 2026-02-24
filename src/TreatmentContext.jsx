import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { useAuth } from './AuthContext';
import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc, // Added explicit import
    doc,
    onSnapshot,
    query,
    where
} from 'firebase/firestore';

const TreatmentContext = createContext();

export const useTreatments = () => useContext(TreatmentContext);

export const TreatmentProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [newPrimary, setNewPrimary] = useState([]);
    const [newSHC, setNewSHC] = useState([]);
    const [supplyRecords, setSupplyRecords] = useState([]);
    const [tourRecords, setTourRecords] = useState([]);
    const [legacyTreatments, setLegacyTreatments] = useState([]); // For old data

    // Derived State (Merged)
    const primaryTreatments = [...newPrimary, ...legacyTreatments.filter(t => t.type === 'Primary')];
    const shcTreatments = [...newSHC, ...legacyTreatments.filter(t => t.type === 'SHC')];

    // Helper to sort by timestamp desc (Safe Client-side Sort)
    const sortByTime = (docs) => {
        return docs.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date);
            const dateB = new Date(b.timestamp || b.date);
            return dateB - dateA; // Descending
        });
    };

    useEffect(() => {
        if (!currentUser) return;

        // Helper to Create Query based on User Role
        const createQ = (colName) => {
            const ref = collection(db, colName);
            // DEBUG: For now, fetch ALL to verify data exists, then re-apply filter if needed.
            // But strict requirement is Admin sees all, User sees own.
            if (currentUser.role === 'Admin') return query(ref);
            return query(ref, where('userId', '==', currentUser.uid));
        };

        const unsubPrimary = onSnapshot(createQ('primary_treatments'), (snap) => {
            setNewPrimary(sortByTime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        });

        const unsubSHC = onSnapshot(createQ('shc_treatments'), (snap) => {
            setNewSHC(sortByTime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        });

        const unsubSupply = onSnapshot(createQ('medicine_supply'), (snap) => {
            setSupplyRecords(sortByTime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        });

        const unsubTour = onSnapshot(createQ('tour_patients'), (snap) => {
            setTourRecords(sortByTime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        });

        // LEGACY DATA SUPPORT
        const unsubLegacy = onSnapshot(createQ('treatments'), (snap) => {
            setLegacyTreatments(sortByTime(snap.docs.map(d => ({ id: d.id, isLegacy: true, ...d.data() }))));
        });

        return () => {
            unsubPrimary();
            unsubSHC();
            unsubSupply();
            unsubTour();
            unsubLegacy();
        };
    }, [currentUser]);

    const addRecord = async (collectionName, entry) => {
        if (!currentUser) return;
        await addDoc(collection(db, collectionName), {
            ...entry,
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.name || 'Unknown',
            timestamp: new Date().toISOString()
        });
    };

    const addPrimaryTreatment = (entry) => addRecord('primary_treatments', { ...entry, type: 'Primary' });
    const addSHCTreatment = (entry) => addRecord('shc_treatments', { ...entry, type: 'SHC' });
    const addSupplyRecord = (entry) => addRecord('medicine_supply', { ...entry, type: 'Supply' });
    const addTourRecord = (entry) => addRecord('tour_patients', { ...entry, type: 'Tour' });

    const deletePrimaryTreatment = async (id, isLegacy = false) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, isLegacy ? 'treatments' : 'primary_treatments', id));
    };

    const deleteSHCTreatment = async (id, isLegacy = false) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, isLegacy ? 'treatments' : 'shc_treatments', id));
    };

    const deleteSupplyRecord = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, 'medicine_supply', id));
    };

    const deleteTourRecord = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, 'tour_patients', id));
    };

    const updatePrimaryTreatment = async (id, updatedData, isLegacy = false) => {
        if (!currentUser) return;
        const ref = doc(db, isLegacy ? 'treatments' : 'primary_treatments', id);
        await updateDoc(ref, updatedData);
    };

    const updateSHCTreatment = async (id, updatedData, isLegacy = false) => {
        if (!currentUser) return;
        const ref = doc(db, isLegacy ? 'treatments' : 'shc_treatments', id);
        await updateDoc(ref, updatedData);
    };

    const updateSupplyRecord = async (id, updatedData) => {
        if (!currentUser) return;
        const ref = doc(db, 'medicine_supply', id);
        await updateDoc(ref, updatedData);
    };

    const updateTourRecord = async (id, updatedData) => {
        if (!currentUser) return;
        const ref = doc(db, 'tour_patients', id);
        await updateDoc(ref, updatedData);
    };

    return (
        <TreatmentContext.Provider value={{
            primaryTreatments, shcTreatments, supplyRecords, tourRecords,
            addPrimaryTreatment, addSHCTreatment, addSupplyRecord, addTourRecord,
            deletePrimaryTreatment, deleteSHCTreatment, deleteSupplyRecord, deleteTourRecord,
            updatePrimaryTreatment, updateSHCTreatment, updateSupplyRecord, updateTourRecord
        }}>
            {children}
        </TreatmentContext.Provider>
    );
};

import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { useAuth } from './AuthContext';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query
} from 'firebase/firestore';

const BullContext = createContext();

export const useBulls = () => useContext(BullContext);

export const BullProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [bulls, setBulls] = useState([]);

    const getCollectionRef = () => currentUser ? collection(db, 'users', currentUser.uid, 'bulls') : null;

    useEffect(() => {
        if (!currentUser) {
            setBulls([]);
            return;
        }

        const q = query(getCollectionRef());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter: Only show profiles (CREDIT or undefined/legacy) in the main list
            // Excluding explicit 'DEBIT' transactions from the list of selectable bulls
            setBulls(allDocs.filter(d => d.transactionType !== 'DEBIT'));
        });

        return () => unsubscribe();
    }, [currentUser]);

    const addBull = async (bullData) => {
        if (!currentUser) return;
        await addDoc(getCollectionRef(), {
            ...bullData,
            transactionType: 'CREDIT', // Tag as Credit
            date: bullData.date || new Date().toISOString().split('T')[0],
            doses: parseInt(bullData.doses) || 0,
            createdAt: new Date()
        });
    };

    const discardStock = async (stockData) => {
        if (!currentUser) return;

        // 1. Record the DEBIT transaction
        await addDoc(getCollectionRef(), {
            ...stockData,
            transactionType: 'DEBIT',
            createdAt: new Date()
        });

        // 2. Update the Main Bull Profile (Decrement Stock)
        if (stockData.bullId && stockData.quantity) {
            const bull = bulls.find(b => b.id === stockData.bullId);
            if (bull) {
                const newDoses = Math.max(0, bull.doses - parseInt(stockData.quantity));
                await updateDoc(doc(db, 'users', currentUser.uid, 'bulls', stockData.bullId), {
                    doses: newDoses
                });
            }
        }
    };

    const deleteBull = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, 'users', currentUser.uid, 'bulls', id));
    };

    const decrementBullDoses = async (id) => {
        // ... kept for DataEntry usage ...
        if (!currentUser) return;
        const bull = bulls.find(b => b.id === id);
        if (!bull) return;

        await updateDoc(doc(db, 'users', currentUser.uid, 'bulls', id), {
            doses: Math.max(0, bull.doses - 1)
        });
    };

    const updateBull = async (id, updatedData) => {
        if (!currentUser) return;
        await updateDoc(doc(db, 'users', currentUser.uid, 'bulls', id), updatedData);
    };

    const incrementBullDoses = async (id) => {
        if (!currentUser) return;
        const bull = bulls.find(b => b.id === id);
        if (!bull) return;

        await updateDoc(doc(db, 'users', currentUser.uid, 'bulls', id), {
            doses: bull.doses + 1
        });
    };

    return (
        <BullContext.Provider value={{ bulls, addBull, updateBull, discardStock, deleteBull, decrementBullDoses, incrementBullDoses }}>
            {children}
        </BullContext.Provider>
    );
};

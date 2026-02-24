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

const ReceiptContext = createContext();

export const useReceipts = () => useContext(ReceiptContext);

export const ReceiptProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [receiptBooks, setReceiptBooks] = useState([]);

    const getCollectionRef = () => currentUser ? collection(db, 'users', currentUser.uid, 'receipt_books') : null;

    useEffect(() => {
        if (!currentUser) {
            setReceiptBooks([]);
            return;
        }

        const q = query(getCollectionRef());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReceiptBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Add Book with Type
    const addReceiptBook = async (start, end, type = 'Conventional', date) => {
        if (!currentUser) return;

        const newBook = {
            date: date || new Date().toISOString().split('T')[0],
            type, // 'Conventional' or 'Sexed'
            start: parseInt(start),
            end: parseInt(end),
            current: parseInt(start),
            status: 'pending', // pending, active, completed
            createdAt: new Date()
        };

        // Auto-activate if no active book of this type exists locally (optimistic check, better to check DB but this works for simple cases)
        const hasActive = receiptBooks.some(b => b.status === 'active' && b.type === type);
        if (!hasActive) newBook.status = 'active';

        await addDoc(getCollectionRef(), newBook);
    };

    const deleteBook = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, 'users', currentUser.uid, 'receipt_books', id));
    };

    const updateReceiptBook = async (id, updatedData) => {
        if (!currentUser) return;
        await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', id), updatedData);
    };

    const activateBook = async (id) => {
        if (!currentUser) return;
        const bookToActivate = receiptBooks.find(b => b.id === id);
        if (!bookToActivate) return;

        // Deactivate other books of SAME TYPE
        const batchUpdates = receiptBooks
            .filter(b => b.type === bookToActivate.type && b.status === 'active' && b.id !== id);

        // In a real app we'd use a batch, but loop is fine for small scale
        for (const book of batchUpdates) {
            await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', book.id), { status: 'completed' });
        }

        await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', id), { status: 'active' });
    };

    // Get Next Number for Type (Synchronous helper for UI display, data is already synced)
    const getNextReceipt = (type) => {
        const activeBook = receiptBooks.find(b => b.status === 'active' && b.type === type);
        return activeBook ? activeBook.current : 'No Active Book';
    };

    const incrementReceipt = async (type) => {
        if (!currentUser) return;
        const book = receiptBooks.find(b => b.status === 'active' && b.type === type);
        if (!book) return;

        const next = book.current + 1;
        const updates = { current: next };

        if (next > book.end) {
            updates.status = 'completed';
        }

        await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', book.id), updates);
    };

    // Restore Receipt (Mark one as unused/restored in stats)
    // SMART RESTORE: If it's the LAST issued receipt, we rewind the counter.
    // Otherwise, we just mark it as 'restored' in stats (gap remains).
    const restoreReceipt = async (type, receiptNo) => {
        if (!currentUser) return;
        const book = receiptBooks.find(b => b.status === 'active' && b.type === type);
        if (!book) return;

        // CHECK: Is this the MOST RECENT receipt? (current is the NEXT available, so check vs current - 1)
        if (parseInt(receiptNo) === parseInt(book.current) - 1) {
            console.log(`Rewinding Receipt Book (${type}) from ${book.current} to ${book.current - 1}`);
            await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', book.id), {
                current: book.current - 1
            });
        } else {
            console.log(`Marking Receipt ${receiptNo} as Restored (Gap created)`);
            const currentRestored = book.restoredCount || 0;
            await updateDoc(doc(db, 'users', currentUser.uid, 'receipt_books', book.id), {
                restoredCount: currentRestored + 1
            });
        }
    };

    return (
        <ReceiptContext.Provider value={{ receiptBooks, addReceiptBook, deleteBook, updateReceiptBook, activateBook, incrementReceipt, getNextReceipt, restoreReceipt }}>
            {children}
        </ReceiptContext.Provider>
    );
};

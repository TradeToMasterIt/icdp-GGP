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

const MedicineContext = createContext();

export const useMedicines = () => useContext(MedicineContext);

export const MedicineProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);

    // Path helper
    const getCollectionRef = () => {
        if (!currentUser) return null;
        return collection(db, 'users', currentUser.uid, 'medicines');
    };

    // Real-time Sync
    useEffect(() => {
        if (!currentUser) {
            setMedicines([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(getCollectionRef());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMedicines(fetched);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching medicines:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const addMedicine = async (medicine) => {
        if (!currentUser) return;
        try {
            await addDoc(getCollectionRef(), {
                ...medicine,
                date: medicine.date || new Date().toISOString().split('T')[0],
                createdAt: new Date()
            });
        } catch (e) {
            console.error("Error adding medicine: ", e);
            throw e;
        }
    };

    const deleteMedicine = async (id) => {
        if (!currentUser) return;
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'medicines', id));
        } catch (e) {
            console.error("Error deleting medicine: ", e);
            throw e;
        }
    };

    const updateStock = async (id, quantityUsed) => {
        if (!currentUser) return;
        const med = medicines.find(m => m.id === id);
        if (!med) return;

        const newStock = Math.max(0, med.currentStock - quantityUsed);

        try {
            await updateDoc(doc(db, 'users', currentUser.uid, 'medicines', id), {
                currentStock: newStock
            });
        } catch (e) {
            console.error("Error updating stock: ", e);
            throw e;
        }
    };

    const updateMedicine = async (id, updatedData) => {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, 'users', currentUser.uid, 'medicines', id), updatedData);
        } catch (e) {
            console.error("Error updating medicine: ", e);
            throw e;
        }
    };

    // Helper to check if enough stock exists
    const checkStock = (id, quantityNeeded) => {
        const med = medicines.find(m => m.id === id);
        return med && med.currentStock >= quantityNeeded;
    };

    return (
        <MedicineContext.Provider value={{ medicines, addMedicine, updateMedicine, deleteMedicine, updateStock, checkStock, loading }}>
            {children}
        </MedicineContext.Provider>
    );
};

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../db';
import TreatmentForm from './TreatmentForm';
import { useAuth } from '../context/AuthContext';
import { useMedicines } from '../context/MedicineContext';

const SHCTreatment = ({ setActiveTab }) => {
    const { currentUser } = useAuth();
    const { medicines } = useMedicines();
    const [diagnosisOptions, setDiagnosisOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Sort medicines by name for display
    const sortedMedicines = [...(medicines || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }
            try {
                // 1. Fetch Diagnosis Options
                const docRef = doc(db, "settings", "diagnosis_lists");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().shcDiseases) {
                    setDiagnosisOptions(docSnap.data().shcDiseases);
                } else {
                    setDiagnosisOptions([
                        "Anoestrus", "Repeat Breeding", "Metritis", "U.D.G.", "P.D.", "Other"
                    ]);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const handleAddDisease = async () => {
        const newDisease = prompt("Enter the name of the new disease:");
        if (!newDisease || !newDisease.trim()) return;

        const diseaseName = newDisease.trim();
        // Capitalize first letter
        const formattedName = diseaseName.charAt(0).toUpperCase() + diseaseName.slice(1);

        if (diagnosisOptions.includes(formattedName)) {
            alert("This disease is already in the list!");
            return;
        }

        try {
            // Optimistic UI Update
            setDiagnosisOptions(prev => [...prev, formattedName]);

            const docRef = doc(db, "settings", "diagnosis_lists");
            await updateDoc(docRef, {
                shcDiseases: arrayUnion(formattedName)
            });
        } catch (error) {
            console.error("Error adding disease:", error);
            alert("Failed to save new disease.");
        }
    };

    if (loading) return <div className="p-4 text-center">Loading options...</div>;

    return (
        <TreatmentForm
            type="SHC"
            diagnosisOptions={diagnosisOptions}
            onAddDiagnosis={handleAddDisease}
            availableMedicines={sortedMedicines}
            setActiveTab={setActiveTab}
        />
    );
};

export default SHCTreatment;


import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, collection, getDocs } from 'firebase/firestore';
import { db } from '../db';
import TreatmentForm from './TreatmentForm';
import { useAuth } from '../context/AuthContext';

const TourPatient = ({ setActiveTab }) => {
    const { currentUser } = useAuth();
    const [diagnosisOptions, setDiagnosisOptions] = useState([]);
    const [medicineOptions, setMedicineOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) { setLoading(false); return; }
            try {
                // 1. Fetch Tour Diseases
                const docRef = doc(db, "settings", "diagnosis_lists");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().tourDiseases) {
                    const fetched = docSnap.data().tourDiseases;
                    setDiagnosisOptions(['Select', ...fetched.filter(d => d !== 'Select')]);
                } else {
                    setDiagnosisOptions(["Select", "General Checkup", "Emergency", "Other"]);
                }

                // 2. Fetch Medicines
                const medCollection = collection(db, 'users', currentUser.uid, 'medicines');
                const medSnap = await getDocs(medCollection);
                const fetchedMeds = medSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                fetchedMeds.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setMedicineOptions(fetchedMeds);

            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchData();
    }, [currentUser]);

    const handleAddDisease = async () => {
        const newDisease = prompt("Enter new Tour Diagnosis:");
        if (!newDisease || !newDisease.trim()) return;
        const diseaseName = newDisease.trim();
        if (diagnosisOptions.includes(diseaseName)) return alert("Already exists!");

        try {
            setDiagnosisOptions(prev => [...prev, diseaseName]);
            await updateDoc(doc(db, "settings", "diagnosis_lists"), { tourDiseases: arrayUnion(diseaseName) });
        } catch (error) { console.error(error); alert("Failed to save."); }
    };

    if (loading) return <div className="p-4 text-center">Loading options...</div>;

    return (
        <TreatmentForm
            type="Tour" // Mode
            diagnosisOptions={diagnosisOptions}
            onAddDiagnosis={handleAddDisease}
            availableMedicines={medicineOptions}
            setActiveTab={setActiveTab}
        />
    );
};

export default TourPatient;

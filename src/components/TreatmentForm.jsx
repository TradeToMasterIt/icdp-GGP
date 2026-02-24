import { useState, useEffect } from 'react';
import { db } from '../db';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'; // Check if collection/getDocs needed later, adding safely
import TreatmentPreviewModal from './TreatmentPreviewModal';
import { useMedicines } from '../context/MedicineContext';
import { useTreatments } from '../context/TreatmentContext';

const SPECIES = ['Select', 'Cow', 'Buffalo', 'Sheep', 'Goat', 'Dog', 'Bullock'];

const ANIMAL_COLORS = [
    "Black (Kali)", "Jet Black (Z-Black)", "White (Gori/Safed)", "Red / Reddish (Lal/Sindhi)",
    "Brown / Fawn (Bhuri)", "Grey / Silver (Sleti)", "Golden / Yellowish (Kapila)",
    "Black & White Spotted (Kali Kabri)", "Red & White Spotted (Lal Kabri)",
    "Brown & White Spotted (Bhuri Kabri)"
];

const IDENTIFICATION_MARKS = [
    "No Special Mark", "White Star on Head (Chandri)", "White Face (Safed Muh)",
    "Curved Horns (Gol Sing)", "Straight Horns (Khade Sing)", "Hornless (Modia)",
    "One Horn Broken (Ek Sing Tuta)", "Cut Ear (Kata Kaan)", "White Tail Switch (Safed Puch)"
];

// Removed static MEDICINE_TYPES to use dynamic state

const TreatmentForm = ({ type, diagnosisOptions, onAddDiagnosis, availableMedicines, setActiveTab }) => {
    // Contexts
    const { medicines: contextMedicines, updateStock, checkStock } = useMedicines() || {};
    const {
        addPrimaryTreatment, addSHCTreatment, addSupplyRecord, addTourRecord, // Added new functions
        primaryTreatments, shcTreatments, supplyRecords, tourRecords
    } = useTreatments() || {};

    // Dynamic Lists
    const [medicineTypes, setMedicineTypes] = useState(['All', 'Bolus', 'Tablet', 'Powder', 'Liquid', 'Injection', 'Ointment', 'Other']);
    const [caseCategories, setCaseCategories] = useState(['Select', 'Clinical', 'Field Visit', 'Emergency']); // Default fallback

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch Med Types
                const medRef = doc(db, "settings", "medicine_lists");
                const medSnap = await getDoc(medRef);
                if (medSnap.exists() && medSnap.data().types) {
                    setMedicineTypes(['All', ...medSnap.data().types]);
                }

                // Fetch Case Categories
                const catRef = doc(db, "settings", "treatment_options");
                const catSnap = await getDoc(catRef);
                if (catSnap.exists() && catSnap.data().categories) {
                    setCaseCategories(['Select', ...catSnap.data().categories]);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, []);

    console.log("TreatmentForm: Mounting. Type:", type);

    // Use passed medicines if available, otherwise context
    const medicines = availableMedicines || contextMedicines || [];

    // Local State
    const [villages, setVillages] = useState(() => {
        try {
            const saved = localStorage.getItem('vet_villages');
            let loaded = saved ? JSON.parse(saved) : ['Village A', 'Village B'];
            // Ensure 'Select' is first
            if (loaded[0] !== 'Select') {
                loaded = ['Select', ...loaded.filter(v => v !== 'Select')];
            }
            return loaded;
        } catch (e) {
            console.error("Error parsing vet_villages:", e);
            return ['Select', 'Village A', 'Village B'];
        }
    });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0], // Default to today
        ownerName: '',
        village: 'Select',
        tagNo: '', // Added Tag No
        category: '', // New Field - Default Empty as UI removed
        jati: 'Select',
        customJati: '',
        diagnosis: 'Select',
        customDiagnosis: '', // Still kept for 'Other' logic internal handling if needed, but UI forced to 'Select'
        selectedMedicines: [], // Array of { id, name, quantity }
        tourPatient: false // Added Tour Patient Toggle
    });

    const [showPreview, setShowPreview] = useState(false); // Modal State

    // Untagged Animal State
    const [isUntagged, setIsUntagged] = useState(false);
    const [idDetails, setIdDetails] = useState({
        name: '',
        color: 'Not Specified',
        mark: IDENTIFICATION_MARKS[0]
    });

    const [medicineSelection, setMedicineSelection] = useState({
        medId: '',
        quantity: 1
    });

    // Batch Mode State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [batchTags, setBatchTags] = useState('');

    // Flock/Herd Mode State
    const [isFlockMode, setIsFlockMode] = useState(false);
    const [flockCount, setFlockCount] = useState('');

    const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

    // Filter Medicines
    const filteredMedicines = medicines.filter(m =>
        selectedTypeFilter === 'All' || m.type === selectedTypeFilter
    );

    // Reset form when switching types
    // Reset form when switching types - FULL RESET
    useEffect(() => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            ownerName: '',
            village: 'Select',
            tagNo: '',
            category: '',
            jati: 'Select',
            customJati: '',
            diagnosis: 'Select',
            customDiagnosis: '',
            selectedMedicines: [],
            tourPatient: false
        });
        setIsBatchMode(false);
        setIsFlockMode(false);
        setBatchTags('');
        setFlockCount('');
    }, [type]);

    // Keep Diagnosis in sync if options reload (but don't wipe form!)
    useEffect(() => {
        // Only reset diagnosis if current selection is invalid?
        // Actually, just let it be. If options change, maybe we want to keep selection if valid.
        // But usually options only change on add.
        // For safety, if current diagnosis is not in new options (and not Select/Other), reset it.
        if (formData.diagnosis !== 'Select' && diagnosisOptions.length > 0 && !diagnosisOptions.includes(formData.diagnosis)) {
            // Optional: Reset diagnosis if invalid
            // setFormData(prev => ({ ...prev, diagnosis: 'Select' }));
        }
    }, [diagnosisOptions]);


    // Handlers
    // Handlers
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'village' && value === 'Add New Village...') {
            const newVillage = prompt("Enter New Village Name:");
            if (newVillage && newVillage.trim()) {
                const updatedVillages = [...villages, newVillage.trim()];
                setVillages(updatedVillages);
                localStorage.setItem('vet_villages', JSON.stringify(updatedVillages));
                setFormData(prev => ({ ...prev, village: newVillage.trim() }));
            } else {
                // Revert to default if cancelled or empty
                setFormData(prev => ({ ...prev, village: 'Select' }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Remove Manual Diagnosis Logic (Strict Mode is enforced by removing the input in Render)

    const handleAddMedicine = () => {
        if (!medicineSelection.medId) return;

        const medId = medicineSelection.medId; // ERROR FIX: Firestore IDs are strings, DO NOT parseInt
        const qty = parseInt(medicineSelection.quantity);

        // Check if valid
        if (qty <= 0) {
            alert("Quantity must be greater than 0");
            return;
        }

        // Check if medId is valid selection
        const medDetails = medicines.find(m => m.id === medId);
        if (!medDetails) {
            console.error("Medicine details not found in list for ID:", medId);
            alert("Error: Selected medicine attributes not found. Please refresh.");
            return;
        }

        // Calculate Total Quantity
        // If Flock Mode: Total = Dose * FlockCount
        // If Batch Mode (Single Add): Not applicable here, batch multiplier is at Save.
        // If Normal: Quantity is just Quantity.

        let finalQuantity = qty;
        if (isFlockMode) {
            const count = parseInt(flockCount);
            if (!count || count <= 0) {
                alert("Please enter a valid Head Count first.");
                return;
            }
            finalQuantity = qty * count;
        }

        // Check stock (using finalQuantity)
        let stockOk = false;
        if (checkStock && typeof checkStock === 'function') {
            stockOk = checkStock(medId, finalQuantity);
        }

        if (!stockOk) {
            if (medDetails.currentStock >= finalQuantity) {
                // warning but proceed
            } else {
                alert(`Not enough stock! Needed: ${finalQuantity}, Available: ${medDetails.currentStock}`);
                return;
            }
        }

        // Check if already added
        if (formData.selectedMedicines.find(m => m.id === medId)) {
            alert("Medicine already added to list. Remove it to change quantity.");
            return;
        }

        setFormData(prev => ({
            ...prev,
            selectedMedicines: [
                ...prev.selectedMedicines,
                {
                    id: medId,
                    name: medDetails.name,
                    type: medDetails.type,
                    quantity: finalQuantity, // Store TOTAL needed
                    dosePerAnimal: isFlockMode ? qty : null // Metadata
                }
            ]
        }));

        setMedicineSelection({ medId: '', quantity: 1 });
    };

    const removeMedicine = (id) => {
        setFormData(prev => ({
            ...prev,
            selectedMedicines: prev.selectedMedicines.filter(m => m.id !== id)
        }));
    };

    const handlePreSubmit = (e) => {
        e.preventDefault();

        const missing = [];
        if (!formData.ownerName || !formData.ownerName.trim()) missing.push("Owner Name");
        if (formData.diagnosis === 'Select') missing.push("Diagnosis");
        if (formData.jati === 'Select' || (formData.jati === 'Other' && !formData.customJati.trim())) missing.push("Species (Jati)");

        if (missing.length > 0) {
            alert(`Please fill the following required fields:\n- ${missing.join('\n- ')}\n\n(Current Values - Owner: "${formData.ownerName}", Diagnosis: "${formData.diagnosis}")`);
            return;
        }

        // Open Preview
        setShowPreview(true);
    };

    const confirmSubmit = async () => {
        // Close Modal
        setShowPreview(false);

        // Determine final diagnosis value
        // STRICT MODE: Only use dropdown value.
        const finalDiagnosis = formData.diagnosis;

        let tagsToProcess = [];

        if (isBatchMode) {
            // Batch Mode Validation
            if (isUntagged) {
                alert("Batch Mode cannot be used with 'Untagged Animal'. Please uncheck one.");
                return;
            }
            // Parse Tags (split by comma, space, or newline)
            tagsToProcess = batchTags.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
            if (tagsToProcess.length === 0) {
                alert("Please enter at least one Tag Number for Batch Mode.");
                return;
            }
            if (!formData.tagNo) {
                // formData.tagNo is ignored in batch mode, but we need consistency.
                // We'll skip the single tag validation.
            }

        } else if (isFlockMode) {
            // FLOCK MODE VALIDATION
            if (!flockCount || parseInt(flockCount) <= 0) {
                alert("Please enter a valid Head Count for the Flock.");
                return;
            }
            tagsToProcess = [`Flock (${flockCount})`]; // Single Entry

        } else {
            // Single Mode Validation
            let finalTagNo = formData.tagNo;
            if (isUntagged) {
                // Untagged Logic: Just use "Untagged"
                finalTagNo = "Untagged";
            } else {
                if (!formData.tagNo) {
                    alert("Please enter a Tag Number or select 'Animal has no Tag'.");
                    return;
                }
            }
            tagsToProcess = [finalTagNo];
        }

        // --- STOCK CHECK ---
        // For Flock Mode, 'quantity' in selectedMedicines IS ALREADY THE TOTAL. Multiplier is 1.
        // For Batch Mode, 'quantity' is Unit Dose. Multiplier is tagsToProcess.length.
        const multiplier = isFlockMode ? 1 : tagsToProcess.length;

        if (multiplier > 1 && !isFlockMode) {
            // We need to ensure we have enough stock for ALL animals (Only for Batch, Flock is pre-checked)
            let stockError = false;
            formData.selectedMedicines.forEach(med => {
                // Find current stock from context/medicines list
                const freshMed = medicines.find(m => m.id === med.id);
                const currentStock = freshMed ? freshMed.currentStock : 0;
                const totalNeeded = med.quantity * multiplier;

                if (totalNeeded > currentStock) {
                    alert(`Insufficient Stock for Batch Processing!\n\nMedicine: ${med.name}\nGeneric Stock: ${currentStock}\nNeeded: ${totalNeeded} (${med.quantity} x ${multiplier} animals)`);
                    stockError = true;
                }
            });

            if (stockError) return;

            if (!window.confirm(`Batch Processing:\n\nYou are about to create ${multiplier} treatment records.\nTotal Stock to be deducted will be multiplied by ${multiplier}.\n\nProceed?`)) {
                return;
            }
        }

        // --- LOOP & SAVE ---
        const finalJati = formData.jati === 'Other' ? formData.customJati : formData.jati;

        tagsToProcess.forEach(tag => {
            const entry = {
                date: formData.date,
                ownerName: formData.ownerName,
                village: formData.village,
                tagNo: tag, // Use the specific tag for this iteration
                jati: finalJati,
                diagnosis: finalDiagnosis,
                medicinesUsed: formData.selectedMedicines,
                type: type, // 'Primary' or 'SHC'
                tourPatient: formData.tourPatient || false,
                isFlock: isFlockMode,
                animalCount: isFlockMode ? parseInt(flockCount) : 1
            };

            // 1. Save based on Type
            if (type === 'Primary') {
                addPrimaryTreatment(entry);
            } else if (type === 'SHC') {
                addSHCTreatment(entry);
            } else if (type === 'Supply') {
                addSupplyRecord(entry);
            } else if (type === 'Tour') {
                addTourRecord(entry);
            }
        });

        // 2. Deduct Stock (Total)
        formData.selectedMedicines.forEach(med => {
            updateStock(med.id, med.quantity * multiplier);
        });

        // 3. Reset
        alert(`Successfully Saved ${multiplier} Record(s)!`);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            ownerName: '',
            village: 'Select',
            tagNo: '',
            category: 'Select',
            jati: 'Select',
            customJati: '',
            diagnosis: 'Select',
            customDiagnosis: '',
            selectedMedicines: [],
            tourPatient: false
        });
        setBatchTags('');
        setIsBatchMode(false);

        if (isUntagged) {
            setIdDetails({
                name: '',
                color: 'Not Specified',
                mark: IDENTIFICATION_MARKS[0]
            });
        }
    };

    const getThemeColor = () => type === 'SHC' ? 'purple' : 'blue';

    // Fetch History for Display Logic
    // Maps type to context data
    const getHistoryList = () => {
        switch (type) {
            case 'Primary': return primaryTreatments;
            case 'SHC': return shcTreatments;
            case 'Supply': return supplyRecords;
            case 'Tour': return tourRecords;
            default: return [];
        }
    };
    const historyList = getHistoryList() || [];
    // Sort logic handled in context (descending), but double check just in case
    // NOTE: primaryTreatments from context are already sorted by DESC (newest first)

    return (
        <div className="w-full max-w-4xl mx-auto p-4 pb-24 space-y-6">
            <div className="bg-white rounded shadow">
                <div className={`p-4 bg-${getThemeColor()}-50 border-b border-${getThemeColor()}-100`}>
                    <h2 className={`text-xl font-bold text-${getThemeColor()}-700`}>{type} Treatment</h2>
                    <p className="text-gray-600 text-sm">{type === 'Supply' ? 'Medicine Distribution Entry' : 'Clinical Case Entry'}</p>
                </div>

                <form onSubmit={handlePreSubmit} className="p-4 space-y-4">

                    <TreatmentPreviewModal
                        isOpen={showPreview}
                        onClose={() => setShowPreview(false)}
                        onConfirm={confirmSubmit}
                        data={{
                            ...formData,
                            medicinesUsed: formData.selectedMedicines, // ALIAS FOR MODAL
                            isUntagged,
                            isFlock: isFlockMode,
                            isBatch: isBatchMode,
                            animalCount: isFlockMode ? flockCount : (isBatchMode ? batchTags.split(',').length : 1),
                            type
                        }}
                    />

                    {/* Date */}
                    {/* Row 1: Date & Village */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-800 text-sm font-bold mb-1">Entry Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Village</label>
                            <select
                                name="village"
                                value={formData.village}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500"
                            >
                                {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                <option value="Add New Village..." className="font-bold text-blue-600">+ Add New Village...</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Owner Name */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1">Owner Name</label>
                        <input
                            type="text"
                            name="ownerName"
                            value={formData.ownerName}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500"
                            placeholder="Name"
                        />
                    </div>

                    {/* Jati and Diagnosis Grid */}
                    <div className="mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-gray-800">Tag Number / Identification</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-xs font-bold text-gray-600">Untagged Animal?</span>
                                    <input
                                        type="checkbox"
                                        checked={isUntagged}
                                        onChange={(e) => {
                                            setIsUntagged(e.target.checked);
                                            if (e.target.checked) setIsBatchMode(false); // Disable batch if untagged
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Batch Mode Toggle */}
                        <div className="flex items-center gap-2 mb-3 bg-indigo-50 p-2 rounded border border-indigo-100">
                            <input
                                type="checkbox"
                                id="batchToggle"
                                checked={isBatchMode}
                                onChange={(e) => {
                                    setIsBatchMode(e.target.checked);
                                    if (e.target.checked) setIsUntagged(false); // Disable untagged if batch
                                }}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="batchToggle" className="text-sm font-bold text-indigo-800 cursor-pointer select-none">
                                Treat Multiple Animals (Batch Entry)
                            </label>
                        </div>

                        {/* Flock Mode Toggle */}
                        <div className="flex items-center gap-2 mb-3 bg-green-50 p-2 rounded border border-green-100">
                            <input
                                type="checkbox"
                                id="flockToggle"
                                checked={isFlockMode}
                                onChange={(e) => {
                                    setIsFlockMode(e.target.checked);
                                    if (e.target.checked) {
                                        setIsBatchMode(false); // Exclusive
                                        setIsUntagged(false);
                                    }
                                }}
                                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                            />
                            <label htmlFor="flockToggle" className="text-sm font-bold text-green-800 cursor-pointer select-none">
                                Is this a Flock/Herd? (e.g. Sheep/Goats)
                            </label>
                        </div>

                        {!isUntagged ? (
                            isBatchMode ? (
                                <div>
                                    <textarea
                                        value={batchTags}
                                        onChange={(e) => setBatchTags(e.target.value)}
                                        placeholder="Enter Tag Numbers separated by commas or new lines...&#10;Example:&#10;Cow1, Cow2, Cow3"
                                        rows="3"
                                        className="w-full p-2 border border-indigo-300 rounded text-black bg-white focus:outline-none focus:border-indigo-500 font-mono tracking-wide text-sm"
                                    ></textarea>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Count: {batchTags.split(/[\n,]+/).filter(t => t.trim().length > 0).length} Animals selected.
                                    </p>
                                </div>
                            ) : isFlockMode ? (
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Total Head Count (Number of Animals)</label>
                                    <input
                                        type="number"
                                        value={flockCount}
                                        onChange={(e) => setFlockCount(e.target.value)}
                                        placeholder="e.g. 100"
                                        className="w-full p-2 border border-green-300 rounded text-black bg-white focus:outline-none focus:border-green-500 font-bold text-lg"
                                        min="1"
                                    />
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    name="tagNo"
                                    value={formData.tagNo}
                                    onChange={handleChange}
                                    placeholder="Enter 12-digit Tag Number"
                                    className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                                />
                            )
                        ) : (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm font-bold animate-fadeIn">
                                ⚠️ Animal will be recorded as "Untagged"
                            </div>
                        )}
                    </div>

                    {/* Jati and Diagnosis Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Jati (Species) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Jati (Species)</label>
                            <select
                                name="jati"
                                value={formData.jati}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500"
                            >
                                {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="Other">Other (Custom)</option>
                            </select>
                            {formData.jati === 'Other' && (
                                <input
                                    type="text"
                                    name="customJati"
                                    value={formData.customJati}
                                    onChange={handleChange}
                                    className="mt-2 w-full p-2 border border-blue-300 rounded bg-blue-50 focus:outline-none"
                                    placeholder="Enter Species Name"
                                />
                            )}
                        </div>

                        {/* Diagnosis (Strict Dropdown) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Diagnosis</label>
                            <div className="flex gap-2">
                                <select
                                    name="diagnosis"
                                    value={formData.diagnosis}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-blue-500 flex-1"
                                >
                                    {diagnosisOptions && diagnosisOptions.length > 0 ? (
                                        diagnosisOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                                    ) : (
                                        <option>Loading...</option>
                                    )}
                                </select>
                                {onAddDiagnosis && (
                                    <button
                                        type="button"
                                        onClick={onAddDiagnosis}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-3 rounded border border-gray-300"
                                        title="Add New Disease"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Medicine Selection Section */}
                    <div className="bg-gray-50 p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-800 mb-2">Used Medicines</label>

                        <div className="flex flex-col gap-2 mb-2">
                            {/* Type Filter */}
                            <div className="flex gap-2 items-center">
                                <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Filter Type:</label>
                                <select
                                    value={selectedTypeFilter}
                                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                                    className="p-1 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {medicineTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <select
                                    value={medicineSelection.medId}
                                    onChange={(e) => setMedicineSelection({ ...medicineSelection, medId: e.target.value })}
                                    className="flex-1 p-2 border border-blue-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-0"
                                >
                                    <option value="">Select Medicine</option>
                                    {filteredMedicines.map(m => (
                                        <option key={m.id} value={m.id} disabled={m.currentStock <= 0}>
                                            {m.name} ({m.type}) - Stock: {m.currentStock}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex-1 flex flex-col min-w-[70px]">
                                    <input
                                        type="number"
                                        value={medicineSelection.quantity}
                                        onChange={(e) => setMedicineSelection({ ...medicineSelection, quantity: e.target.value })}
                                        className="p-2 border border-gray-300 rounded text-sm w-full"
                                        placeholder={isFlockMode ? "Dose" : "Qty"}
                                        min="1"
                                    />
                                    {isFlockMode && flockCount && medicineSelection.quantity && (
                                        <span className="text-[10px] text-green-600 font-bold leading-tight">
                                            Total: {medicineSelection.quantity * parseInt(flockCount)}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddMedicine}
                                    className="bg-blue-600 text-white px-3 rounded font-bold hover:bg-blue-700"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>

                        {/* Selected List */}
                        {formData.selectedMedicines.length > 0 ? (
                            <ul className="space-y-1 mt-2">
                                {formData.selectedMedicines.map(item => (
                                    <li key={item.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm">
                                        <span>
                                            <span className="font-bold text-gray-800">{item.name}</span>
                                            <span className="text-gray-500 text-xs ml-1">({item.type})</span>
                                            {item.dosePerAnimal && (
                                                <span className="block text-[10px] text-green-600">
                                                    Flock Dose: {item.dosePerAnimal} x {isFlockMode ? flockCount : 'N'} = {item.quantity}
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-blue-600">x{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeMedicine(item.id)}
                                                className="text-red-500 hover:text-red-700 font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-center text-gray-400 mt-2">No medicines added.</p>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className={`w-full text-white font-bold text-lg py-3 rounded shadow transition ${type === 'SHC' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        Save {type} Record
                    </button>

                </form>
            </div >

            {/* RECENT ACTIVITY LIST (Last 5) */}
            < div className="space-y-4" >
                <div className="bg-white p-3 rounded shadow border border-gray-300 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Recent Activity (Last 5)</h3>
                </div>

                {
                    historyList && historyList.length > 0 ? (
                        <div className="bg-white rounded shadow border border-gray-300 overflow-hidden">
                            <div className="overflow-x-auto max-h-80">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-300">
                                        <tr>
                                            <th className="p-2 border-b">Date</th>
                                            <th className="p-2 border-b">Owner</th>
                                            <th className="p-2 border-b">Tag/ID</th>
                                            <th className="p-2 border-b">Diagnosis</th>
                                            <th className="p-2 border-b">Type</th>
                                            <th className="p-2 border-b">Medicines</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {historyList.slice(0, 5).map(entry => (
                                            <tr key={entry.id} className="hover:bg-gray-50">
                                                <td className="p-2 whitespace-nowrap">{entry.date || entry.timestamp?.split('T')[0]}</td>
                                                <td className="p-2 font-bold">{entry.ownerName}</td>
                                                <td className="p-2 text-xs font-mono bg-gray-50 rounded">{entry.tagNo || '-'}</td>
                                                <td className="p-2 text-blue-600 font-medium">{entry.diagnosis}</td>
                                                <td className="p-2 text-xs text-gray-600">
                                                    {entry.medicinesUsed && entry.medicinesUsed.length > 0
                                                        ? [...new Set(entry.medicinesUsed.map(m => {
                                                            if (m.type) return m.type;
                                                            const found = medicines.find(med => med.id === m.id);
                                                            return found ? found.type : 'Unknown';
                                                        }))].join(', ')
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="p-2 text-xs text-gray-500">
                                                    {entry.medicinesUsed && entry.medicinesUsed.length > 0
                                                        ? entry.medicinesUsed.map(m => m.name).join(', ')
                                                        : '-'
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-4">No recent records.</div>
                    )
                }

                {/* View All Button */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={() => setActiveTab('treatment_report')}
                        className={`flex items-center gap-2 ${type === 'SHC' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            } hover:bg-opacity-80 px-6 py-2 rounded-full font-bold transition-colors border`}
                    >
                        <span>📂</span>
                        View Full Treatment Report
                    </button>
                </div>
            </div >

        </div >
    );
};
export default TreatmentForm;

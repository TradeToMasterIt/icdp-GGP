import { useState, useEffect } from 'react';
import { useReceipts } from '../context/ReceiptContext';
import { useBulls } from '../context/BullContext';
import { useAuth } from '../context/AuthContext'; // NEW
import { db } from '../db'; // NEW
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';

import SuccessPopup from './SuccessPopup';
import PregnancySafetyPopup from './PregnancySafetyPopup';

const CATEGORIES = ['GEN', 'OBC', 'SC', 'FEMALE', 'ST'];
const SPECIES = ['Cow', 'Buffalo'];
const BREEDS = {
    Cow: ['GIR', 'H.F', 'KANKREJ', 'N.D.'],
    Buffalo: ['MEHASANI', 'SURTI', 'MURRAH', 'JAFARABADI', 'BANNI', 'N.D. BUFFALO']
};
const SEMEN_TYPES = ['Conventional', 'Sexed'];

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

const DataEntry = ({ setActiveTab }) => {
    const { currentUser } = useAuth();
    const { getNextReceipt, incrementReceipt, restoreReceipt } = useReceipts();
    const { bulls, decrementBullDoses, incrementBullDoses } = useBulls();

    // Early return if auth not ready
    if (!currentUser) return <div className="p-4 text-center">Loading User Profile...</div>;

    // Local state
    const [villages, setVillages] = useState(() => {
        const saved = localStorage.getItem('vet_villages');
        let initial = saved ? JSON.parse(saved) : [];
        // Migration: Remove legacy defaults if they persist
        initial = initial.filter(v => v !== 'Village A' && v !== 'Village B');
        return initial;
    });
    const [isAddingVillage, setIsAddingVillage] = useState(false);
    const [newVillageName, setNewVillageName] = useState('');

    // Feedback & Lock State
    const [lookupMessage, setLookupMessage] = useState('');
    const [isLocked, setIsLocked] = useState(false);

    // Popup State
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [lastSavedEntry, setLastSavedEntry] = useState(null);

    // Pregnancy Safety State
    const [showPregnancyPopup, setShowPregnancyPopup] = useState(false);
    const [conflictingEntry, setConflictingEntry] = useState(null);

    // Dynamic Receipt State
    const [currentReceiptNo, setCurrentReceiptNo] = useState(null);
    const [currentReceiptType, setCurrentReceiptType] = useState(null);
    const [isManualReceipt, setIsManualReceipt] = useState(false); // NEW

    // SAFETY LOCK STATE
    const [showBlockingPopup, setShowBlockingPopup] = useState(false);
    const [blockingReason, setBlockingReason] = useState('');
    const [blockingPDRecord, setBlockingPDRecord] = useState(null); // Store record for unlocking

    // UNLOCK / ABORTION DIALOG STATE
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [unlockReason, setUnlockReason] = useState('Abortion / Miscarriage');

    // DUPLICATE WARNING STATE
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [duplicateEntry, setDuplicateEntry] = useState(null);

    // Helper for Local Date (YYYY-MM-DD)
    const getTodayDate = () => {
        const d = new Date();
        // Adjust for local timezone offset to ensure we get local YYYY-MM-DD
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        return localDate.toISOString().split('T')[0];
    };

    // State for Data Entry
    const [formData, setFormData] = useState({
        date: getTodayDate(),
        countryCode: '+91',
        tagNo: '',
        bullId: '',
        semenType: '', // Force selection (User Request)
        ownerName: '',
        mobileNumber: '',
        village: '',
        category: 'GEN',
        jati: 'Cow', // Changed from species to jati for consistency
        breed: '', // Default empty to force checking
        animalColor: 'Black (Kali)', // Default
        identificationMark: 'No Special Mark', // Default
        animalName: '', // For Untagged
        cost: 300,
        vetar: '' // New Field (1-2 Digits)
    });

    const [recentEntries, setRecentEntries] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Untagged Logic State
    const [isUntagged, setIsUntagged] = useState(false);
    const [idDetails, setIdDetails] = useState({
        name: '',
    });

    // PREVIEW & SAVE STATE
    const [showPreview, setShowPreview] = useState(false);
    const [formDataToSave, setFormDataToSave] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // FETCH INITIAL RECENT ENTRIES (For Persistent "Modify Any Time")
    useEffect(() => {
        const fetchRecents = async () => {
            if (!currentUser) return; // Wait for user

            try {
                // Query: Last 1 entry FOR THIS USER, ordered by creation time (newest first)
                const q = query(
                    collection(db, "breeding"),
                    where("userId", "==", currentUser.uid), // Filter by User
                    orderBy("createdAt", "desc"),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                const entries = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id // Prioritize Firestore String ID
                }));
                setRecentEntries(entries);
            } catch (error) {
                console.error("Error fetching recent activity:", error);
                if (error.code === 'failed-precondition') {
                    // Index missing case
                    console.warn("Index needed for userId + createdAt. Check console link.");
                }
            }
        };

        fetchRecents();
    }, [currentUser]); // Run when user loads
    // DYNAMIC RECEIPT UPDATE
    // Fetch appropriate receipt number when semen type changes
    useEffect(() => {
        const type = formData.semenType;

        if (!type) {
            setCurrentReceiptNo(null);
            setCurrentReceiptType(null);
            setFormData(prev => ({ ...prev, receiptNo: '' }));
            return;
        }

        // CHECK: If Edit Mode, don't overwrite the receipt number if the type hasn't changed!
        if (isEditMode && editingId) {
            const original = recentEntries.find(e => e.id === editingId);
            if (original && original.semenType === type) {
                // Keep original receipt number, don't auto-fetch next
                setCurrentReceiptType(type);
                return;
            }
        }

        // NEW: MANUAL MODE CHECK
        // If Manual Mode is enabled, do NOT auto-increment or overwrite the user's input
        if (isManualReceipt) return;

        const nextNo = getNextReceipt(type);
        setCurrentReceiptNo(nextNo);
        setCurrentReceiptType(type);

        // Also sync to form data for submission
        setFormData(prev => ({
            ...prev,
            receiptNo: nextNo !== 'No Active Book' ? nextNo : ''
        }));

    }, [formData.semenType, getNextReceipt, isEditMode, editingId, recentEntries, isManualReceipt]); // Added isManualReceipt dependency


    // HISTORY & SAFETY VALIDATION (Strict Source-Based)
    const validateAnimalStatus = async (tag, checkDate = formData.date, ignoreDuplicate = false) => {
        if (!tag || tag.length < 8) return { blocked: false };

        try {
            const targetDateStr = checkDate || formData.date;

            // STEP 1: Check Pregnancy Status (Source: P.D. List ONLY - 'treatments' collection)
            const qPD = query(
                collection(db, "treatments"),
                where('tagNo', '==', tag)
            );

            // Fetch PD records WITH IDs
            const pdSnapshot = await getDocs(qPD);
            const pdDocs = pdSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter for type == 'PD' and Sort by Date Descending
            const records = pdDocs
                .filter(d => d.type === 'PD')
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            const latestPD = records[0];

            if (latestPD && latestPD.result === 'Positive') {
                setBlockingReason(`⛔ Animal is Pregnant (Positive in P.D. List). Entry Blocked. (Confirmed on ${latestPD.date})`);
                setBlockingPDRecord(latestPD); // Store for Unlock
                setShowBlockingPopup(true);
                return { blocked: true, reason: 'PD_List_Positive' };
            }

            // STEP 1.5: LEGACY SAFETY NET (Check Old 'breeding' records for Pregnant status)
            // This catches animals pregnant BEFORE we started using 'treatments' collection.
            const qLegacy = query(
                collection(db, "breeding"),
                where('tagNo', '==', tag),
                orderBy('date', 'desc'),
                limit(1)
            );
            const legacySnap = await getDocs(qLegacy);
            if (!legacySnap.empty) {
                const legacyEntry = { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() };
                // Only block if explicitly Pregnant, PD+, or pd_result is Positive
                const isLegacyPregnant = (legacyEntry.status === 'Pregnant' || legacyEntry.status === 'Pregnant (PD+)' || legacyEntry.pd_result === 'Positive');

                if (isLegacyPregnant && legacyEntry.date !== targetDateStr) {
                    setBlockingReason(`⛔ Animal is Pregnant (Legacy Record). Entry Blocked. (Last AI/PD: ${legacyEntry.date})`);
                    // Map to expected structure for Unlock
                    setBlockingPDRecord({
                        id: legacyEntry.id,
                        tagNo: legacyEntry.tagNo,
                        isLegacy: true // Flag for unlock logic
                    });
                    setShowBlockingPopup(true);
                    return { blocked: true, reason: 'Legacy_Pregnant' };
                }
            }
            if (!ignoreDuplicate) {
                const qDuplicate = query(
                    collection(db, "breeding"),
                    where('tagNo', '==', tag),
                    where('date', '==', targetDateStr)
                );

                const dupSnapshot = await getDocs(qDuplicate);

                if (!dupSnapshot.empty) {
                    const duplicate = dupSnapshot.docs[0].data();
                    setDuplicateEntry(duplicate);
                    setShowDuplicateWarning(true);
                    return { blocked: true, reason: 'Duplicate' };
                }
            }

            return { blocked: false };

        } catch (error) {
            console.error("Error validating animal:", error);
            return { blocked: false };
        }
    };

    // HANDLE UNLOCK (Abortion / False Positive)
    const handleUnlockConfirm = async () => {
        if (!blockingPDRecord) return;

        try {
            if (unlockReason === 'Abortion / Miscarriage') {
                // 1. Create Abortion Record
                await addDoc(collection(db, "treatments"), {
                    type: 'Abortion',
                    tagNo: blockingPDRecord.tagNo,
                    date: new Date().toISOString().split('T')[0],
                    notes: 'Reported via Data Entry Unlock',
                    userId: currentUser?.uid || 'System',
                    createdAt: new Date().toISOString()
                });

                // 2. Update Breeding Status
                if (blockingPDRecord.isLegacy && blockingPDRecord.id) {
                    // Direct Update for Legacy
                    await updateDoc(doc(db, "breeding", blockingPDRecord.id), {
                        status: 'Aborted',
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Best Attempt Query for associated Breeding Record
                    const qBreeding = query(
                        collection(db, "breeding"),
                        where('tagNo', '==', blockingPDRecord.tagNo),
                        where('status', '==', 'Pregnant (PD+)')
                    );
                    const breedingSnap = await getDocs(qBreeding);
                    if (!breedingSnap.empty) {
                        const docToUpdate = breedingSnap.docs[0];
                        await updateDoc(doc(db, "breeding", docToUpdate.id), {
                            status: 'Aborted',
                            updatedAt: new Date().toISOString()
                        });
                    }
                }

                alert("Abortion recorded. Animal status reset to 'Aborted'.");

            } else if (unlockReason === 'False Positive / Data Error') {
                if (blockingPDRecord.isLegacy && blockingPDRecord.id) {
                    // Legacy: Directly update the Breeding Record
                    await updateDoc(doc(db, "breeding", blockingPDRecord.id), {
                        status: 'Empty',
                        pd_result: 'Negative',
                        updatedAt: new Date().toISOString()
                    });
                    alert("Legacy Status corrected to Empty/Negative.");

                } else if (blockingPDRecord.id) {
                    // Modern: Update the WRONG P.D. record to Negative
                    await updateDoc(doc(db, "treatments", blockingPDRecord.id), {
                        result: 'Negative',
                        notes: 'Correction: False Positive (Unlocked via Data Entry)',
                        updatedAt: new Date().toISOString()
                    });
                    // Update Breeding Status too if found
                    const qBreeding = query(
                        collection(db, "breeding"),
                        where('tagNo', '==', blockingPDRecord.tagNo),
                        where('status', '==', 'Pregnant (PD+)')
                    );
                    const breedingSnap = await getDocs(qBreeding);
                    if (!breedingSnap.empty) {
                        await updateDoc(doc(db, "breeding", breedingSnap.docs[0].id), {
                            status: 'Empty', // Reset to empty 
                            pd_result: 'Negative',
                            updatedAt: new Date().toISOString()
                        });
                    }
                    alert("P.D. status corrected to Negative. Block removed.");
                }
            }

            // RESET STATE
            setShowUnlockDialog(false);
            setShowBlockingPopup(false);
            setBlockingPDRecord(null);

            // Re-validate to clear any residual state or just show green
            // Actually, we want to allow entry immediately. 
            // The user might want to re-check.
            setLookupMessage("✓ Status Unlocked. You may proceed.");

        } catch (error) {
            console.error("Unlock failed:", error);
            alert("Failed to update status: " + error.message);
        }
    };


    // ...(render)


    // HANDLERS
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleJatiChange = (e) => {
        const selectedSpecies = e.target.value;
        setFormData(prev => ({
            ...prev,
            jati: selectedSpecies,
            breed: '', // Reset to empty to force select
            category: 'GEN' // Reset category default
        }));
    };

    const handleBreedChange = (e) => {
        setFormData(prev => ({ ...prev, breed: e.target.value }));
    };

    const resetForm = () => {
        setFormData(prev => ({
            ...prev,
            tagNo: '',
            bullId: '',
            ownerName: '',
            countryCode: '+91',
            mobileNumber: '',
            village: '',
            category: 'GEN',
            animalColor: 'Black (Kali)',
            identificationMark: 'No Special Mark',
            animalName: '',
            vetar: ''
        }));
        setBlockingPDRecord(null);
        setBlockingReason('');
        setIsLocked(false);
        setLookupMessage('');
        setIsEditMode(false);
        setEditingId(null);
    };
    const handleSemenTypeChange = (e) => {
        setFormData(prev => ({
            ...prev,
            semenType: e.target.value,
            bullId: '' // Reset bull selection on type change
        }));
    };

    // Village Logic
    const handleVillageChange = (e) => {
        if (e.target.value === 'ADD_NEW') {
            setIsAddingVillage(true);
            setFormData({ ...formData, village: '' });
        } else {
            setFormData({ ...formData, village: e.target.value });
        }
    };

    const saveNewVillage = () => {
        if (newVillageName.trim()) {
            const updatedVillages = [...villages, newVillageName.trim()];
            setVillages(updatedVillages);
            localStorage.setItem('vet_villages', JSON.stringify(updatedVillages));
            setFormData({ ...formData, village: newVillageName.trim() });
            setNewVillageName('');
            setIsAddingVillage(false);
        }
    };

    // FETCH LAST ENTRY FROM FIRESTORE
    const fetchLastAnimalEntry = async (tag) => {
        try {
            // NOTE: We don't use orderBy('date', 'desc') here to avoid needing a Composite Index.
            // Instead, we fetch all matches for this tag and sort in JS. 
            // Since one animal won't have huge history, this is safe.
            const q = query(
                collection(db, "breeding"),
                where('tagNo', '==', tag)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort Descending by Date
                docs.sort((a, b) => new Date(b.date) - new Date(a.date));
                return docs[0];
            }
            return null;
        } catch (error) {
            console.error("Error fetching animal history:", error);
            // Optional: Alert the user if it's a permission/network error, 
            // but usually silent fail is better for auto-fill.
            return null;
        }
    };

    // HISTORY LOOKUP LOGIC
    const handleTagBlur = async () => {
        const tag = formData.tagNo.trim();
        if (!tag || tag.length < 8) return;

        console.log("Searching history for:", tag);
        setLookupMessage("🔍 Checking history...");

        // SAFETY CHECK (Async)
        // Await validation. If it returns blocked (Duplicate Warning OR Pregnant Block), stop here.
        const validation = await validateAnimalStatus(tag, formData.date);
        if (validation && validation.blocked) {
            setLookupMessage(""); // Clear loading msg
            return;
        }

        // LOCAL FALLBACK FOR DUPLICATES (If Firestore missed it due to lag/offline)
        const localDuplicate = recentEntries.find(e => e.tagNo === tag && e.date === formData.date);
        if (localDuplicate) {
            setDuplicateEntry(localDuplicate);
            setShowDuplicateWarning(true);
            setLookupMessage("");
            return;
        }

        // 1. FIRST TRY LOCAL STORAGE (Fastest)
        let historyMatch = recentEntries.find(e => e.tagNo === tag && e.date !== formData.date);

        // 2. IF NOT LOCAL, TRY FIRESTORE (Full History)
        if (!historyMatch) {
            const firestoreMatch = await fetchLastAnimalEntry(tag);
            if (firestoreMatch) {
                // Ensure we don't treat a same-day entry from Firestore as "History" if we already checked duplicates
                // (Though validateAnimalStatus handles strict duplicates)
                historyMatch = firestoreMatch;
            }
        }

        if (historyMatch) {
            // CHECK PREGNANCY STATUS (Safety Check)
            if (historyMatch.status === 'Pregnant (PD+)') {
                setConflictingEntry(historyMatch);
                setShowPregnancyPopup(true);
                setLookupMessage("");
                return;
            }

            // AUTO-FILL FORM
            console.log("Auto-filling from:", historyMatch);
            setFormData(prev => ({
                ...prev,
                ownerName: historyMatch.ownerName || '',
                mobileNumber: historyMatch.mobileNumber || '',
                category: historyMatch.category || 'GEN',
                village: villages.includes(historyMatch.village) ? historyMatch.village : prev.village, // Keep current if not in list, or maybe add?
                jati: historyMatch.jati || 'Cow',
                breed: historyMatch.breed || (historyMatch.jati === 'Cow' ? 'GIR' : 'MEHASANI'),
                bullId: '' // Reset bull
            }));

            // If village was from history and not in list, maybe we should add it? 
            // For now, simple check.
            if (historyMatch.village && !villages.includes(historyMatch.village)) {
                // Optional: setVillages(prev => [...prev, historyMatch.village]);
            }

            setIsLocked(true); // Lock consistently to indicate "Found"

            // Visual feedback
            setLookupMessage('✓ Animal details found in history & auto-filled!');

        } else {
            // No match found anywhere
            setIsLocked(false);
            setLookupMessage('');
        }
    };

    // PREGNANCY CORRECTION WORKFLOW
    const handlePregnancyCancel = () => {
        setShowPregnancyPopup(false);
        setConflictingEntry(null);
        setFormData({ ...formData, tagNo: '' }); // Clear the tag
        setIsLocked(false);
    };

    const handlePregnancyCorrection = (reason) => {
        if (!conflictingEntry) return;

        const confirmMessage = `Mark this animal as '${reason}' and proceed with new Entry?`;

        if (window.confirm(confirmMessage)) {
            // 1. Update the OLD entry in the database (local state) to 'Empty'
            const updatedEntries = recentEntries.map(entry => {
                if (entry.id === conflictingEntry.id) {
                    return {
                        ...entry,
                        status: 'Empty',
                        notes: (entry.notes || '') + ` [Marked as ${reason} via Safety Lock]`
                    };
                }
                return entry;
            });

            setRecentEntries(updatedEntries); // This triggers existing useEffect to save to localStorage

            // 2. Auto-Resume: Close popup and Pre-fill form
            setShowPregnancyPopup(false);

            // Pre-fill like a normal history match using the conflicting entry info
            setFormData(prev => ({
                ...prev,
                ownerName: conflictingEntry.ownerName,
                mobileNumber: conflictingEntry.mobileNumber || '', // NEW
                category: conflictingEntry.category,
                village: villages.includes(conflictingEntry.village) ? conflictingEntry.village : prev.village,
                jati: conflictingEntry.jati,
                breed: conflictingEntry.breed,
                bullId: ''
            }));

            // Allow editing but maybe lock breed/jati? 
            // Requirement says "ALLOW the A.I. entry to proceed". 
            // Usually we lock consistent data.
            setIsLocked(true);
            setLookupMessage(`✓ Status Corrected (${reason}). Proceeding...`);
            setConflictingEntry(null);
        }
    };

    // Bull Filtering Logic - UPDATED
    const filteredBulls = bulls.filter(bull => {
        if (bull.jati !== formData.jati) return false;

        // NEW FILTER: Semen Type
        if (bull.semenType !== formData.semenType) return false;

        // NEW FILTER: Hide Zero Stock
        if ((bull.doses || 0) <= 0) return false;

        if (formData.jati === 'Cow' && formData.breed === 'N.D.') return true;
        if (formData.jati === 'Buffalo' && formData.breed === 'N.D. BUFFALO') return true;
        return bull.breed === formData.breed || bull.breed.startsWith(formData.breed + " ");
    });



    // EDIT HANDLERS
    const handleEdit = (entry) => {
        setIsEditMode(true);
        setEditingId(entry.id);

        // Populate Form
        setFormData({
            date: entry.date,
            ownerName: entry.ownerName,
            countryCode: entry.countryCode || '+91',
            mobileNumber: entry.mobileNumber || '', // NEW
            category: entry.category,
            village: entry.village,
            jati: entry.jati,
            breed: entry.breed,
            semenType: entry.semenType,
            range: 'Conventional', // Default, logic handles actual type
            bullId: entry.bullId,
            tagNo: entry.tagNo,
            receiptNo: entry.receiptNo,
            vetar: entry.vetar || ''
        });

        // Handle Untagged Logic Reconstruction
        if (entry.tagNo && String(entry.tagNo).includes(" - ")) {
            setIsUntagged(true);
            const parts = entry.tagNo.split(" - ");
            setIdDetails({
                name: parts[0],
            });
        } else {
            setIsUntagged(false);
        }

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditingId(null);
        // Reset sensitive fields, keep strict ones
        setFormData(prev => ({
            ...prev,
            receiptNo: currentReceiptNo !== 'No Active Book' ? currentReceiptNo : '',
            tagNo: '',
            bullId: ''
        }));
        setIsUntagged(false);
    };

    // --- DUPLICATE CHECK LOGIC ---
    const checkIfReceiptExists = async (receiptNo) => {
        const type = formData.semenType;
        if (!receiptNo || !type) return false;

        // Check both Number and String formats to cover legacy data
        const numVal = parseInt(receiptNo);
        const strVal = String(receiptNo);

        // 1. Check as Number
        const qNum = query(
            collection(db, "breeding"),
            where("receiptNo", "==", numVal),
            where("semenType", "==", type)
        );
        const snapNum = await getDocs(qNum);
        if (!snapNum.empty) return true;

        // 2. Check as String
        const qStr = query(
            collection(db, "breeding"),
            where("receiptNo", "==", strVal),
            where("semenType", "==", type)
        );
        const snapStr = await getDocs(qStr);
        return !snapStr.empty;
    };

    // 1. PREVIEW HANDLER (Triggered by Form Submit)
    const handleSubmit = async (e) => { // Made Async
        e.preventDefault();

        // BASIC VALIDATION
        if (!formData.receiptNo) {
            alert("Receipt Number is missing.");
            return;
        }

        // DUPLICATE CHECK (Manual Mode Safety)
        if (isManualReceipt) {
            const exists = await checkIfReceiptExists(formData.receiptNo);
            if (exists) {
                alert(`⚠️ Error: Receipt #${formData.receiptNo} already exists in '${formData.semenType}' series! Please choose another.`);
                return; // BLOCK SAVE
            }
        }
        if (!formData.bullId) {
            alert("Please select a Bull.");
            return;
        }
        if (formData.tagNo.length < 8 && !isUntagged) {
            alert("Tag No must be at least 8 digits.");
            return;
        }

        // VALIDATE SEMEN TYPE (NEW)
        if (!formData.semenType) {
            alert("Please select Semen Type.");
            return;
        }

        // VALIDATE VILLAGE
        if (!formData.village || !formData.village.trim()) {
            alert("Village is COMPULSORY. Please select or add a village.");
            return;
        }

        // VALIDATE BREED (NEW)
        if (!formData.breed) {
            alert("Please select a Breed.");
            return;
        }

        // PREPARE DATA FOR PREVIEW
        const selectedBull = bulls.find(b => b.id === formData.bullId);

        setFormDataToSave({
            ...formData,
            bullName: selectedBull ? selectedBull.name : 'Unknown',
            bullType: selectedBull ? selectedBull.semenType : '',
            isUntagged: isUntagged
        });

        setShowPreview(true);
    };

    // 2. REAL SAVE WRAPPER (Triggered by Modal)
    const confirmSave = async () => {
        setIsSaving(true);
        await performSave(); // Calls the original logic
        setIsSaving(false);
        setShowPreview(false);
        setFormDataToSave(null);
    };

    // 3. CORE SAVE LOGIC (Renamed from handleSubmit)
    const performSave = async () => {
        // e.preventDefault(); REMOVED because this is not an event handler anymore

        let finalTagNo = formData.tagNo;

        // Validation & Virtual ID Logic
        if (isUntagged) {
            // Validate Name
            // Validate Name - UPDATED: No longer compulsory, auto-set if empty
            // if (!idDetails.name || !idDetails.name.trim()) {
            //    alert("Animal Name is COMPULSORY for untagged animals.");
            //    return;
            // }
            // Generate Virtual ID
            // If name is empty, defaults to "Untagged" (+ maybe random suffix if needed, but for now just Untagged)
            finalTagNo = idDetails.name && idDetails.name.trim() ? idDetails.name.trim() : "Untagged";
        } else {
            // Standard Validation
            if (formData.tagNo.length < 8 || formData.tagNo.length > 12) {
                alert("Tag No must be between 8 and 12 digits.");
                return;
            }
        }
        if (!formData.bullId) {
            alert("Please select a Bull.");
            return;
        }

        if (!formData.receiptNo) {
            alert("Receipt Number is missing.");
            return;
        }

        // Receipt Check
        if (!currentReceiptNo || currentReceiptNo === 'No Active Book') {
            // Allow manual override if they typed something, but warn if books are missing
            // If manual entry is allowed, we just proceed.
        }

        const selectedBull = bulls.find(b => b.id === formData.bullId);
        if (!selectedBull) {
            alert("Selected Bull not found!");
            return;
        }
        if (selectedBull.doses <= 0) {
            alert("Error: No doses left for this Bull.");
            return;
        }

        const entry = {
            // id: Date.now(), // REMOVED: Do not save numeric ID to Firestore. Use doc.id
            ...formData,
            date: formData.date, // Explicitly keep as string 'YYYY-MM-DD'
            tagNo: finalTagNo,
            receiptNo: parseInt(formData.receiptNo),
            bullName: selectedBull.name,
            status: 'A.I. Done',
            // METADATA FOR RBAC
            userId: currentUser?.uid,
            userName: currentUser?.displayName || currentUser?.name || 'Unknown',
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp() // For server-side sorting
        };

        try {
            if (isEditMode) {
                console.log("Starting Edit Save...");
                // UPDATE EXISTING
                const originalEntry = recentEntries.find(e => e.id === editingId);
                const entryRef = doc(db, "breeding", editingId);

                let updateData = {
                    ...formData,
                    tagNo: finalTagNo,
                    receiptNo: parseInt(formData.receiptNo),
                    bullName: selectedBull.name,
                    updatedAt: new Date().toISOString()
                };

                // STRICT RECEIPT & STOCK LOGIC
                if (originalEntry) {
                    const isTypeChanged = originalEntry.semenType !== formData.semenType;
                    const isBullChanged = originalEntry.bullId !== formData.bullId;

                    // 1. SEMEN TYPE CHANGED (Major Adjustment)
                    if (isTypeChanged) {
                        console.log(`Type Change Detected: ${originalEntry.semenType} -> ${formData.semenType}`);

                        // A. Restore OLD Receipt (Void it in stats)
                        await restoreReceipt(originalEntry.semenType, originalEntry.receiptNo);

                        // B. Consume NEW Receipt (Increment Counter)
                        // Note: formData.receiptNo is already the 'next' number because of the useEffect in DataEntry.
                        // But we must formally increment the book pointer so nobody else gets it.
                        await incrementReceipt(formData.semenType);

                        // C. Stock Adjustment
                        // Refund OLD Bull
                        if (originalEntry.bullId) await incrementBullDoses(originalEntry.bullId);
                        // Deduct NEW Bull
                        if (formData.bullId) await decrementBullDoses(formData.bullId);

                        // D. Audit History
                        const historyItem = {
                            date: new Date().toISOString(),
                            action: 'Type Change Update',
                            oldReceipt: originalEntry.receiptNo,
                            oldType: originalEntry.semenType,
                            newReceipt: formData.receiptNo,
                            newType: formData.semenType,
                            user: currentUser?.email
                        };
                        updateData.auditHistory = originalEntry.auditHistory ? [...originalEntry.auditHistory, historyItem] : [historyItem];
                    }
                    // 2. ONLY BULL CHANGED (Same Type)
                    else if (isBullChanged) {
                        console.log(`Bull Change Detected: ${originalEntry.bullName} -> ${selectedBull.name}`);
                        // Refund OLD Bull
                        if (originalEntry.bullId) await incrementBullDoses(originalEntry.bullId);
                        // Deduct NEW Bull (if different from old)
                        if (formData.bullId) await decrementBullDoses(formData.bullId);
                    }
                }

                await updateDoc(entryRef, updateData);

                // Update Local State with new data and potential history
                setRecentEntries(prev => prev.map(item =>
                    item.id === editingId ? { ...item, ...updateData, id: editingId } : item
                ));

                alert("Entry Updated Successfully!");
                setIsEditMode(false);
                setEditingId(null);

                // Don't show success popup for edit, just reset
                setFormData(prev => ({
                    ...prev,
                    ownerName: '',
                    mobileNumber: '',
                    tagNo: '',
                    bullId: ''
                }));
                if (isUntagged) setIdDetails({ name: '', color: ANIMAL_COLORS[0], mark: IDENTIFICATION_MARKS[0] });

            } else {
                console.log("Starting New Save...");
                // CREATE NEW
                // AUTO-NEGATIVE LOGIC For Repeat Breeding
                try {
                    console.log("Checking for previous entries...");
                    const qPrevious = query(
                        collection(db, "breeding"),
                        where('tagNo', '==', finalTagNo),
                        orderBy('date', 'desc'),
                        limit(1)
                    );
                    const prevSnap = await getDocs(qPrevious);

                    if (!prevSnap.empty) {
                        const prevDoc = prevSnap.docs[0];
                        const prevData = prevDoc.data();

                        // Calculate Date Difference
                        const newDate = new Date(formData.date);
                        const oldDate = new Date(prevData.date);
                        const diffTime = Math.abs(newDate - oldDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        // Rule: If > 7 Days, it's a Cycle Repeat -> Previous Failed (Negative)
                        if (diffDays > 7) {
                            console.log(`Auto-Updating Previous Entry (${prevDoc.id}) to Negative. Gap: ${diffDays} days.`);
                            await updateDoc(doc(db, "breeding", prevDoc.id), {
                                pd_result: 'Negative',
                                status: 'Empty', // Reset status ensuring it doesn't show as Pregnant
                                pd_date: serverTimestamp(),
                                pd_performed_by: 'System (Auto-Update)',
                                remarks: (prevData.remarks || '') + ' [Auto-updated: Repeat Breeding Performed]'
                            });
                        } else {
                            console.log(`Gap is ${diffDays} days (<= 7). Treating as Double Dose. No update.`);
                        }
                    }
                } catch (err) {
                    console.error("Auto-Negative Check Failed:", err);
                    // Continue saving new entry - do not block
                }

                // FIRESTORE SAVE
                console.log("Saving new entry to Firestore...", entry);
                const docRef = await addDoc(collection(db, "breeding"), entry);
                console.log("Entry saved with ID:", docRef.id);

                // Use the REAL Firestore ID for the local entry (replacing the temporary timestamp ID)
                const savedEntry = { ...entry, id: docRef.id };

                // Local state update for UI
                setRecentEntries(prev => [savedEntry, ...prev]);

                // Increment SPECIFIC type ONLY if NOT Manual Mode
                // If Manual Mode (filling a gap), we do NOT disrupt the global sequence.
                const usedReceipt = parseInt(String(formData.receiptNo).trim());
                const autoReceipt = parseInt(String(currentReceiptNo).trim());

                console.log(`Receipt Check: Used=${usedReceipt}, Auto=${autoReceipt}, Manual=${isManualReceipt}`);

                if (!isManualReceipt) {
                    if (!isNaN(usedReceipt) && !isNaN(autoReceipt) && usedReceipt >= autoReceipt) {
                        console.log("Incrementing Receipt Book...");
                        incrementReceipt(formData.semenType);
                    } else {
                        console.log(`Skipped increment: Used ${usedReceipt} < Auto ${autoReceipt}`);
                    }
                } else {
                    console.log("Manual Override: Skipping global increment.");
                }
                decrementBullDoses(formData.bullId);

                // SHOW POPUP INSTEAD OF ALERT
                setLastSavedEntry(savedEntry);
                setShowSuccessPopup(true);
            }
        } catch (error) {
            console.error("Error saving entry:", error);
            alert("Failed to save entry to database: " + error.message);
        }

        // We will reset the form AFTER the popup is closed, using handlePopupClose
    };

    const handlePopupClose = () => {
        setShowSuccessPopup(false);
        setLastSavedEntry(null);

        // Reset Manual Mode to prevent accidental overrides
        setIsManualReceipt(false);

        // Reset Form - Keep Date, Village, etc for fast entry, but clear animal specifics
        setFormData(prev => ({
            ...prev,
            ownerName: '',
            mobileNumber: '',
            tagNo: '',
            bullId: ''
            // Keep semenType as is for batch entries
        }));

        // Reset Untagged Details
        if (isUntagged) {
            setIdDetails({
                name: '',
                color: ANIMAL_COLORS[0],
                mark: IDENTIFICATION_MARKS[0]
            });
            // Keep isUntagged true if they are doing a batch of untagged? 
            // Usually simpler to reset or keep. Let's keep it to reduce clicks if they have multiple untagged.
        }
        setIsLocked(false);
        setLookupMessage('');
    };

    const handleDeleteEntry = async (entryId) => {
        const entryToDelete = recentEntries.find(e => e.id === entryId);
        if (!entryToDelete) return;

        if (window.confirm(`⚠️ PERMANENT DELETE WARNING ⚠️\n\nAre you sure you want to delete Receipt #${entryToDelete.receiptNo}?\n\nThis will remove it from the Database forever.`)) {
            try {
                // 1. Delete from Firestore (if it has a real string ID)
                if (typeof entryToDelete.id === 'string' && entryToDelete.id.length > 5) {
                    await deleteDoc(doc(db, "breeding", entryToDelete.id));
                }

                // 2. RESTORE RECEIPT LOGIC
                if (entryToDelete.semenType && entryToDelete.receiptNo) {
                    await restoreReceipt(entryToDelete.semenType, entryToDelete.receiptNo);
                }

                // 3. Update Local Stats
                setRecentEntries(prev => prev.filter(e => e.id !== entryId));
                if (entryToDelete.bullId) {
                    incrementBullDoses(entryToDelete.bullId);
                }
            } catch (error) {
                console.error("Error deleting:", error);
                alert("Failed to delete from database: " + error.message);
            }
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-1 md:p-8 pb-24 space-y-4 md:space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded shadow-md overflow-hidden">

                {/* Header / Receipt Info */}
                <div className="p-5 text-white flex justify-between items-center" style={{ backgroundColor: '#a855f7' }}>
                    <div className="header-title">
                        <h2 className="text-xl font-bold mb-1">New AI Entry</h2>
                        <span className="text-white/90 text-sm font-medium">{currentReceiptType || 'Select Type'} Semen</span>
                    </div>

                    {/* Checkbox for Manual Override */}
                    <div className="flex items-center gap-3">
                        {/* Pill Display if Auto */}
                        {!isManualReceipt && (
                            currentReceiptNo && currentReceiptNo !== 'No Active Book' ? (
                                <div className="flex flex-col items-center rounded-md border border-white/20 p-2 min-w-[100px]" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                    <label className="text-[11px] font-bold opacity-90 uppercase tracking-widest mb-1">Auto Receipt</label>
                                    <span className="text-white font-extrabold text-2xl">{formData.receiptNo}</span>
                                </div>
                            ) : (
                                <div className="bg-gray-800 px-3 py-1 rounded text-sm font-semibold border border-gray-600">
                                    No Active Book
                                </div>
                            )
                        )}

                        {/* Manual Input Group */}
                        {isManualReceipt && (
                            <div className="flex flex-col items-center rounded-md border border-yellow-400 p-2 min-w-[100px] bg-yellow-500/20">
                                <label className="text-[11px] font-bold opacity-90 uppercase tracking-widest mb-1 text-yellow-300">Manual No.</label>
                                <input
                                    type="number"
                                    name="receiptNo"
                                    value={formData.receiptNo}
                                    onChange={handleChange}
                                    className="w-24 bg-transparent text-white font-extrabold text-2xl text-center p-0 focus:outline-none placeholder-white/50 border-b-2 border-yellow-300"
                                    placeholder="#"
                                />
                            </div>
                        )}

                        {/* Toggle Switch / Checkbox */}
                        <label className="flex items-center cursor-pointer select-none text-white text-xs font-bold gap-2 ml-2 bg-black/20 px-2 py-1 rounded hover:bg-black/30 transition">
                            <input
                                type="checkbox"
                                checked={isManualReceipt}
                                onChange={(e) => setIsManualReceipt(e.target.checked)}
                                className="accent-yellow-400 w-4 h-4 cursor-pointer"
                            />
                            <span>Manual Override</span>
                        </label>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Tag No - Standard Input */}
                    <div className="bg-white p-0 rounded-none border-0">
                        {/* New Vertical Layout: Input First, Checkbox Below */}
                        <div className="flex gap-6 mb-6">

                            {/* 1. INPUT ROW (Full Width) */}
                            <div className="flex-grow flex-[2]">
                                <label className="block font-bold text-sm text-gray-800 mb-2">
                                    {isUntagged ? "Untagged Animal Details" : "Ear Tag Number"}
                                </label>
                                {!isUntagged ? (
                                    <div>
                                        <input
                                            type="number"
                                            name="tagNo"
                                            value={formData.tagNo}
                                            onChange={handleChange}
                                            className="w-full p-3 text-base border border-secondary-200 rounded-md text-black bg-white transition-colors focus:outline-none"
                                            style={{ transition: 'border-color 0.3s' }}
                                            onFocus={(e) => e.target.style.borderColor = '#a855f7'}
                                            onBlur={(e) => { handleTagBlur(); e.target.style.borderColor = '#e2e8f0'; }}
                                            placeholder="1234..."
                                        />
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-xs text-gray-500">8-12 Digits Required</span>
                                            {lookupMessage && <span className="text-sm font-bold text-primary-700 flex items-center gap-1">✓ {lookupMessage}</span>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm font-bold">
                                            ⚠️ No Tag Selected. Animal will be recorded as "Untagged".
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. CHECKBOX ROW (Below, right aligned or left) */}
                            <div className="flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isUntagged}
                                        onChange={(e) => {
                                            setIsUntagged(e.target.checked);
                                            if (e.target.checked) {
                                                setFormData(prev => ({ ...prev, tagNo: '' })); // Clear tag if switching to untagged
                                                setIsLocked(false);
                                                setLookupMessage('');
                                            }
                                        }}
                                        className="w-5 h-5 rounded focus:ring-0"
                                        style={{ accentColor: '#dc3545' }}
                                    />
                                    <span className="text-sm font-bold text-[#dc3545]">No Tag</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Date & Mobile Number Row */}
                    <div className="flex gap-6 mb-6">
                        <div className="flex-1">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    max={getTodayDate()}
                                    className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                                    onFocus={(e) => e.target.style.borderColor = '#a855f7'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Mobile Number</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold pointer-events-none">
                                    +91
                                </span>
                                <input
                                    type="tel"
                                    name="mobileNumber"
                                    value={formData.mobileNumber}
                                    onChange={handleChange}
                                    className="w-full pl-12 p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                                    onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    placeholder="9xxxxx"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Owner Name - Full Width */}
                    <div>
                        <label className="block font-bold text-sm text-gray-800 mb-2">Owner Name</label>
                        <input
                            type="text"
                            name="ownerName"
                            value={formData.ownerName}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                            onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            placeholder="Farmer Name"
                        />
                    </div>



                    {/* Village & Category Row */}
                    <div className="flex gap-2 mb-6">
                        <div className="flex-1">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Village <span className="text-red-500">*</span></label>
                            {!isAddingVillage ? (
                                <select
                                    name="village"
                                    value={formData.village}
                                    onChange={handleVillageChange}
                                    className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                                    onFocus={(e) => e.target.style.borderColor = '#a855f7'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                >
                                    <option value="">-- Select Village --</option>
                                    {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                    <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Village</option>
                                </select>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newVillageName}
                                        onChange={(e) => setNewVillageName(e.target.value)}
                                        className="w-full p-3 border border-secondary-200 rounded-md focus:outline-none"
                                        onFocus={(e) => e.target.style.borderColor = '#a855f7'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        placeholder="Enter Name"
                                        autoFocus
                                    />
                                    <button type="button" onClick={saveNewVillage} className="bg-primary-600 text-white px-4 rounded hover:bg-primary-700">✓</button>
                                </div>
                            )}
                        </div>
                        <div className="w-20 flex-none">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Category</label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                                onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {/* NEW VETAR FIELD */}
                        <div className="w-16 flex-none">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Vetar</label>
                            <input
                                type="text"
                                name="vetar"
                                value={formData.vetar}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits, numbers only
                                    setFormData(prev => ({ ...prev, vetar: val }));
                                }}
                                className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none text-center font-mono font-bold"
                                placeholder="00"
                                onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                    </div>

                    {/* Jati (Species) - Full Width (TOGGLE STYLE) */}
                    <div>
                        <label className="block font-bold text-sm text-gray-800 mb-2">Jati (Species)</label>
                        <div className="flex gap-4">
                            {SPECIES.map(s => (
                                <label key={s}
                                    className={`flex-1 border-2 rounded-lg p-3 flex items-center justify-center cursor-pointer transition-all duration-200 ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    style={{
                                        borderColor: formData.jati === s ? '#a855f7' : '#e2e8f0',
                                        backgroundColor: formData.jati === s ? '#a855f7' : 'white',
                                        color: formData.jati === s ? 'white' : '#6c757d',
                                        fontWeight: 700
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="jati"
                                        value={s}
                                        checked={formData.jati === s}
                                        onChange={handleJatiChange}
                                        className="hidden"
                                        disabled={isLocked}
                                    />
                                    <span>{s}</span>
                                </label>
                            ))}
                        </div>
                    </div>


                    {/* Breed & Semen Type */}
                    <div className="flex gap-6 mb-6">
                        <div className="flex-1">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Breed</label>
                            <div className="relative">
                                <select
                                    name="breed"
                                    value={formData.breed}
                                    onChange={handleBreedChange}
                                    disabled={isLocked}
                                    className={`w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                    onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                >
                                    <option value="">-- Select Breed --</option>
                                    {BREEDS[formData.jati].map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block font-bold text-sm text-gray-800 mb-2">Semen Type</label>
                            <select
                                name="semenType"
                                value={formData.semenType}
                                onChange={handleSemenTypeChange}
                                className={`w-full p-3 border rounded-md font-bold focus:outline-none ${formData.semenType === 'Sexed'
                                    ? 'border-pink-300 text-pink-700 bg-white focus:border-pink-500'
                                    : 'border-secondary-200 text-primary-900 bg-white'
                                    }`}
                                onFocus={(e) => formData.semenType !== 'Sexed' && (e.target.style.borderColor = '#a855f7')}
                                onBlur={(e) => formData.semenType !== 'Sexed' && (e.target.style.borderColor = '#e2e8f0')}
                            >
                                <option value="">-- Select Type --</option>
                                {SEMEN_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* LOCKED WARNING */}
                    {isLocked && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 text-orange-800 text-sm font-bold flex items-center shadow-sm">
                            <span className="mr-3 text-lg">🔒</span> Record Locked to match history.
                        </div>
                    )}

                    {/* Bull Selection (Vaprel Dose) */}
                    <div className={`p-4 rounded-lg border ${!formData.bullId
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-primary-500 bg-primary-50'
                        }`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-sm text-gray-700">Select Bull (Dose)</label>
                            <span className="bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">{filteredBulls.length} Available</span>
                        </div>

                        <select
                            name="bullId"
                            value={formData.bullId}
                            onChange={handleChange}
                            className="w-full p-3 border border-secondary-200 rounded-md text-black bg-white focus:outline-none"
                            onFocus={(e) => e.target.style.borderColor = '#154E5D'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        >
                            <option value="">-- Select Bull --</option>
                            {filteredBulls.map(bull => (
                                <option key={bull.id} value={bull.id}>
                                    {bull.name} — {bull.semenType} ({bull.doses || 0})
                                </option>
                            ))}
                        </select>
                        {filteredBulls.length === 0 && (
                            <p className="text-xs text-red-500 mt-2 font-medium">No bulls found matching selection.</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4 pt-2">
                        {isEditMode && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="w-1/3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 rounded-lg shadow-md transition transform active:scale-95"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            style={{ backgroundColor: isEditMode ? '#eab308' : '#a855f7' }}
                            className={`flex-1 font-bold text-lg py-4 rounded-lg shadow-md transition transform active:scale-95 text-white hover:opacity-90`}
                        >
                            {isEditMode ? 'Update Entry' : `Confirm Entry (#${formData.receiptNo ? formData.receiptNo : (currentReceiptNo || '?')})`}
                        </button>
                    </div>

                </div>

            </form >

            {/* Work Summary Section - Standard Table */}
            < div className="space-y-4" >
                <div className="bg-white p-3 rounded shadow border border-gray-300 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Last Entry (Modify Only)</h3>
                </div>

                {
                    recentEntries.length > 0 && (
                        <div className="bg-white rounded shadow border border-gray-300 overflow-hidden">
                            <div className="overflow-x-auto max-h-80">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-300">
                                        <tr>
                                            <th className="p-2 border-b">#</th>
                                            <th className="p-2 border-b">Date</th>
                                            <th className="p-2 border-b">Owner</th>
                                            <th className="p-2 border-b">Village</th>
                                            <th className="p-2 border-b">Bull</th>
                                            <th className="p-2 border-b">Tag</th>
                                            <th className="p-2 border-b">Current Status</th>
                                            <th className="p-2 border-b">Status</th>
                                            <th className="p-2 border-b">Vetar</th>
                                            <th className="p-2 border-b">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {recentEntries.slice(0, 1).map(entry => (
                                            <tr key={entry.id} className="hover:bg-gray-50">
                                                <td className="p-2 font-bold text-blue-600">{entry.receiptNo}</td>
                                                <td className="p-2 whitespace-nowrap">{entry.date}</td>
                                                <td className="p-2">{entry.ownerName}</td>
                                                <td className="p-2">{entry.village}</td>
                                                <td className="p-2 text-xs text-gray-500">{entry.bullName}</td>
                                                <td className="p-2 font-mono font-bold text-black">{entry.tagNo}</td>
                                                <td className="p-2">
                                                    {(() => {
                                                        // Logic: Positive, Negative, or Time-based Pending
                                                        if (entry.pd_result === 'Positive') {
                                                            return <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold border border-green-200">🟢 Pregnant</span>;
                                                        }
                                                        if (entry.pd_result === 'Negative') {
                                                            return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold border border-red-200">🔴 Empty</span>;
                                                        }

                                                        // Date Logic
                                                        const daysPassed = (new Date() - new Date(entry.date)) / (1000 * 60 * 60 * 24);
                                                        if (daysPassed > 285) {
                                                            return <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs font-bold border border-gray-200">⚪ Expired / Unknown</span>;
                                                        }
                                                        // Default Pending
                                                        return <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200">⏳ Pending</span>;
                                                    })()}
                                                </td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${entry.status === 'Calved' ? 'bg-purple-100 text-purple-800' :
                                                        entry.status === 'Pregnant (PD+)' ? 'bg-green-100 text-green-800' :
                                                            'bg-yellow-50 text-gray-700'
                                                        }`}>
                                                        {entry.status || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-2 font-bold text-gray-600 text-center">{entry.vetar || '-'}</td>
                                                <td className="p-2">
                                                    {/* DELETE OPTION REMOVED AS PER USER REQUEST */}
                                                    {/* 
                                                    <button
                                                        onClick={() => handleDeleteEntry(entry.id)}
                                                        className="text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded hover:bg-red-50 text-xs border border-red-200 mr-2"
                                                    >
                                                        Delete
                                                    </button>
                                                    */}
                                                    <button
                                                        onClick={() => handleEdit(entry)}
                                                        className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded hover:bg-blue-50 text-xs border border-blue-200"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }

                {/* View All Button */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={() => setActiveTab('breeding_report')}
                        className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-6 py-2 rounded-full font-bold transition-colors border border-blue-200"
                    >
                        <span>📂</span>
                        View Full Breeding Report
                    </button>
                </div>
            </div >

            {/* SUCCESS POPUP */}
            {
                showSuccessPopup && (
                    <SuccessPopup
                        entry={lastSavedEntry}
                        onClose={handlePopupClose}
                    />
                )
            }

            {/* PREGNANCY SAFETY POPUP */}
            {
                showPregnancyPopup && (
                    <PregnancySafetyPopup
                        existingEntry={conflictingEntry}
                        onCancel={handlePregnancyCancel}
                        onCorrection={handlePregnancyCorrection}
                    />

                )
            }

            {/* BLOCKING POPUP */}
            {
                showBlockingPopup && (
                    <div className="fixed inset-0 bg-red-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-t-8 border-red-600 animate-bounce-short">
                            <div className="text-center">
                                <div className="text-6xl mb-4">
                                    {blockingReason.includes("P.D. LIST") ? "🐄🚫" : "⛔"}
                                </div>

                                <h3 className="text-2xl font-black text-red-700 mb-2 uppercase">
                                    {blockingReason.includes("P.D. LIST") ? "P.D. POSITIVE ALERT" : "ACTION BLOCKED"}
                                </h3>

                                <p className="text-gray-800 font-bold text-lg mb-6 leading-relaxed">
                                    {blockingReason}
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            setShowBlockingPopup(false);
                                            setFormData(prev => ({ ...prev, tagNo: '' }));
                                        }}
                                        className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-xl shadow-lg transition"
                                    >
                                        OK, I Understand
                                    </button>

                                    {/* UNLOCK BUTTON */}
                                    <button
                                        onClick={() => setShowUnlockDialog(true)}
                                        className="w-full bg-transparent hover:bg-gray-100 text-gray-500 font-semibold py-2 rounded-lg border border-gray-300 text-xs transition"
                                    >
                                        Report Abortion / Reset Status
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* UNLOCK / ABORTION DIALOG */}
            {
                showUnlockDialog && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-scaleIn">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Update Animal Status</h3>

                            <label className="block text-sm font-bold text-gray-600 mb-2">Why are you unlocking this animal?</label>
                            <select
                                value={unlockReason}
                                onChange={(e) => setUnlockReason(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded mb-6 bg-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="Abortion / Miscarriage">Abortion / Miscarriage</option>
                                <option value="False Positive / Data Error">False Positive / Data Error</option>
                            </select>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowUnlockDialog(false)}
                                    className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUnlockConfirm}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                                >
                                    Confirm Update
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DUPLICATE WARNING POPUP */}
            {
                showDuplicateWarning && (
                    <div className="fixed inset-0 bg-yellow-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-yellow-500 animate-scaleIn">
                            <div className="text-center">
                                <div className="text-5xl mb-4">⚠️</div>
                                <h3 className="text-xl font-bold text-yellow-800 mb-2">Duplicate Entry Warning</h3>
                                <p className="text-gray-600 mb-4">
                                    An A.I. entry for Tag <strong>{duplicateEntry?.tagNo}</strong> is already recorded today ({duplicateEntry?.date}).
                                </p>

                                <div className="bg-yellow-50 p-3 rounded mb-6 text-left text-sm text-yellow-900 border border-yellow-200">
                                    <p><strong>Previous Entry:</strong> {duplicateEntry?.bullName} ({duplicateEntry?.semenType})</p>
                                    <p><strong>Owner:</strong> {duplicateEntry?.ownerName}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDuplicateWarning(false);
                                            setFormData(prev => ({ ...prev, tagNo: '' })); // Cancel
                                        }}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDuplicateWarning(false);
                                            // Proceed to Step 2 (force check ignoring duplicate)
                                            validateAnimalStatus(formData.tagNo, formData.date, true);
                                        }}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl shadow-lg transition"
                                    >
                                        Yes, Add Another
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* ================= PREVIEW MODAL ================= */}
            {
                showPreview && formDataToSave && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '400px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                        }}>
                            <h3 style={{ marginTop: 0, color: '#2c3e50', fontSize: '1.25rem', fontWeight: 'bold' }}>📝 Confirm Details</h3>
                            <hr style={{ border: '1px solid #eee', margin: '10px 0' }} />

                            <div style={{ lineHeight: '1.8', fontSize: '16px', color: '#333' }}>
                                <div><strong>Receipt No:</strong> <span className="text-purple-700 font-bold">{formDataToSave.receiptNo}</span></div>
                                <div><strong>Date:</strong> {formDataToSave.date}</div>
                                <div><strong>Tag No:</strong> {isUntagged ? "Untagged" : formDataToSave.tagNo}</div>
                                <div><strong>Farmer:</strong> {formDataToSave.ownerName}</div>
                                <div><strong>Village:</strong> {formDataToSave.village}</div>
                                <div><strong>Bull:</strong> {formDataToSave.bullName} ({formDataToSave.bullType})</div>
                                <div><strong>Species:</strong> {formDataToSave.jati} ({formDataToSave.breed})</div>
                            </div>

                            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    disabled={isSaving}
                                    style={{ flex: 1, padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    ❌ Edit / Cancel
                                </button>
                                <button
                                    onClick={confirmSave}
                                    disabled={isSaving}
                                    style={{ flex: 1, padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    {isSaving ? (
                                        <>
                                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                            Saving...
                                        </>
                                    ) : "✅ Confirm & Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DataEntry;

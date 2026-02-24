import { useState, useEffect } from 'react';
import { useMedicines } from '../context/MedicineContext';
import { useTreatments } from '../context/TreatmentContext';


import { useAuth } from '../context/AuthContext'; // NEW
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore'; // Import Firestore functions
import { db } from '../db'; // Import db

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const MedicineManagement = () => {
    const { currentUser } = useAuth(); // NEW
    const { medicines, addMedicine, updateMedicine, deleteMedicine } = useMedicines();
    const { primaryTreatments, shcTreatments } = useTreatments() || {};

    const [activeTab, setActiveTab] = useState('add_stock'); // 'add_stock' or 'report'

    // Edit Mode State
    const [editingId, setEditingId] = useState(null);

    // Dynamic Medicine Types
    const [medicineTypes, setMedicineTypes] = useState([]);

    // Report Filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState([]);
    const [inventoryList, setInventoryList] = useState([]); // NEW: For Inventory Tab

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0], // Default today
        name: '',
        type: 'Select',
        currentStock: '',
        packs: '',
        packSize: ''
    });

    const [showTypeManager, setShowTypeManager] = useState(false); // NEW
    const [newType, setNewType] = useState(''); // NEW

    // Fetch Medicine Types
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const docRef = doc(db, "settings", "medicine_lists");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().types) {
                    setMedicineTypes(docSnap.data().types);
                } else {
                    setMedicineTypes(['Powder', 'Tablet', 'Bolus', 'Injection', 'Other']);
                }
            } catch (error) {
                console.error("Error fetching medicine types:", error);
                setMedicineTypes(['Powder', 'Tablet', 'Bolus', 'Injection', 'Other']); // Fallback
            }
        };
        fetchTypes();
    }, []);

    // Calculate Report Data & Inventory Usage
    useEffect(() => {
        if (!medicines) return;

        // 1. Combine Treatments
        const allTreatments = [
            ...(primaryTreatments || []),
            ...(shcTreatments || [])
        ];

        // --- GLOBAL USAGE CALCULATION (For Inventory List) ---
        // Removed redeclaration and moved logic to end of effect
        // -----------------------------------------------------

        // 2. Filter by Month/Year (For Report Only)
        // const allTreatments = ... (Already declared above)

        // 2. Filter by Month/Year
        const filteredTreatments = allTreatments.filter(t => {
            if (!t.date && !t.timestamp) return false;
            const d = new Date(t.date || t.timestamp);
            return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
        });

        // 3. Calculate USAGE per medicine per MONTH
        // We need Usage in Selected Month AND Usage AFTER Selected Month to backtrack.

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const usageInMonth = {};
        const usageAfterMonth = {};

        allTreatments.forEach(t => {
            if (!t.date && !t.timestamp) return;
            const d = new Date(t.date || t.timestamp);

            if (t.medicinesUsed && Array.isArray(t.medicinesUsed)) {
                t.medicinesUsed.forEach(medItem => {
                    const qty = parseInt(medItem.quantity || 0);

                    // Check date range
                    if (d > endOfMonth) {
                        usageAfterMonth[medItem.id] = (usageAfterMonth[medItem.id] || 0) + qty;
                    } else if (d >= startOfMonth && d <= endOfMonth) {
                        usageInMonth[medItem.id] = (usageInMonth[medItem.id] || 0) + qty;
                    }
                });
            }
        });

        // 4. Build Rows with Backtracking Logic
        // Closing Stock (End of Month) = Current Stock + Usage(After Month)
        // Opening Stock (Start of Month) = Closing Stock + Usage(In Month)

        const rows = medicines.map(med => {
            const medDate = new Date(med.date);
            // Ignore medicines created AFTER the report month
            if (medDate > endOfMonth) return null;

            const usedAfter = usageAfterMonth[med.id] || 0;
            const usedIn = usageInMonth[med.id] || 0;

            const closingStock = parseInt(med.currentStock || 0) + usedAfter;
            // The logic: Stocks consumed after this month must have been present at the end of this month.

            // The opening stock logic:
            // Opening = Closing + UsedInMonth
            // This represents what was available at the start, assuming no re-stocks during the month.
            // (If re-stocks happened, this logic assumes they were present at start or effectively accounts for net availability).
            const openingStock = closingStock + usedIn;

            return {
                id: med.id,
                name: med.name,
                type: med.type,
                used: usedIn,
                current: closingStock, // Stock at end of month
                opening: openingStock, // Stock at start of month
                packs: med.packs,
                packSize: med.packSize
            };
        }).filter(Boolean); // Remove nulls

        setReportData(rows);

        // 5. Build Inventory List Data (Global Usage)
        // We do this here to avoid recalculating in render

        // Calculate Global Usage
        const globalUsageMap = {};
        allTreatments.forEach(t => {
            if (t.medicinesUsed && Array.isArray(t.medicinesUsed)) {
                t.medicinesUsed.forEach(medItem => {
                    const qty = parseInt(medItem.quantity || 0);
                    globalUsageMap[medItem.id] = (globalUsageMap[medItem.id] || 0) + qty;
                });
            }
        });

        const invList = medicines.map(med => {
            const used = globalUsageMap[med.id] || 0;
            const current = parseInt(med.currentStock || 0);
            return {
                ...med,
                usedTotal: used,
                addedTotal: current + used
            };
        });
        setInventoryList(invList);

    }, [medicines, primaryTreatments, shcTreatments, selectedMonth, selectedYear]);

    // Type Management Functions
    const handleAddType = async () => {
        if (!newType || !newType.trim()) return;
        const formatted = newType.trim();
        if (medicineTypes.includes(formatted)) {
            alert("Type already exists!");
            return;
        }

        try {
            const docRef = doc(db, "settings", "medicine_lists");
            // Ensure document exists, if not create it (rare but safe)
            // We use setDoc with merge for safety if it doesn't exist, or updateDoc if we know it exists.
            // unique arrayUnion
            await setDoc(docRef, { types: arrayUnion(formatted) }, { merge: true });

            setMedicineTypes(prev => [...prev, formatted]);
            setNewType('');
            alert("Type added successfully!");
        } catch (e) {
            console.error(e);
            alert("Error adding type: " + e.message);
        }
    };

    const handleDeleteType = async (typeToDelete) => {
        if (!window.confirm(`Delete type "${typeToDelete}"? Note: Existing medicines with this type will keep it, but it won't be selectable for new entries.`)) return;

        try {
            const docRef = doc(db, "settings", "medicine_lists");
            await updateDoc(docRef, { types: arrayRemove(typeToDelete) });

            setMedicineTypes(prev => prev.filter(t => t !== typeToDelete));
        } catch (e) {
            console.error(e);
            alert("Error deleting type: " + e.message);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        let newFormData = { ...formData, [name]: value };

        // Auto-calculate Total if changing Packs or PackSize
        if (name === 'packs' || name === 'packSize') {
            const p = name === 'packs' ? value : formData.packs;
            const ps = name === 'packSize' ? value : formData.packSize;

            // Calculate only if both are present and valid numbers
            if (p && ps) {
                newFormData.currentStock = (parseFloat(p) * parseFloat(ps)).toString();
            } else {
                newFormData.currentStock = '';
            }
        }

        setFormData(newFormData);
    };

    const handleEdit = (med) => {
        setEditingId(med.id);
        setFormData({
            date: med.date || new Date().toISOString().split('T')[0],
            name: med.name,
            type: med.type,
            batchNo: med.batchNo || '',
            mfgDate: med.mfgDate ? med.mfgDate.substring(0, 7) : '',
            expDate: med.expDate ? med.expDate.substring(0, 7) : '',
            currentStock: med.currentStock,
            packs: med.packs || '',
            packSize: med.packSize || ''
        });
        setActiveTab('add_stock'); // Switch to form if not already
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            name: '',
            type: 'Select',
            batchNo: '',
            mfgDate: '',
            expDate: '',
            currentStock: '',
            packs: '',
            packSize: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.currentStock || formData.type === 'Select') {
            alert("Please fill all fields and select a valid type.");
            return;
        }

        const action = editingId ? "update" : "add";
        if (!window.confirm(`Are you sure you want to ${action} this medicine?`)) {
            return;
        }

        const dataPayload = {
            date: formData.date,
            name: formData.name,
            type: formData.type,
            batchNo: formData.batchNo,
            mfgDate: formData.mfgDate,
            expDate: formData.expDate,
            currentStock: parseInt(formData.currentStock),
            packSize: parseInt(formData.packSize) || 0,
            packs: parseInt(formData.packs) || 0
        };

        if (editingId) {
            await updateMedicine(editingId, dataPayload);
            alert("Medicine updated!");
        } else {
            addMedicine(dataPayload);
            alert("Medicine added!");
        }

        handleCancelEdit(); // Reset form
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-3 md:p-8 space-y-6 pb-24">

            {/* Header / Tabs */}
            <div className="flex gap-4 border-b border-gray-300 pb-2">
                <button
                    onClick={() => setActiveTab('add_stock')}
                    className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeTab === 'add_stock' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    + Add Stock
                </button>
                <button
                    onClick={() => setActiveTab('report')}
                    className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeTab === 'report' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    📊 Monthly Stock Report
                </button>
            </div>

            {/* ADD STOCK SECTION */}
            {activeTab === 'add_stock' && (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>💊</span> {editingId ? "Update Medicine" : "Add Medicine to Stock"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Date Selection */}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Entry Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Medicine Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                        placeholder="e.g. Melonex"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    >
                                        <option value="Select" disabled>Select</option>
                                        {medicineTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {currentUser?.role === 'Admin' && (
                                        <button
                                            type="button"
                                            onClick={() => setShowTypeManager(true)}
                                            className="text-xs text-blue-600 font-bold mt-1 hover:underline flex items-center gap-1"
                                        >
                                            ⚙️ Manage Types
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* New Fields: Batch, Mfg, Exp */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Batch No</label>
                                    <input
                                        type="text"
                                        name="batchNo"
                                        value={formData.batchNo}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                        placeholder="e.g. B-123"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mfg Date (Month/Year)</label>
                                    <input
                                        type="month"
                                        name="mfgDate"
                                        value={formData.mfgDate}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Exp Date (Month/Year)</label>
                                    <input
                                        type="month"
                                        name="expDate"
                                        value={formData.expDate}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 3-Box Calculator */}
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Calculator</label>
                            <div className="flex items-center gap-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Packs / Bottles</label>
                                    <input
                                        type="number"
                                        name="packs"
                                        value={formData.packs}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>

                                <div className="text-gray-400 font-bold text-xl pt-4">X</div>

                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Qty per Pack (ml/gm)</label>
                                    <input
                                        type="number"
                                        name="packSize"
                                        value={formData.packSize}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>

                                <div className="text-gray-400 font-bold text-xl pt-4">=</div>

                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Total Quantity</label>
                                    <input
                                        type="number"
                                        name="currentStock"
                                        value={formData.currentStock}
                                        readOnly
                                        className="w-full p-2 border border-gray-300 rounded text-center bg-gray-100 font-bold text-teal-600 focus:outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    className={`flex-1 font-bold py-3 rounded-xl shadow transition text-white ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                                >
                                    {editingId ? "Update Medicine" : "+ Add to Inventory"}
                                </button>

                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-6 py-3 bg-gray-500 text-white font-bold rounded-xl shadow hover:bg-gray-600 transition"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Simple List */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Current Inventory List</h3>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 text-gray-600 uppercase font-bold sticky top-0">
                                    <tr>
                                        <th className="p-3">Medicine Name</th>
                                        <th className="p-3">Batch / Exp</th>
                                        <th className="p-3 text-right bg-blue-50">Added Stock</th>
                                        <th className="p-3 text-right bg-red-50">Used Stock</th>
                                        <th className="p-3 text-right bg-green-50">Current Stock</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {inventoryList.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-4 text-center text-gray-500 font-medium">
                                                No medicines in stock. Add one above!
                                            </td>
                                        </tr>
                                    ) : (
                                        inventoryList.map(med => (
                                            <tr key={med.id} className={`hover:bg-gray-50 ${editingId === med.id ? 'bg-blue-50' : ''}`}>
                                                <td className="p-3 font-medium text-gray-800">
                                                    <div>{med.name}</div>
                                                    <div className="text-xs text-gray-500">{med.type}</div>
                                                </td>
                                                <td className="p-3 text-gray-600 text-xs">
                                                    {med.batchNo && <div><span className="font-bold">Batch:</span> {med.batchNo}</div>}
                                                    {med.mfgDate && <div><span className="font-bold">Mfg:</span> {med.mfgDate}</div>}
                                                    {med.expDate && <div><span className="font-bold">Exp:</span> {med.expDate}</div>}
                                                    {!med.batchNo && !med.mfgDate && !med.expDate && <span className="text-gray-300">-</span>}
                                                </td>

                                                {/* Added Stock */}
                                                <td className="p-3 text-right font-mono font-bold text-blue-600 bg-blue-50/30">
                                                    {med.addedTotal}
                                                </td>

                                                {/* Used Stock */}
                                                <td className="p-3 text-right font-mono font-bold text-red-600 bg-red-50/30">
                                                    {med.usedTotal}
                                                </td>

                                                {/* Current Stock */}
                                                <td className={`p-3 text-right font-bold bg-green-50/30 ${med.currentStock < 5 ? 'text-red-500' : 'text-teal-600'}`}>
                                                    {med.packs && med.packSize ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-lg">{med.currentStock}</span>
                                                            <span className="text-xs text-gray-400 font-normal">
                                                                ({med.packs} x {med.packSize} = {med.currentStock})
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        med.currentStock
                                                    )}
                                                </td>

                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleEdit(med)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full transition" title="Edit">
                                                        ✏️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* REPORT SECTION */}
            {activeTab === 'report' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-blue-50 p-4 border-b border-blue-200 flex flex-wrap gap-4 items-center justify-between">
                        <h3 className="font-bold text-blue-800 text-lg">💊 Monthly Medicine Stock Report</h3>

                        <div className="flex gap-2">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="p-2 border border-blue-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="p-2 border border-blue-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-blue-100 text-blue-900 border-b border-blue-200 sticky top-0">
                                <tr>
                                    <th className="p-3 border-r border-blue-200 w-16 text-center">Sr. No</th>
                                    <th className="p-3 border-r border-blue-200">Medicine Name</th>
                                    <th className="p-3 border-r border-blue-200 text-right bg-yellow-50">Opening Stock</th>
                                    <th className="p-3 border-r border-blue-200 text-right bg-red-50">Used Medicine</th>
                                    <th className="p-3 text-right bg-green-50">Stock Medicine</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-400">No medicines found in inventory.</td>
                                    </tr>
                                ) : (
                                    reportData.map((row, index) => (
                                        <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="p-3 border-r border-gray-100 text-center text-gray-500">{index + 1}</td>
                                            <td className="p-3 border-r border-gray-100 font-medium text-gray-800">
                                                {row.name} <span className="text-xs text-gray-400 ml-1">({row.type})</span>
                                            </td>
                                            <td className="p-3 border-r border-gray-100 text-right font-mono bg-yellow-50/30 font-bold text-yellow-700">
                                                {row.packs && row.packSize ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg">{row.opening}</span>
                                                        <span className="text-xs text-gray-500 font-normal">
                                                            ({row.packs} x {row.packSize} = {row.opening})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    row.opening
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-gray-100 text-right font-mono bg-red-50/30 font-bold text-red-600">
                                                {row.used > 0 ? row.used : '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono bg-green-50/30 font-bold text-teal-700">
                                                {row.current}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Type Manager Modal */}
            {showTypeManager && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Manage Medicine Types</h3>
                            <button onClick={() => setShowTypeManager(false)} className="text-white/80 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6">

                            {/* Add New */}
                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value)}
                                    placeholder="New Type (e.g. Syrup)"
                                    className="flex-1 p-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleAddType}
                                    className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50"
                                    disabled={!newType.trim()}
                                >
                                    Add
                                </button>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Existing Types</h4>
                                {medicineTypes.map(t => (
                                    <div key={t} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100 group hover:bg-white hover:shadow-sm transition">
                                        <span className="font-medium text-gray-800">{t}</span>
                                        <button
                                            onClick={() => handleDeleteType(t)}
                                            className="text-red-400 hover:text-red-600 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Type"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MedicineManagement;

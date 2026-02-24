import { useState, useEffect } from 'react';
import { db } from '../db';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const CalvingList = () => {
    const { currentUser } = useAuth();
    const [allEntries, setAllEntries] = useState([]); // Store all Pregnant(PD+)
    const [filteredEntries, setFilteredEntries] = useState([]); // What we show
    const [loading, setLoading] = useState(true);

    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterMode, setFilterMode] = useState('ALL'); // Default to ALL to see upcoming

    const loadEntries = async () => {
        setLoading(true);
        try {

            let q;
            const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase() === 'ggp305ggp@gmail.com';

            if (isAdmin) {
                q = collection(db, "breeding");
            } else {
                q = query(collection(db, "breeding"), where('userId', '==', currentUser.uid));
            }

            const querySnapshot = await getDocs(q);
            const entries = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const today = new Date();

            // PRE-PROCESS: Just get all Confirmed Pregnant animals & Calc Dates
            const processed = entries.filter(entry => {
                // STRICT FILTER: Check for 'Pregnant' or 'Pregnant (PD+)'
                return entry.status === 'Pregnant (PD+)' || entry.status === 'Pregnant';
            }).map(entry => {
                const entryDate = new Date(entry.date);
                if (isNaN(entryDate.getTime())) return null; // Skip invalid dates

                const diffTime = today - entryDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const isBuffalo = entry.jati === 'Buffalo';
                // User Requirement: Cow 280, Buffalo 310
                const gestationDays = isBuffalo ? 310 : 280;
                const limit = gestationDays;

                const expectedDate = new Date(entryDate);
                expectedDate.setDate(expectedDate.getDate() + gestationDays);

                let expectedDateString = '';
                try {
                    expectedDateString = expectedDate.toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }

                return {
                    ...entry,
                    diffDays,
                    expectedDate: expectedDateString,
                    isOverdue: diffDays >= limit
                };
            }).filter(entry => entry !== null); // Filter out skipped

            setAllEntries(processed);

        } catch (error) {
            console.error("Error fetching Calving list:", error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEntries();
    }, []);

    // FILTER LOGIC
    useEffect(() => {
        let result = allEntries;

        if (startDate || endDate) {
            // DATE MODE: Show by Expected Date
            if (startDate) {
                result = result.filter(item => item.expectedDate >= startDate);
            }
            if (endDate) {
                result = result.filter(item => item.expectedDate <= endDate);
            }
            // Sort by Date (Sooner first)
            result.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
        } else {
            // DEFAULT MODE: Check Filter Mode
            if (filterMode === 'OVERDUE') {
                result = result.filter(item => item.isOverdue);
                // Sort by Overdue Days (Most overdue first)
                result.sort((a, b) => b.diffDays - a.diffDays);
            } else if (filterMode === 'APPROACHING') {
                // NEW: > 270 Days
                result = result.filter(item => item.diffDays >= 270);
                // Sort by Days (Highest first = closest to delivery/overdue)
                result.sort((a, b) => b.diffDays - a.diffDays);
            } else {
                // SHOW ALL (Upcoming + Overdue)
                // Sort by expected date (soonest first)
                result.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
            }
        }

        setFilteredEntries(result);
    }, [allEntries, startDate, endDate, filterMode]);

    // ... (keep markDelivered as is)
    // ...

    const markDelivered = async (entry, gender) => {
        const genderText = gender === 'M' ? 'Male' : 'Female';
        const tagNo = entry.tagNo;

        console.log("MARK DELIVERED ACTION:", { tag: tagNo, gender: genderText });

        try {
            const qTag = query(collection(db, "breeding"), where('tagNo', '==', tagNo));
            const snapTag = await getDocs(qTag);

            if (snapTag.empty) return;

            const updates = snapTag.docs.map(async (docSnapshot) => {
                const docRef = doc(db, "breeding", docSnapshot.id);
                const existingData = docSnapshot.data();
                const currentNotes = existingData.notes ? String(existingData.notes) : '';
                const newNotes = `${currentNotes} [Delivered: ${genderText} - Marked from Calving List]`;

                return updateDoc(docRef, {
                    status: 'Empty', // Back to cycle
                    calfGender: genderText,
                    notes: newNotes,
                    lastCalvingDate: new Date().toISOString().split('T')[0],
                    updatedAt: new Date().toISOString()
                });
            });

            await Promise.all(updates);

            const mainDocId = String(entry.id);
            await addDoc(collection(db, "calving"), {
                breedingId: mainDocId,
                tagNo: tagNo || 'Unknown',
                ownerName: entry.ownerName || 'Unknown',
                village: entry.village || '',
                mobileNumber: entry.mobileNumber || '',
                calvingDate: new Date().toISOString().split('T')[0],
                gender: genderText,
                motherJati: entry.jati || '',
                userId: entry.userId || '',
                createdAt: new Date().toISOString()
            });

            // Optimistic Update
            setAllEntries(prev => prev.filter(item => item.tagNo !== tagNo));

            alert(`Success! Marked ${tagNo} as Delivered.`);
            loadEntries();

        } catch (error) {
            console.error("Error updating status:", error);
            alert(`Failed: ${error.message}`);
        }
    };

    // EXPORT FUNCTIONS
    const downloadExcel = async () => {
        const XLSX = (await import('xlsx'));
        const data = filteredEntries.map(e => ({
            "Tag No": e.tagNo,
            "Owner": e.ownerName,
            "Village": e.village,
            "Mobile": e.mobileNumber,
            "Expected Date": e.expectedDate,
            "Days Left": e.isOverdue ? `Overdue (${e.diffDays})` : `${e.diffDays} Days Left`,
            "Status": e.isOverdue ? "OVERDUE" : "Pregnant"
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Calving Due List");
        XLSX.writeFile(wb, `Calving_Due_List_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    const downloadPDF = async () => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Calving Due List", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

        const tableColumn = ["Tag No", "Owner", "Village", "Mobile", "Expected", "Status"];
        const tableRows = filteredEntries.map(e => [
            e.tagNo,
            e.ownerName,
            e.village,
            e.mobileNumber,
            e.expectedDate ? e.expectedDate.split('-').reverse().join('/') : '-',
            e.isOverdue ? `OVERDUE (+${e.diffDays}d)` : `${e.diffDays}d Left`
        ]);

        autoTable(doc, {
            startY: 40,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [76, 175, 80] } // Green
        });

        doc.save(`Calving_Due_List.pdf`);
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading Calving Data...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-24 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-500 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-3xl">👶</span> Calving Due List
                        </h2>
                        <p className="text-gray-600 text-sm">
                            {startDate || endDate
                                ? "Showing Expected Calvings in range"
                                : (filterMode === 'OVERDUE' ? "Showing Animals Overdue for Delivery" :
                                    filterMode === 'APPROACHING' ? "Showing Animals &gt; 270 Days (Approaching Delivery)" :
                                        "Showing All Expecting Animals")}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={downloadExcel}
                            disabled={filteredEntries.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold shadow disabled:opacity-50"
                        >
                            Excel
                        </button>
                        <button
                            onClick={downloadPDF}
                            disabled={filteredEntries.length === 0}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-bold shadow disabled:opacity-50"
                        >
                            PDF
                        </button>
                        <span className="bg-green-100 text-green-800 py-1 px-3 rounded-full font-bold">
                            {filteredEntries.length} Animals
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                        <div className="p-2 font-bold text-gray-500">
                            {startDate || endDate ? "📅 Custom Schedule" : (
                                <select
                                    className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 cursor-pointer"
                                    value={filterMode}
                                    onChange={(e) => setFilterMode(e.target.value)}
                                >
                                    <option value="ALL">📋 Show All Promoting</option>
                                    <option value="APPROACHING">🤰 Approaching (&gt; 270 Days)</option>
                                    <option value="OVERDUE">⚠️ Overdue Only</option>
                                </select>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Expected From</label>
                        <input
                            type="date"
                            className="border p-2 rounded-lg w-full md:w-auto"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Expected To</label>
                        <input
                            type="date"
                            className="border p-2 rounded-lg w-full md:w-auto"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <div className="flex items-end">
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-red-500 font-bold text-sm bg-white border border-red-200 px-3 py-2.5 rounded-lg hover:bg-red-50"
                            >
                                Reset
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {filteredEntries.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow-sm">
                    <p className="text-5xl mb-2">🎉</p>
                    <p>No calving records found for this criteria!</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-green-50 text-green-800 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 border-b">Tag / Days</th>
                                    <th className="p-4 border-b">Details</th>
                                    <th className="p-4 border-b">Est. Date</th>
                                    <th className="p-4 border-b text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-green-50 transition">
                                        <td className="p-4 align-top">
                                            <div className="font-mono font-bold text-lg">{entry.tagNo}</div>
                                            <span className={`font-bold py-0.5 px-2 rounded text-xs mt-1 inline-block ${entry.isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {entry.isOverdue ? `Overdue: ${entry.diffDays}d` : `Preg: ${entry.diffDays}d`}
                                            </span>
                                            <div className="text-xs font-bold uppercase text-gray-500 mt-1">{entry.jati}</div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="font-bold text-gray-800">{entry.ownerName}</div>
                                            <div className="text-xs text-gray-500">{entry.village}</div>
                                        </td>
                                        <td className="p-4 font-bold text-teal-700 align-top">
                                            {entry.expectedDate.split('-').reverse().join('/')}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => markDelivered(entry, 'M')}
                                                    className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-200 border py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition"
                                                >
                                                    <span className="text-lg">♂️</span> Male
                                                </button>
                                                <button
                                                    onClick={() => markDelivered(entry, 'F')}
                                                    className="w-full bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-200 border py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition"
                                                >
                                                    <span className="text-lg">♀️</span> Female
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalvingList;

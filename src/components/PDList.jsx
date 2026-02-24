import { useState, useEffect } from 'react';
import { db } from '../db';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const PDList = () => {
    const { currentUser } = useAuth();
    const [allEntries, setAllEntries] = useState([]); // Store all relevant pending entries
    const [filteredEntries, setFilteredEntries] = useState([]); // What we show
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterMode, setFilterMode] = useState('OVERDUE'); // Default back to OVERDUE

    // Diagnostics
    const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

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
                ...doc.data(),
                id: doc.id
            }));

            const today = new Date();

            // PRE-PROCESS: Calculate Due Dates for logic
            const processed = entries.map(entry => {
                if (!entry.date) return null; // Skip if no date
                const entryDate = new Date(entry.date);
                if (isNaN(entryDate.getTime())) return null; // Skip if invalid date format

                const diffTime = today - entryDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Calculate PD Due Date (75 days after AI)
                const dueDate = new Date(entryDate);
                dueDate.setDate(dueDate.getDate() + 75);

                let dueDateString = '';
                try {
                    dueDateString = dueDate.toISOString().split('T')[0];
                } catch (e) {
                    return null; // Safety catch
                }

                return { ...entry, diffDays, dueDateString, dueDateObj: dueDate };
            }).filter(entry => entry !== null).filter(entry => {
                // BASIC VALIDATION RULES (Always Apply)
                if (entry.pd_result) return false; // Already checked
                // Relaxed Filter: Show all that haven't been checked, regardless of status tag
                // if (entry.status && entry.status !== 'Pregnant' && entry.status !== undefined) return false; 
                return true;
            });

            // count stats
            const total = entries.length;
            const completed = entries.filter(e => e.pd_result).length;
            const pending = processed.length;
            setStats({ total, completed, pending });

            console.log(`[PDList] Total: ${total}, Completed: ${completed}, Pending (Loaded): ${pending}`);

            // Store raw list
            setAllEntries(processed);

            setAllEntries(processed);

            if (processed.length === 0 && entries.length === 0) {
                // Debug: Warn if genuinely empty
                // console.warn("No entries found in DB for this user.");
            }

        } catch (error) {
            console.error("Error fetching PD list:", error);
            alert("Error loading PD data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEntries();
    }, []);

    // FILTER LOGIC: Re-run whenever filters or data change
    useEffect(() => {
        let result = allEntries;

        // 1. apply Date Range OR Default Rule
        if (startDate || endDate) {
            // DATE RANGE MODE: Show everything due in this range (Future or Past)
            if (startDate) {
                result = result.filter(item => item.dueDateString >= startDate);
            }
            if (endDate) {
                result = result.filter(item => item.dueDateString <= endDate);
            }
        } else {

            // DEFAULT MODE: Check Filter Mode
            if (filterMode === 'OVERDUE') {
                result = result.filter(item => item.diffDays >= 75);
            }
            // If 'ALL', show all pending (result is already filterd by status/pd_result in loadEntries)
        }

        // Sort: If filtering by date, sort by DueDate. If Default, sort by Overdue Days.
        if (startDate || endDate) {
            result.sort((a, b) => new Date(a.dueDateString) - new Date(b.dueDateString)); // Ascending Date
        } else {
            result.sort((a, b) => b.diffDays - a.diffDays); // Descending Overdue
        }

        setFilteredEntries(result);
    }, [allEntries, startDate, endDate]);

    const handlePDResult = async (entry, result) => {
        const recordId = entry.id;
        if (!currentUser) return alert("Login required.");

        try {
            setProcessingId(recordId);
            const docRef = doc(db, 'breeding', recordId);

            await updateDoc(docRef, {
                pd_result: result,
                pd_date: serverTimestamp(),
                pd_updated_by: currentUser.uid,
                status: result === 'Positive' ? 'Pregnant (PD+)' : 'Empty'
            });

            // Remove from local list immediately
            setAllEntries(prev => prev.filter(item => item.id !== recordId));

            alert(`Status updated to ${result}`);
        } catch (error) {
            console.error("FAILED to save P.D. result:", error);
            alert("Error: Database did not save.");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading P.D. Data...</div>;

    if (loading) return <div className="p-10 text-center text-gray-500">Loading P.D. Data...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-24 space-y-6">

            {/* DEBUG / DIAGNOSTIC BAR */}
            <div className="flex gap-4 text-xs text-gray-400 justify-center">
                <span>Total AI Records: {stats.total}</span>
                <span>•</span>
                <span>PD Completed: {stats.completed}</span>
                <span>•</span>
                <span>Pending PD: {stats.pending}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-orange-500 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-3xl">⏰</span> P.D. List
                        </h2>
                        <p className="text-gray-600 text-sm">
                            {startDate || endDate
                                ? "Showing scheduled checks in range"
                                : (filterMode === 'OVERDUE' ? "Showing pending Overdue (>75 days)" : "Showing ALL pending checks")}
                        </p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 py-1 px-3 rounded-full font-bold">
                        {filteredEntries.length} Animals
                    </span>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                        <div className="p-2 font-bold text-gray-500">
                            {startDate || endDate ? "📅 Custom Schedule" : (
                                <select
                                    className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 cursor-pointer"
                                    value={filterMode}
                                    onChange={(e) => setFilterMode(e.target.value)}
                                >
                                    <option value="OVERDUE">⚠️ Overdue Only ({">"}75 days)</option>
                                    <option value="ALL">📋 Show All Pending</option>
                                </select>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Due From</label>
                        <input
                            type="date"
                            className="border p-2 rounded-lg w-full md:w-auto"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Due To</label>
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
                    <p className="text-5xl mb-2">✅</p>
                    <p>No P.D. animals found for this criteria.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[900px]">
                            <thead className="bg-gray-100 border border-gray-300">
                                <tr className="text-xs font-semibold uppercase text-gray-700">
                                    <th className="px-2 py-1 text-center border">Tag No</th>
                                    <th className="px-2 py-1 text-center border">Status</th>
                                    <th className="px-2 py-1 text-left border">Owner Name</th>
                                    <th className="px-2 py-1 text-center border">Mobile</th>
                                    <th className="px-2 py-1 text-center border">Village</th>
                                    <th className="px-2 py-1 text-center border">Bull</th>
                                    <th className="px-2 py-1 text-center border">AI Date</th>
                                    <th className="px-2 py-1 text-center border">Due Date</th>
                                    <th className="px-2 py-1 text-center border">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className="even:bg-gray-50 hover:bg-gray-100 transition">
                                        <td className="px-2 py-1 text-center border font-mono text-gray-800">{entry.tagNo}</td>
                                        <td className="px-2 py-1 text-center border">
                                            <div className="text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-tighter">
                                                {entry.status || 'Unknown'}
                                            </div>
                                            <span className={`font-bold px-1 rounded text-[10px] ${entry.diffDays >= 75 ? 'text-red-600' : 'text-blue-600'}`}>
                                                {entry.diffDays >= 75 ? `Late (${entry.diffDays}d)` : `Wait (${entry.diffDays}d)`}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1 border font-medium text-gray-800">{entry.ownerName}</td>
                                        <td className="px-2 py-1 text-center border font-mono text-gray-600">{entry.mobileNumber || '-'}</td>
                                        <td className="px-2 py-1 text-center border text-gray-600">{entry.village}</td>
                                        <td className="px-2 py-1 text-center border text-gray-600 text-xs">{entry.bullName}</td>
                                        <td className="px-2 py-1 text-center border text-gray-600">{entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '-'}</td>
                                        <td className="px-2 py-1 text-center border font-bold text-orange-700">
                                            {entry.dueDateObj ? entry.dueDateObj.toLocaleDateString('en-GB') : '-'}
                                        </td>
                                        <td className="px-2 py-1 text-center border">
                                            {processingId === entry.id ? (
                                                <span className="text-xs text-orange-500 animate-pulse">Saving...</span>
                                            ) : (
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => handlePDResult(entry, 'Positive')}
                                                        disabled={processingId !== null}
                                                        className="bg-green-100 hover:bg-green-200 text-green-800 border border-green-200 px-2 py-0.5 rounded textxs font-bold transition"
                                                        title="Mark Positive"
                                                    >
                                                        ✅
                                                    </button>
                                                    <button
                                                        onClick={() => handlePDResult(entry, 'Negative')}
                                                        disabled={processingId !== null}
                                                        className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded text-xs font-bold transition"
                                                        title="Mark Negative"
                                                    >
                                                        ❌
                                                    </button>
                                                </div>
                                            )}
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

export default PDList;

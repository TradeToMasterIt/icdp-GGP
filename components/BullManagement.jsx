import { useState, useEffect } from 'react';
import { useBulls } from '../context/BullContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const SPECIES = ['Cow', 'Buffalo'];
const BREEDS = {
    Cow: ['GIR', 'H.F', 'KANKREJ', 'N.D.'],
    Buffalo: ['MEHASANI', 'SURTI', 'MURRAH', 'JAFARABADI', 'BANNI', 'N.D. BUFFALO']
};
const SEMEN_TYPES = ['Conventional', 'Sexed'];

const BullManagement = () => {
    const { bulls, addBull, discardStock, deleteBull, updateBull } = useBulls();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('receive');
    const [stats, setStats] = useState({});
    const [editingId, setEditingId] = useState(null);

    // FILTER STATE
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const getMonthName = (monthIndex) => {
        return new Date(2000, monthIndex, 1).toLocaleString('default', { month: 'long' });
    };

    // Fetch Usage and Discard Stats (RAW DATA)
    useEffect(() => {
        if (!currentUser) return;

        // 1. Listen to Breeding Records for Usage
        const qBreeding = query(collection(db, 'breeding'), where('userId', '==', currentUser.uid));
        const unsubscribeBreeding = onSnapshot(qBreeding, (snapshot) => {
            const usageData = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.bullId) {
                    usageData.push({
                        bullId: data.bullId,
                        date: data.date // Ensure date exists
                    });
                }
            });

            setStats(prev => ({
                ...prev,
                usage: usageData
            }));
        });

        // 2. Listen to Debit Transactions for Discard
        const qDebits = query(
            collection(db, 'users', currentUser.uid, 'bulls'),
            where('transactionType', '==', 'DEBIT')
        );
        const unsubscribeDebits = onSnapshot(qDebits, (snapshot) => {
            const discardData = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.bullId) {
                    discardData.push({
                        bullId: data.bullId,
                        date: data.date,
                        quantity: parseInt(data.quantity) || 0
                    });
                }
            });

            setStats(prev => ({
                ...prev,
                discard: discardData
            }));
        });

        return () => {
            unsubscribeBreeding();
            unsubscribeDebits();
        };
    }, [currentUser]);

    // RECEIVE FORM STATE (Credit)
    const [receiveData, setReceiveData] = useState({
        date: new Date().toISOString().split('T')[0],
        jati: 'Cow',
        breed: 'GIR',
        semenType: 'Conventional',
        name: '',
        number: '',
        doses: ''
    });

    // DISCARD FORM STATE (Debit)
    const [discardData, setDiscardData] = useState({
        date: new Date().toISOString().split('T')[0],
        semenType: 'Conventional',
        breed: 'GIR',
        bullId: '',
        quantity: '',
        reason: 'Microscope Check'
    });

    // Handlers
    const handleReceiveChange = (e) => {
        if (e.target.name === 'jati') {
            setReceiveData({ ...receiveData, jati: e.target.value, breed: BREEDS[e.target.value][0] });
        } else {
            setReceiveData({ ...receiveData, [e.target.name]: e.target.value });
        }
    };

    const handleDiscardChange = (e) => {
        setDiscardData({ ...discardData, [e.target.name]: e.target.value });
    };

    const handleEdit = (bull) => {
        setEditingId(bull.id);
        setActiveTab('receive'); // Switch to form
        setReceiveData({
            date: bull.date,
            jati: Object.keys(BREEDS).find(k => BREEDS[k].includes(bull.breed)) || 'Cow',
            breed: bull.breed,
            semenType: bull.semenType || 'Conventional',
            name: bull.name,
            number: bull.number,
            doses: bull.doses // Note: This sets current doses as the "received" amount for editing, user should be careful if they mean original batch
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setReceiveData({
            date: new Date().toISOString().split('T')[0],
            jati: 'Cow',
            breed: 'GIR',
            semenType: 'Conventional',
            name: '',
            number: '',
            doses: ''
        });
    };

    const handleReceiveSubmit = (e) => {
        e.preventDefault();
        if (!receiveData.name || !receiveData.number) {
            alert("Name and Number are required");
            return;
        }

        const actionText = editingId ? "update this bull stock" : "add this new stock";
        if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
            return;
        }

        if (editingId) {
            // Ensure doses is stored as a number
            const updatedData = {
                ...receiveData,
                doses: parseInt(receiveData.doses) || 0
            };
            updateBull(editingId, updatedData);
            alert("Bull updated successfully!");
            handleCancelEdit(); // Reset mode
        } else {
            addBull(receiveData);
            setReceiveData({ ...receiveData, name: '', number: '', doses: '' });
            alert("Stock Received Successfully!");
        }
    };

    const handleDiscardSubmit = (e) => {
        e.preventDefault();
        if (!discardData.bullId || !discardData.quantity) {
            alert("Please select a bull and quantity.");
            return;
        }

        // Find selected bull to verify quantity
        const selectedBull = bulls.find(b => b.id === discardData.bullId);
        if (selectedBull && parseInt(discardData.quantity) > selectedBull.doses) {
            alert(`Error: You cannot discard more than available stock (${selectedBull.doses}).`);
            return;
        }

        discardStock(discardData);
        setDiscardData({ ...discardData, quantity: '', bullId: '' }); // Reset fields
        alert("Stock Discarded Successfully!");
    };

    // Filter Bulls for Discard Dropdown based on selections
    const availableBulls = bulls.filter(b =>
        (b.semenType || 'Conventional') === discardData.semenType &&
        b.breed === discardData.breed &&
        b.doses > 0
    );

    return (
        <div className="w-full max-w-4xl mx-auto p-3 md:p-8 space-y-6">

            {/* TABS */}
            <div className="flex rounded-xl bg-gray-200 p-1">
                <button
                    onClick={() => setActiveTab('receive')}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'receive' ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    📥 Receive Stock
                </button>
                <button
                    onClick={() => setActiveTab('discard')}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'discard' ? 'bg-white text-red-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    🗑️ Discard / Faulty
                </button>
            </div>

            {/* RECEIVE FORM (CREDIT) */}
            {activeTab === 'receive' && (
                <div className={`bg-white p-6 rounded-xl shadow-md border-t-4 ${editingId ? 'border-orange-500' : 'border-blue-600'} animate-fadeIn`}>
                    <h2 className="text-xl font-bold mb-4 text-gray-800 flex justify-between">
                        <span>{editingId ? 'Edit Stock Details' : 'Receive New Stock'}</span>
                        {editingId && (
                            <button onClick={handleCancelEdit} className="text-sm text-red-600 hover:text-red-800">
                                Cancel Edit
                            </button>
                        )}
                    </h2>
                    <form onSubmit={handleReceiveSubmit} className="space-y-4">

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Entry Date</label>
                            <input type="date" name="date" value={receiveData.date} onChange={handleReceiveChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Jati (Species)</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {SPECIES.map(specie => (
                                    <button key={specie} type="button" onClick={() => handleReceiveChange({ target: { name: 'jati', value: specie } })} className={`flex-1 py-2 rounded-md transition text-sm font-medium ${receiveData.jati === specie ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{specie}</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                            <select name="breed" value={receiveData.breed} onChange={handleReceiveChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                {BREEDS[receiveData.jati].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Semen Type</label>
                            <select name="semenType" value={receiveData.semenType} onChange={handleReceiveChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                {SEMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-[2]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bull Name</label>
                                <input type="text" name="name" value={receiveData.name} onChange={handleReceiveChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Raju" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bull No.</label>
                                <input type="text" name="number" value={receiveData.number} onChange={handleReceiveChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="123" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Qty (Straws)</label>
                            <input type="number" name="doses" value={receiveData.doses} onChange={handleReceiveChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="0" />
                        </div>

                        <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg transition active:scale-95 ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {editingId ? 'Update Bull' : 'Add to Stock'}
                        </button>
                    </form>
                </div>
            )}

            {/* DISCARD FORM (DEBIT) */}
            {activeTab === 'discard' && (
                <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-red-600 animate-fadeIn">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Discard / Faulty Stock</h2>
                    <form onSubmit={handleDiscardSubmit} className="space-y-4">

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Entry Date</label>
                            <input type="date" name="date" value={discardData.date} onChange={handleDiscardChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Semen Type</label>
                                <select name="semenType" value={discardData.semenType} onChange={handleDiscardChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-white">
                                    {SEMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                                <select name="breed" value={discardData.breed} onChange={handleDiscardChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-white">
                                    <optgroup label="Cow">
                                        {BREEDS['Cow'].map(b => <option key={b} value={b}>{b}</option>)}
                                    </optgroup>
                                    <optgroup label="Buffalo">
                                        {BREEDS['Buffalo'].map(b => <option key={b} value={b}>{b}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Bull No.</label>
                            <select name="bullId" value={discardData.bullId} onChange={handleDiscardChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white">
                                <option value="">-- Select Bull --</option>
                                {availableBulls.map(b => (
                                    <option key={b.id} value={b.id}>{b.name} #{b.number} (Stock: {b.doses})</option>
                                ))}
                            </select>
                            {availableBulls.length === 0 && <p className="text-xs text-red-500 mt-1">No bulls found for selected type/breed.</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                            <select name="reason" value={discardData.reason} onChange={handleDiscardChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-white">
                                {["Microscope Check", "Broken Straw", "Empty Straw", "Expired", "Other"].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Discard</label>
                            <input type="number" name="quantity" value={discardData.quantity} onChange={handleDiscardChange} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500" placeholder="0" />
                        </div>

                        <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition active:scale-95">Confirm Discard</button>
                    </form>
                </div>
            )}

            {/* LIST (Filtered) */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Stock Overview</h3>

                    {/* Month/Year Filters */}
                    <div className="flex gap-2">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{getMonthName(i)}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                        >
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - 2 + i;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    </div>
                </div>

                {bulls.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No stock available.</p>
                ) : (
                    <div className="space-y-8">
                        {/* CONVENTIONAL TABLE */}
                        <StockTable
                            title="Conventional Semen"
                            bulls={bulls.filter(b => (b.semenType || 'Conventional') === 'Conventional')}
                            stats={stats}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onEdit={handleEdit}
                        />

                        {/* SEXED TABLE */}
                        <StockTable
                            title="Sexed Semen"
                            bulls={bulls.filter(b => b.semenType === 'Sexed')}
                            stats={stats}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onEdit={handleEdit}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// Reusable Table Component
const StockTable = ({ title, bulls, stats, selectedMonth, selectedYear, onEdit }) => {
    if (bulls.length === 0) return null;

    return (
        <div className="overflow-hidden bg-white rounded-lg shadow border border-gray-200">
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                <h4 className="font-bold text-gray-700">{title}</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bull Details</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Previous Stock</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Added Stock</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Used of A.I.</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Discard / Faulty</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {bulls.map((bull) => {
                            // 1. Define Time Boundaries
                            const startOfMonth = new Date(selectedYear, selectedMonth, 1);
                            const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

                            const bullDate = new Date(bull.date);

                            // 2. Hide batches created AFTER this month check logic - actually relying on render logic below
                            if (bullDate > endOfMonth) return null;

                            // 3. Calculate TOTAL LIFETIME Stats
                            const totalUsageEver = (stats.usage || []).filter(u => u.bullId === bull.id).length;
                            const totalDiscardEver = (stats.discard || []).reduce((sum, d) => d.bullId === bull.id ? sum + d.quantity : sum, 0);

                            const originalBatchSize = (bull.doses || 0) + totalUsageEver + totalDiscardEver;

                            // 4. Calculate Stats BEFORE Selected Month
                            const usageBefore = (stats.usage || []).filter(u => u.bullId === bull.id && new Date(u.date) < startOfMonth).length;
                            const discardBefore = (stats.discard || []).reduce((sum, d) =>
                                (d.bullId === bull.id && new Date(d.date) < startOfMonth) ? sum + d.quantity : sum
                                , 0);

                            const addedBefore = bullDate < startOfMonth ? originalBatchSize : 0;
                            const previousStock = Math.max(0, addedBefore - usageBefore - discardBefore);

                            // 5. Calculate Stats DURING Selected Month
                            const usageThisMonth = (stats.usage || []).filter(u =>
                                u.bullId === bull.id &&
                                new Date(u.date) >= startOfMonth &&
                                new Date(u.date) <= endOfMonth
                            ).length;

                            const discardThisMonth = (stats.discard || []).reduce((sum, d) =>
                                (d.bullId === bull.id && new Date(d.date) >= startOfMonth && new Date(d.date) <= endOfMonth) ? sum + d.quantity : sum
                                , 0);

                            const addedThisMonth = (bullDate >= startOfMonth && bullDate <= endOfMonth) ? originalBatchSize : 0;

                            const closingBalance = previousStock + addedThisMonth - usageThisMonth - discardThisMonth;

                            return (
                                <tr key={bull.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">{bull.name} #{bull.number}</div>
                                                <div className="text-xs text-gray-500">
                                                    {bull.breed} ({bull.semenType || 'Conventional'})
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-600 bg-gray-50">
                                        {previousStock}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                                        {addedThisMonth > 0 ? (
                                            <div>
                                                <span className="font-bold text-blue-600">+{addedThisMonth}</span>
                                                <div className="text-xs text-gray-500">{bull.date}</div>
                                            </div>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                                        {usageThisMonth > 0 ? usageThisMonth : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600 font-medium">
                                        {discardThisMonth > 0 ? discardThisMonth : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${closingBalance > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {closingBalance}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => onEdit(bull)} className="text-blue-600 hover:text-blue-900 font-bold flex items-center gap-1 ml-auto">
                                            <span>✎</span> Modify
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BullManagement;



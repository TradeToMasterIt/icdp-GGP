import { useState, useEffect } from 'react';
import { useReceipts } from '../context/ReceiptContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const ReceiptManagement = () => {
    const { receiptBooks, addReceiptBook, deleteBook, activateBook, updateReceiptBook } = useReceipts();
    const { currentUser } = useAuth();

    // Filter State
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [usageStats, setUsageStats] = useState([]);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0], // Default today
        start: '',
        end: '',
        type: 'Conventional' // Default
    });

    // Fetch Usage Stats for Calculation
    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, 'breeding'), where('userId', '==', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const stats = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    date: data.date,
                    receiptNo: parseInt(data.receiptNo) || 0,
                    semenType: data.semenType || 'Conventional' // Assumption: usage matches type
                };
            });
            setUsageStats(stats);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const getMonthName = (monthIndex) => {
        return new Date(2000, monthIndex, 1).toLocaleString('default', { month: 'long' });
    };

    const handleEdit = (book) => {
        setEditingId(book.id);
        setFormData({
            date: book.date,
            start: book.start,
            end: book.end,
            type: book.type
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            start: '',
            end: '',
            type: 'Conventional'
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const actionText = editingId ? "update this receipt book" : "add this new receipt book";
        if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
            return;
        }

        if (formData.start && formData.end) {
            if (editingId) {
                updateReceiptBook(editingId, {
                    date: formData.date,
                    start: parseInt(formData.start),
                    end: parseInt(formData.end),
                    type: formData.type
                });
                setEditingId(null);
            } else {
                addReceiptBook(formData.start, formData.end, formData.type, formData.date); // Pass date
            }

            setFormData({
                date: new Date().toISOString().split('T')[0],
                start: '',
                end: '',
                type: 'Conventional'
            });
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-3 md:p-8 space-y-6 animate-fadeIn">

            {/* ADD BOOK FORM */}
            <div className={`p-6 rounded-xl shadow-md border-t-4 ${editingId ? 'bg-amber-50 border-amber-500' : 'bg-white border-teal-600'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Receipt Book' : 'Add Receipt Book'}</h2>
                    {editingId && (
                        <button onClick={handleCancelEdit} className="text-red-500 text-sm font-bold hover:underline">Cancel Edit</button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Date Input */}
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Entry Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            required
                        />
                    </div>

                    {/* Type Selection */}
                    <div className="flex gap-4 mb-2">
                        {['Conventional', 'Sexed'].map(t => (
                            <label key={t} className={`flex-1 cursor-pointer border-2 rounded-lg p-2 text-center transition ${formData.type === t
                                ? (t === 'Sexed' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-blue-500 bg-blue-50 text-blue-700')
                                : 'border-gray-200 text-gray-500'
                                }`}>
                                <input
                                    type="radio"
                                    name="type"
                                    value={t}
                                    checked={formData.type === t}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="hidden"
                                />
                                <span className="font-bold">{t}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Start No.</label>
                            <input
                                type="number"
                                value={formData.start}
                                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="101"
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">End No.</label>
                            <input
                                type="number"
                                value={formData.end}
                                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="200"
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg transition ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-teal-600 hover:bg-teal-700'}`}>
                        {editingId ? 'Update Receipt Book' : 'Add Book'}
                    </button>
                </form>
            </div>

            {/* STOCK OVERVIEW LIST */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                    <h3 className="text-lg font-bold text-gray-700">Receipt Book Stock Overview</h3>

                    {/* Month/Year Filters */}
                    <div className="flex gap-2">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{getMonthName(i)}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
                        >
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - 2 + i;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    </div>
                </div>

                {receiptBooks.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No receipt books found.</p>
                ) : (
                    <div className="space-y-8">
                        {/* CONVENTIONAL TABLE */}
                        <ReceiptStockTable
                            title="Conventional Receipt Books"
                            books={receiptBooks.filter(b => (b.type || 'Conventional') === 'Conventional')}
                            usageStats={usageStats}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onActivate={activateBook}
                            onDelete={deleteBook}
                            onEdit={handleEdit}
                        />

                        {/* SEXED TABLE */}
                        <ReceiptStockTable
                            title="Sexed Receipt Books"
                            books={receiptBooks.filter(b => b.type === 'Sexed')}
                            usageStats={usageStats}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onActivate={activateBook}
                            onDelete={deleteBook}
                            onEdit={handleEdit}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// Reusable Receipt Table Component
const ReceiptStockTable = ({ title, books, usageStats, selectedMonth, selectedYear, onActivate, onDelete, onEdit }) => {
    if (books.length === 0) return null;

    return (
        <div className="overflow-hidden bg-white rounded-lg shadow border border-gray-200">
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                <h4 className="font-bold text-gray-700">{title}</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Book Details</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Previous Stock</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Added Stock</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Used</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {books.map((book) => {
                            // 1. Time Boundaries
                            const startOfMonth = new Date(selectedYear, selectedMonth, 1);
                            const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
                            const bookDate = new Date(book.date);

                            // 2. Hide batches created AFTER this month
                            if (bookDate > endOfMonth) return null;

                            // 3. BOOK METRICS
                            const totalCapacity = (book.end - book.start) + 1;

                            // 4. Calculate Stats BEFORE Selected Month
                            // Usage is counted if receiptNo is within book range AND date < startOfMonth
                            const usageBefore = usageStats.filter(u =>
                                u.receiptNo >= book.start &&
                                u.receiptNo <= book.end &&
                                new Date(u.date) < startOfMonth
                            ).length;

                            // If book added before month, 'Added' = capacity. If during, 'Added' = 0 (for Previous context)
                            const addedBefore = bookDate < startOfMonth ? totalCapacity : 0;
                            const previousStock = Math.max(0, addedBefore - usageBefore);

                            // 5. Calculate Stats DURING Selected Month
                            const usageThisMonth = usageStats.filter(u =>
                                u.receiptNo >= book.start &&
                                u.receiptNo <= book.end &&
                                new Date(u.date) >= startOfMonth &&
                                new Date(u.date) <= endOfMonth
                            ).length;

                            // Added THIS Month?
                            const addedThisMonth = (bookDate >= startOfMonth && bookDate <= endOfMonth) ? totalCapacity : 0;

                            // 6. CLOSING BALANCE
                            const closingBalance = previousStock + addedThisMonth - usageThisMonth;

                            return (
                                <tr key={book.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900">{book.start} - {book.end}</span>
                                            <span className="text-xs text-gray-500">Total: {totalCapacity}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-600 bg-gray-50">
                                        {previousStock}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                                        {addedThisMonth > 0 ? (
                                            <div>
                                                <span className="font-bold text-teal-600">+{addedThisMonth}</span>
                                                <div className="text-xs text-gray-500">{book.date}</div>
                                            </div>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                                        {usageThisMonth > 0 ? usageThisMonth : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${closingBalance > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {closingBalance}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <span className={`text-xs font-bold uppercase ${book.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                                            {book.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                                        {book.status === 'pending' && (
                                            <button
                                                onClick={() => onActivate(book.id)}
                                                className="text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded text-xs"
                                            >
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onEdit(book)}
                                            className="text-blue-600 hover:text-blue-900 font-bold flex items-center gap-1"
                                        >
                                            <span>✎</span> Modify
                                        </button>
                                        <button
                                            onClick={() => onDelete(book.id)}
                                            className="text-gray-400 hover:text-red-500"
                                            title="Delete Book"
                                        >
                                            🗑️
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
export default ReceiptManagement;

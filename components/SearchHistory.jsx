import { useState, useEffect } from 'react';
import { db } from '../db';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const SearchHistory = () => {
    const { currentUser } = useAuth(); // Get current user
    const [searchTerm, setSearchTerm] = useState('');
    // const [entries, setEntries] = useState([]); // Local storage no longer primary source
    const [results, setResults] = useState([]);
    const [animalSummary, setAnimalSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [indexLink, setIndexLink] = useState(null); // Store Firestore Index Link

    const [selectedBreed, setSelectedBreed] = useState(''); // New Breed Filter
    const [searchAll, setSearchAll] = useState(false); // Admin Toggle

    const handleSearch = async (e) => {
        e.preventDefault();
        setIndexLink(null); // Reset link on new search

        if (!currentUser) {
            setStatusMessage("User not authenticated.");
            return;
        }

        // ... (existing code) ...

        const term = searchTerm.trim();
        // Allow search if breed is selected even if term is empty? 
        // User asked "search animal history by name and breed".
        // Let's require at least one.
        if (!term && !selectedBreed) return;

        setLoading(true);
        setStatusMessage('Searching database...');
        setResults([]);
        setAnimalSummary(null);

        try {
            const matches = [];
            const processedIds = new Set();
            const breedingRef = collection(db, "breeding");

            // SEARCH SCOPE HELPER
            // If searchAll is TRUE (Admin checked it), we do NOT add userId filter.
            // If searchAll is FALSE, we ADD userId filter.
            const applyScope = (constraints) => {
                if (!searchAll) {
                    return [where('userId', '==', currentUser.uid), ...constraints];
                }
                return constraints;
            };

            // SEARCH STRATEGY
            // 1. Tag Number / Untagged Name Search (Prefix Match)
            if (term) {
                const qTag = query(
                    breedingRef,
                    ...applyScope([
                        where('tagNo', '>=', term),
                        where('tagNo', '<=', term + '\uf8ff')
                    ])
                );
                const snapTag = await getDocs(qTag);

                snapTag.docs.forEach(doc => {
                    const data = doc.data();
                    if (selectedBreed && data.breed !== selectedBreed) return;
                    if (!processedIds.has(doc.id)) {
                        matches.push({ id: doc.id, ...data });
                        processedIds.add(doc.id);
                    }
                });
            }

            // 2. Owner Name & Animal Name Search (Prefix Match)
            if (term && !/^\d+$/.test(term)) {
                // Generate variations
                const lower = term.toLowerCase();
                const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
                const upper = lower.toUpperCase();
                const searchVariations = new Set([term, lower, capitalized, upper]);

                for (const t of searchVariations) {
                    if (!t) continue;

                    // Owner Name
                    const qOwner = query(
                        breedingRef,
                        ...applyScope([
                            where('ownerName', '>=', t),
                            where('ownerName', '<=', t + '\uf8ff')
                        ])
                    );
                    const snapOwner = await getDocs(qOwner);
                    snapOwner.docs.forEach(doc => {
                        const data = doc.data();
                        if (selectedBreed && data.breed !== selectedBreed) return;
                        if (!processedIds.has(doc.id)) {
                            matches.push({ id: doc.id, ...data });
                            processedIds.add(doc.id);
                        }
                    });

                    // Animal Name
                    const qAnimal = query(
                        breedingRef,
                        ...applyScope([
                            where('animalName', '>=', t),
                            where('animalName', '<=', t + '\uf8ff')
                        ])
                    );
                    const snapAnimal = await getDocs(qAnimal);
                    snapAnimal.docs.forEach(doc => {
                        const data = doc.data();
                        if (selectedBreed && data.breed !== selectedBreed) return;
                        if (!processedIds.has(doc.id)) {
                            matches.push({ id: doc.id, ...data });
                            processedIds.add(doc.id);
                        }
                    });
                }
            }

            // 3. Mobile Number Search (Exact/Prefix)
            if (term && /^\d+$/.test(term)) {
                const qMobile = query(
                    breedingRef,
                    ...applyScope([
                        where('mobileNumber', '>=', term),
                        where('mobileNumber', '<=', term + '\uf8ff')
                    ])
                );
                const snapMobile = await getDocs(qMobile);
                snapMobile.docs.forEach(doc => {
                    const data = doc.data();
                    if (selectedBreed && data.breed !== selectedBreed) return;
                    if (!processedIds.has(doc.id)) {
                        matches.push({ id: doc.id, ...data });
                        processedIds.add(doc.id);
                    }
                });
            }

            // 3. IF ONLY BREED SELECTED (No Term)
            if (!term && selectedBreed) {
                const qBreed = query(
                    breedingRef,
                    ...applyScope([
                        where('breed', '==', selectedBreed),
                        orderBy('date', 'desc'),
                        limit(20)
                    ])
                );
                const snapBreed = await getDocs(qBreed);
                snapBreed.docs.forEach(doc => {
                    if (!processedIds.has(doc.id)) {
                        matches.push({ id: doc.id, ...doc.data() });
                        processedIds.add(doc.id);
                    }
                });
            }

            // Client-side Sort (Newest First)
            matches.sort((a, b) => new Date(b.date) - new Date(a.date));

            setResults(matches);

            if (matches.length > 0) {
                // Summary Logic
                const isDigitSearch = /^\d+$/.test(term);
                const uniqueTags = new Set(matches.map(m => m.tagNo)).size;

                if ((isDigitSearch || uniqueTags === 1) && uniqueTags === 1) {
                    const mostRecent = matches[0];
                    setAnimalSummary({
                        count: matches.length,
                        lastDate: mostRecent.date,
                        type: `${mostRecent.jati} - ${mostRecent.breed}`
                    });
                } else {
                    setAnimalSummary(null);
                }
                setStatusMessage(`Found ${matches.length} result(s).`);
            } else {
                setStatusMessage('No records found matching criteria.');
                setAnimalSummary(null);
            }

        } catch (error) {
            console.error("Search Error:", error);
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                if (linkMatch) {
                    setIndexLink(linkMatch[0]);
                    setStatusMessage("Missing Index: Click the button below to create it.");
                } else {
                    setStatusMessage("Missing Index: Ask Admin to create composite indexes (Check Console for link).");
                }
            } else {
                setStatusMessage("Error fetching data. Check connection.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Breed Options (Flattened)
    const SEARCH_BREEDS = [
        'GIR', 'H.F', 'KANKREJ', 'N.D.', // Cow
        'MEHASANI', 'SURTI', 'MURRAH', 'JAFARABADI', 'BANNI', 'N.D. BUFFALO' // Buffalo
    ];

    return (
        <div className="max-w-lg mx-auto p-4 pb-24 space-y-6">

            {/* Search Bar */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-teal-600">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Search History</h2>
                <form onSubmit={handleSearch} className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-lg font-mono"
                            placeholder="Tag No, Animal/Owner Name, or Mobile No"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-teal-600 text-white px-4 rounded-lg font-bold hover:bg-teal-700 disabled:bg-teal-300 text-xl"
                        >
                            {loading ? '...' : '🔍'}
                        </button>
                    </div>

                    {/* Breed Filter (Optional) */}
                    <div className="flex flex-col md:flex-row gap-2">
                        <select
                            value={selectedBreed}
                            onChange={(e) => setSelectedBreed(e.target.value)}
                            className={`p-2 border rounded-lg text-sm font-semibold outline-none transition-colors flex-grow ${selectedBreed ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-500'}`}
                        >
                            <option value="">filter by Breed (All)</option>
                            {SEARCH_BREEDS.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>

                        {/* ADMIN TOGGLE: Search All Data */}
                        {(currentUser?.role === 'Admin' || currentUser?.email === 'ggp305ggp@gmail.com') && (
                            <label className="flex items-center gap-2 p-2 border border-orange-200 bg-orange-50 rounded-lg cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={searchAll}
                                    onChange={(e) => setSearchAll(e.target.checked)}
                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <span className="text-xs font-bold text-orange-800">Search ALL Data (Admin)</span>
                            </label>
                        )}
                    </div>
                </form>
                {statusMessage && <p className="mt-2 text-sm text-red-500 text-right font-bold">{statusMessage}</p>}
                {indexLink && (
                    <div className="text-right mt-1">
                        <a
                            href={indexLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-teal-700 transition-colors"
                        >
                            ⚡ Create Index Now
                        </a>
                    </div>
                )}
            </div>

            {/* 1. Summary Card (Only if applicable) */}
            {animalSummary && (
                <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-teal-100 text-sm font-semibold uppercase tracking-wider">Animal Profile</p>
                            <h3 className="text-2xl font-bold mt-1">{animalSummary.type}</h3>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                            <span className="text-xs block text-teal-100">Tag No</span>
                            <span className="font-mono font-bold text-lg">{searchTerm}</span>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-4">
                        <div className="bg-black/20 flex-1 p-3 rounded-lg text-center">
                            <span className="block text-2xl font-bold">{animalSummary.count}</span>
                            <span className="text-xs text-teal-100">Total Doses</span>
                        </div>
                        <div className="bg-black/20 flex-1 p-3 rounded-lg text-center">
                            <span className="block text-lg font-bold mt-1">{animalSummary.lastDate}</span>
                            <span className="text-xs text-teal-100">Last Visit</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Timeline / Results List (Always show if results exist) */}
            {results.length > 0 ? (
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-700 ml-1">Visit History</h3>
                    {results.map((entry) => (
                        <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 relative overflow-hidden">
                            {/* Left Line */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200"></div>

                            <div className="flex-grow space-y-2">
                                {/* Row 1: Header & Status */}
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-bold text-gray-400">#{entry.receiptNo}</span>
                                        <span className="text-sm font-bold text-gray-800">{entry.date}</span>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${entry.status === 'Pregnant (PD+)' ? 'bg-green-100 text-green-700' :
                                        entry.status === 'Repeated' ? 'bg-orange-100 text-orange-700' :
                                            entry.status === 'Empty' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-50 text-blue-700'
                                        }`}>
                                        {(() => {
                                            if (entry.status === 'Pregnant (PD+)') return 'Pregnant'; // Confirmed
                                            if (entry.status === 'Pregnant') return 'Pending'; // Initial AI (Pending PD)
                                            if (entry.pd_result) return `PD: ${entry.pd_result}`;
                                            return entry.status || 'Pending';
                                        })()}
                                    </div>
                                </div>

                                {/* Row 2: Bull & Semen Info */}
                                <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                    <div className="text-teal-700 font-bold text-lg leading-tight">{entry.bullName}</div>
                                    <div className="text-xs text-gray-500 flex gap-2 mt-1">
                                        <span className="bg-white px-1 border rounded">{entry.semenType || 'Conventional'}</span>
                                        <span>Dose: {entry.bullId ? '1' : '-'}</span>
                                    </div>
                                </div>

                                {/* Row 3: Animal Info (Tag & Breed) */}
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                                    <div>
                                        <span className="block text-xs text-gray-400">Tag Number</span>
                                        <span className="font-mono font-bold text-gray-700">{entry.tagNo}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Breed / Jati</span>
                                        <span className="font-medium">{entry.breed} ({entry.jati})</span>
                                    </div>
                                </div>

                                {/* Row 4: Owner & Contact */}
                                <div className="border-t border-dashed border-gray-200 pt-2 mt-1">
                                    <div className="text-gray-800 font-bold">{entry.ownerName}</div>
                                    <div className="text-xs text-gray-500 flex justify-between">
                                        <span>{entry.village}</span>
                                        <span className="font-mono">{entry.mobileNumber || 'No Mobile'}</span>
                                    </div>
                                </div>

                                {/* Row 5: Calving Event (If Delivered) */}
                                {entry.calfGender && (
                                    <div className="mt-2 bg-pink-50 border-l-4 border-pink-500 p-2 rounded">
                                        <div className="text-xs font-bold text-pink-700 uppercase tracking-wide">Calving Event</div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-gray-800">Delivered: {entry.calfGender}</span>
                                            <span className="font-mono text-gray-600">{entry.lastCalvingDate ? entry.lastCalvingDate.split('-').reverse().join('/') : ''}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // 3. No Results State
                searchTerm && !loading && (
                    <div className="text-center py-10 text-gray-400">
                        <p className="text-xl">🤷‍♂️</p>
                        <p>No history found.</p>
                    </div>
                )
            )}

        </div>
    );
};

export default SearchHistory;

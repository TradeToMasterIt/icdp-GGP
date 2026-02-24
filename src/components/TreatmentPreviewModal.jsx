
import React from 'react';

const TreatmentPreviewModal = ({ isOpen, onClose, onConfirm, data, titles }) => {
    if (!isOpen) return null;

    const {
        date, ownerName, village, tagNo, jati, diagnosis,
        category, medicinesUsed, isFlock, animalCount, type
    } = data;

    const totalAnimals = isFlock ? animalCount : (tagNo === 'Untagged' ? 1 : 1); // Logic check needed for batch?
    // Batch logic is handled in Form, here we receive a single "Representative" preview or summary? 
    // Actually, if batch, we might want to show "Batch of X Animals".
    // For now let's assume specific data passed is for display.

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 animate-fadeIn">

                {/* Header */}
                <div className="bg-gray-100 p-4 rounded-t-xl border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                        📋 Confirm {type} Treatment
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-600 font-bold text-xl">
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-gray-50 rounded border border-gray-100">
                            <span className="block text-xs font-bold text-gray-500 uppercase">Date</span>
                            <span className="font-medium text-gray-800">{date}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-100">
                            <span className="block text-xs font-bold text-gray-500 uppercase">Category</span>
                            <span className="font-medium text-blue-600 font-bold">{category || '-'}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-100">
                            <span className="block text-xs font-bold text-gray-500 uppercase">Owner</span>
                            <span className="font-medium text-gray-800">{ownerName}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-100">
                            <span className="block text-xs font-bold text-gray-500 uppercase">Village</span>
                            <span className="font-medium text-gray-800">{village}</span>
                        </div>
                    </div>

                    {/* Animal Details */}
                    <div className="bg-blue-50 p-4 rounded border border-blue-100">
                        <h3 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1">Animal Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Tag/ID:</span>
                                <span className="ml-2 font-mono font-bold text-gray-900">{tagNo}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Species:</span>
                                <span className="ml-2 font-bold text-gray-900">{jati}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-gray-600">Diagnosis:</span>
                                <span className="ml-2 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                    {diagnosis}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Medicines - Stock Deduction Warning */}
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                        <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                            <span>💊</span> Medicine & Stock Deduction
                        </h3>
                        {medicinesUsed && medicinesUsed.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 border-b border-yellow-200">
                                    <tr>
                                        <th className="pb-1">Medicine</th>
                                        <th className="pb-1">Type</th>
                                        <th className="pb-1 text-right">Qty Used</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-yellow-100">
                                    {medicinesUsed.map((m, i) => (
                                        <tr key={i}>
                                            <td className="py-2 text-gray-800 font-medium">{m.name}</td>
                                            <td className="py-2 text-gray-600">{m.type}</td>
                                            <td className="py-2 text-right font-bold text-red-600">-{m.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No medicines selected.</p>
                        )}
                        <p className="mt-3 text-xs text-yellow-700 font-bold text-center">
                            ⚠️ Stock will be automatically deducted upon confirmation.
                        </p>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 p-4 rounded-b-xl border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-200 transition"
                    >
                        Edit / Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 rounded-lg bg-teal-600 text-white font-bold shadow hover:bg-teal-700 transition flex items-center gap-2"
                    >
                        <span>✅</span> Confirm & Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TreatmentPreviewModal;

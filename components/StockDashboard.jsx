import { useState } from 'react';
import BullManagement from './BullManagement';
import ReceiptManagement from './ReceiptManagement';
import MedicineManagement from './MedicineManagement';

const StockDashboard = () => {
    // 2. Implement Tabs Logic
    const [activeTab, setActiveTab] = useState('bulls');

    return (
        <div className="h-full flex flex-col">
            {/* Navigation Bar with 3 Buttons */}
            <div className="bg-white p-3 shadow-sm border-b border-gray-300 flex justify-center gap-4 sticky top-0 z-10">
                <button
                    onClick={() => setActiveTab('bulls')}
                    className={`px-4 py-2 rounded font-bold transition-colors ${activeTab === 'bulls'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Bulls
                </button>
                <button
                    onClick={() => setActiveTab('receipts')}
                    className={`px-4 py-2 rounded font-bold transition-colors ${activeTab === 'receipts'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Receipts
                </button>
                <button
                    onClick={() => setActiveTab('medicines')}
                    className={`px-4 py-2 rounded font-bold transition-colors ${activeTab === 'medicines'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Medicines
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
                {activeTab === 'bulls' && <BullManagement />}
                {activeTab === 'receipts' && <ReceiptManagement />}
                {activeTab === 'medicines' && (
                    typeof MedicineManagement !== 'undefined' ? <MedicineManagement /> :
                        <div className="text-center p-10 text-gray-500">Medicine Module Loading...</div>
                )}
            </div>
        </div>
    );
};

export default StockDashboard;

import { useState, useEffect } from 'react';
import DataEntry from './DataEntry';
import PDList from './PDList';
import CalvingList from './CalvingList';


const BreedingDashboard = ({ setActiveTab }) => {
    const [activeSubTab, setActiveSubTab] = useState('entry');

    // Tab Definitions
    const tabs = [
        { id: 'entry', label: 'A.I. Entry', icon: '📝' },
        { id: 'pd', label: 'P.D. List', icon: '⏰' },
        { id: 'calving', label: 'Calving List', icon: '👶' }
    ];

    return (
        <div className="flex flex-col h-full space-y-6">

            {/* Navigation Tabs */}
            <div className="flex justify-center">
                <div className="bg-white p-1.5 rounded-2xl shadow-soft border border-secondary-200 inline-flex">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`flex items-center gap-2 py-2.5 px-6 rounded-xl transition-all duration-300 ${activeSubTab === tab.id
                                ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-500/30 transform scale-105'
                                : 'text-secondary-500 hover:text-secondary-900 hover:bg-secondary-50 font-medium'
                                }`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl shadow-card border border-secondary-100 p-4 md:p-8 min-h-[600px] transition-all duration-500">
                {activeSubTab === 'entry' && <DataEntry setActiveTab={setActiveTab} />}
                {activeSubTab === 'pd' && <PDList />}
                {activeSubTab === 'calving' && <CalvingList />}
            </div>
        </div>
    );
};

export default BreedingDashboard;

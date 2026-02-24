import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/sidebar-logo-custom.png'; // Latest User Uploaded Logo




const Sidebar = ({ isOpen, onClose, activeTab, setActiveTab, userRole, currentUser }) => {
    const { logout } = useAuth();
    const isSuperBypass = currentUser?.email?.toLowerCase() === 'ggp305ggp@gmail.com';
    const [expandedMenu, setExpandedMenu] = useState(null); // Default collapsed

    // Menu item definition
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'vaccination_data', label: 'Data', icon: '💉' },
        {
            id: 'breeding',
            label: 'Animal Breeding',
            icon: '🧬',
            hasSubmenu: true,
            subItems: [
                { id: 'ai_entry', label: 'A.I. Entry', icon: '📝' },
                { id: 'pd_list', label: 'P.D. List', icon: '⏰' },
                { id: 'calving_list', label: 'Calving List', icon: '👶' }
            ]
        },
        {
            id: 'stock-management',
            label: 'Stock',
            icon: '📦',
            hasSubmenu: true,
            subItems: [
                { id: 'bulls', label: 'Bulls', icon: '🐂' },
                { id: 'receipts', label: 'Receipts', icon: '🧾' },
                { id: 'medicine', label: 'Medicine', icon: '💊' },
                { id: 'monthly_stock_report', label: 'Monthly Report', icon: '📅' }
            ]
        },
        {
            id: 'treatment',
            label: 'Treatment',
            icon: '🩺',
            hasSubmenu: true,
            subItems: [
                { id: 'primary_treatment', label: 'Primary Treatment', icon: '🩹' },
                { id: 'medicine_supply', label: 'Medicine Supply', icon: '💊' },
                { id: 'tour_patient', label: 'Tour Patient', icon: '🚐' },
                { id: 'shc_treatment', label: 'S.H.C. Treatment', icon: '🚑' }
            ]
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: '📒',
            hasSubmenu: true,
            subItems: [
                { id: 'master_report', label: 'Master Report', icon: '📊' },
                { id: 'breeding_report', label: 'Breeding Report', icon: '📋' },
                { id: 'calving_record', label: 'Calving Report', icon: '📅' },
                { id: 'treatment_report', label: 'Treatment Report', icon: '📒' },
                { id: 'traceability_report', label: 'Traceability Report', icon: '🔍' }
            ]
        },
        {
            id: 'register',
            label: 'Register',
            icon: '📒',
            hasSubmenu: true,
            subItems: [
                { id: 'receipt_register', label: 'Receipt Reg.', icon: '🧾' }
            ]
        },
    ];

    if (activeTab === 'admin' || (typeof userRole !== 'undefined' && userRole === 'Admin') || isSuperBypass) {
        menuItems.push({ id: 'admin', label: 'Admin Panel', icon: '🛡️' });
        menuItems.push({ id: 'user_approval', label: 'User Approvals', icon: '✅' });
    }

    const handleLogout = async () => {
        if (window.confirm("Are you sure you want to log out?")) {
            await logout();
            onClose(); // Close mobile drawer if open
        }
    };

    const toggleSubmenu = (id) => {
        setExpandedMenu(expandedMenu === id ? null : id);
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-primary-900 text-white shadow-xl">
            {/* Logo Section */}
            {/* Logo Section */}
            <div className="p-6 border-b border-white/10 flex flex-col items-center justify-center text-center">
                <div className="w-48 h-auto mb-2 flex items-center justify-center">
                    <img src={logo} alt="GGPATEL Logo" className="w-full h-full object-contain drop-shadow-lg" />
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto scrollbar-hide bg-slate-900">
                {menuItems.map(item => (
                    <div key={item.id}>
                        <button
                            onClick={() => {
                                if (item.hasSubmenu) {
                                    toggleSubmenu(item.id);
                                } else {
                                    setActiveTab(item.id);
                                    if (window.innerWidth < 1024) onClose();
                                }
                            }}
                            className={`w-full flex items-center justify-between px-5 py-4 transition-all duration-300 border-b border-white/5 group ${activeTab === item.id && !item.hasSubmenu
                                ? 'bg-teal-500/10 text-teal-400 font-bold border-l-4 border-l-teal-500' // Teal Highlight
                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <div className="flex items-center gap-4 text-base font-medium">
                                <span className={`text-lg w-6 text-center ${activeTab === item.id ? 'text-teal-400 scale-110' : 'text-gray-400'}`}>{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                            {
                                item.hasSubmenu && (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-3 w-3 transition-transform duration-300 ${expandedMenu === item.id ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                )
                            }
                        </button>

                        {/* Submenu */}
                        {item.hasSubmenu && (
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-black/20 ${expandedMenu === item.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                {item.subItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => {
                                            setActiveTab(sub.id);
                                            if (window.innerWidth < 1024) onClose();
                                        }}
                                        className={`w-full flex items-center px-10 py-3 text-sm border-l-2 ml-5 border-white/5 transition-colors ${activeTab === sub.id
                                            ? 'border-l-teal-500 text-teal-400 font-bold bg-white/5'
                                            : 'border-l-transparent text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <span className="mr-3 opacity-70 w-5 text-center">{sub.icon}</span>
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))
                }
            </nav>

        </div>
    );

    return (
        <>
            {/* Overlay (Visible when Open) */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>

            {/* Sidebar Drawer (Slide in from left) */}
            <div
                className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-200 shadow-xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <SidebarContent />
            </div>
        </>
    );
};

export default Sidebar;

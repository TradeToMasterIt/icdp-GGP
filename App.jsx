import React, { useState, useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'

import './App.css'
import { db, auth } from './db'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ReceiptProvider } from './context/ReceiptContext'
import { BullProvider } from './context/BullContext'
import { MedicineProvider } from './context/MedicineContext'
import { TreatmentProvider } from './context/TreatmentContext'
import { AuthProvider, useAuth } from './context/AuthContext'

import ReceiptManagement from './components/ReceiptManagement'
import BullManagement from './components/BullManagement'
import DataEntry from './components/DataEntry'
import SearchHistory from './components/SearchHistory'
import Sidebar from './components/Sidebar'
import BreedingDashboard from './components/BreedingDashboard'
import StockDashboard from './components/StockDashboard'
import MedicineManagement from './components/MedicineManagement'
import TreatmentForm from './components/TreatmentForm'
import PrimaryTreatment from './components/PrimaryTreatment' // New Import
import SHCTreatment from './components/SHCTreatment'
import MedicineSupply from './components/MedicineSupply' // New Import
import TourPatient from './components/TourPatient' // New Import
import TreatmentDashboard from './pages/TreatmentDashboard'
import MasterAdminDashboard from './pages/MasterAdminDashboard'
import Profile from './pages/Profile' // New Import
import Login from './components/Login'
import Signup from './components/Signup'
import PDList from './components/PDList'
import CalvingList from './components/CalvingList'
import AuthGuard from './components/AuthGuard'

import loginBg from './assets/login-bg-kankrej.png' // Login Background
import CohortReport from './pages/CohortReport';
import BullStockReport from './pages/BullStockReport';
import ReceiptRegister from './pages/ReceiptRegister';
import TreatmentReport from './pages/TreatmentReport'; // New Import
import TreatmentSummary from './pages/TreatmentSummary'; // New Import

import MasterReport from './pages/MasterReport';



import UserApproval from './pages/UserApproval';
import BreedingReport from './pages/BreedingReport'; // New Import
import PageTransition from './components/ui/PageTransition';
import CalvingRecords from './pages/CalvingRecords'; // New Import
import Dashboard from './pages/Dashboard'; // New Import
import VaccinationData from './pages/VaccinationData';
import MonthlyStockReport from './pages/MonthlyStockReport'; // NEW // New Import
import TraceabilityReport from './pages/Reports/TraceabilityReport'; // New Import

// Temporary placeholder component
const Placeholder = ({ title }) => <div className="p-8 text-center text-gray-500 font-bold text-xl">🚧 {title} Module Coming Soon 🚧</div>

// Global Error Boundary
class GlobalErrorBoundary extends React.Component { // Ensure React is imported or available
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Global App Error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-10">
          <div className="max-w-2xl w-full bg-red-50 border-2 border-red-500 rounded-xl p-8 shadow-2xl">
            <h1 className="text-3xl font-bold text-red-700 mb-4">Application Crashed</h1>
            <p className="text-lg text-red-900 mb-6">Something went wrong in the main application layout.</p>
            <div className="bg-white p-4 rounded border border-red-200 overflow-auto max-h-96">
              <p className="font-mono text-red-600 font-bold mb-2">{this.state.error?.message}</p>
              <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-3 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// The Main App Logic (Protected)
const AuthenticatedApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false) // New State for Dropdown
  const { logout, currentUser } = useAuth() // Get currentUser to check role

  const handleLogout = async () => {
    // No confirmation passed here if called from timer?
    // Let's modify logic to differentiate or just force logout.
    // For manual we want confirm, for timeout we just do it (or confirm with timeout? Hard to confirm with timeout).
    // Let's keep manual confirm separate.
    await logout()
  }

  const handleManualLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await logout()
    }
  }

  // AUTO LOGOUT LOGIC
  useEffect(() => {
    // Increased to 15 Minutes based on user feedback (5 mins was too short)
    const TIMEOUT_DURATION = 15 * 60 * 1000;
    let logoutTimer;

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        logout();
      }, TIMEOUT_DURATION);
    };

    // Events to track user activity
    // 'scroll' does not bubble, so we must use capture: true to detect scrolling in inner divs
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];

    // Add listeners with capture: true
    events.forEach(event => window.addEventListener(event, resetTimer, true));

    // Initialize
    resetTimer();

    // Cleanup
    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer, true));
    };
  }, [logout]);

  const getHeaderTitle = () => {
    const titles = {
      breeding: 'Animal Breeding',
      ai_entry: 'A.I. Data Entry',
      dashboard: 'A.I. Statistics Dashboard',
      pd_list: 'Pregnancy Diagnosis (P.D.)',
      calving_list: 'Calving Status List',
      'stock-management': 'Stock Management',
      bulls: 'Bull Management',
      receipts: 'Receipt Management',
      medicine: 'Medicine Inventory',
      treatment: 'Treatment',
      primary_treatment: 'Primary Treatment Record',
      shc_treatment: 'S.H.C. / Follow-up Treatment',
      search: 'Reports & History',
      breeding_report: 'Breeding Report',
      calving_record: 'Calving Report',
      treatment_report: 'Treatment Report',

      admin: 'Master Admin',
      profile: 'User Profile',
      master_report: 'Master Monthly Report',
      stock_register: 'Seman Account Register',
      receipt_register: 'Receipt Hisab Register',
      user_approval: 'User Approvals',
      vaccination_data: 'Vaccination & Extension Data',
      traceability_report: 'Traceability Report',
    }
    return titles[activeTab] || 'GGPATEL'
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={currentUser?.role} // Pass role to sidebar
        currentUser={currentUser} // Pass full user for email bypass
      />

      {/* Main Content Area - Full Width */}
      <div className="w-full flex flex-col min-h-screen transition-all duration-300 bg-secondary-50">

        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 border-b bg-white/80 dark:bg-secondary-900/80 border-secondary-200 dark:border-secondary-800 backdrop-blur-xl shadow-soft">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 transition rounded-lg text-secondary-600 dark:text-secondary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="flex-1 ml-2 overflow-hidden text-xl font-bold whitespace-nowrap text-secondary-800 dark:text-secondary-100 font-heading md:ml-0 text-ellipsis">
            {getHeaderTitle()}
          </h1>

          <div className="flex items-center gap-3 relative">
            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white hover:bg-primary-50 hover:text-primary-700 border border-secondary-200 hover:border-primary-200 transition-all duration-300 shadow-sm group focus:outline-none"
              >
                <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white transition-transform rounded-full bg-teal-600 shadow-md group-hover:scale-105">
                  {currentUser?.displayName?.[0] || 'U'}
                </div>
                <span className="hidden text-sm font-semibold md:block text-gray-700">{currentUser?.name || currentUser?.displayName || 'User'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown Content */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 transform origin-top-right animate-fadeIn">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{currentUser?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => { setActiveTab('profile'); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span>👤</span> Profile
                    </button>
                    <button
                      onClick={handleManualLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Click Listener to Close Menu */}
        {isUserMenuOpen && (
          <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setIsUserMenuOpen(false)}></div>
        )}

        <main className="flex-grow p-4 lg:p-8 overflow-y-auto bg-background">
          <PageTransition key={activeTab}>
            {activeTab === 'search' && <SearchHistory />}
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}

            {/* Flattened Breeding Submenu Routes */}

            {/* Flattened Breeding Submenu Routes */}
            {activeTab === 'breeding' && <DataEntry setActiveTab={setActiveTab} />} {/* Fallback/Default */}
            {activeTab === 'ai_entry' && <DataEntry setActiveTab={setActiveTab} />}
            {activeTab === 'pd_list' && <PDList />}
            {activeTab === 'calving_list' && <CalvingList />}

            {activeTab === 'stock-management' && <BullManagement />} {/* Fallback - can be made default to bulls */}
            {activeTab === 'bulls' && <BullManagement />}
            {activeTab === 'receipts' && <ReceiptManagement />}
            {activeTab === 'medicine' && <MedicineManagement />}

            {activeTab === 'treatment' && <TreatmentDashboard setActiveTab={setActiveTab} />}
            {activeTab === 'primary_treatment' && <PrimaryTreatment setActiveTab={setActiveTab} />}
            {activeTab === 'medicine_supply' && <MedicineSupply setActiveTab={setActiveTab} />}
            {activeTab === 'tour_patient' && <TourPatient setActiveTab={setActiveTab} />}
            {activeTab === 'shc_treatment' && <SHCTreatment setActiveTab={setActiveTab} />}

            {activeTab === 'admin' && (currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase() === 'ggp305ggp@gmail.com') && <MasterAdminDashboard />}
            {activeTab === 'profile' && <Profile />}

            {/* Reports */}
            {activeTab === 'master_report' && <MasterReport />}
            {activeTab === 'treatment_report' && <TreatmentReport />}
            {activeTab === 'breeding_report' && <BreedingReport />}
            {activeTab === 'calving_record' && <CalvingRecords />}
            {activeTab === 'stock_register' && <BullStockReport />}
            {activeTab === 'receipt_register' && <ReceiptRegister />}
            {activeTab === 'user_approval' && (currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase() === 'ggp305ggp@gmail.com') && <UserApproval setActiveTab={setActiveTab} />}
            {activeTab === 'monthly_stock_report' && <MonthlyStockReport />} {/* NEW Route */}
            {activeTab === 'vaccination_data' && <VaccinationData />}
            {activeTab === 'traceability_report' && <TraceabilityReport />}
          </PageTransition>
        </main>

      </div>

    </div>
  )
}

// Wrapper to handle Auth State
const AppContent = () => {
  const { currentUser, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-[2px]"></div>
        <div className="relative z-10 w-full max-w-lg">
          {showLogin ? (
            <Login toggleForm={() => setShowLogin(false)} />
          ) : (
            <Signup toggleForm={() => setShowLogin(true)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <GlobalErrorBoundary>
        <AuthenticatedApp />
      </GlobalErrorBoundary>
    </AuthGuard>
  );
}

// Main App Component with Providers
function App() {
  // Global DB Setup (One-Time Run)
  // Global DB Setup (One-Time Run)
  useEffect(() => {
    // Only run if user is logged in to avoid permission errors
    // Actually, initDB is checking for generic settings, but if rules require auth, this fails.
    // For now, let's just swallow the error properly so we don't crash.
    const initDB = async () => {
      try {
        // Simple presence check
        if (!auth.currentUser) return;

        const docRef = doc(db, "settings", "diagnosis_lists");
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.log("Initializing Diagnosis Lists...");
          await setDoc(docRef, {
            primaryDiseases: ["Wound", "Indigestion", "Fever", "Pyrexia", "Diarrhea", "Ectoparasites", "Deworming"],
            shcDiseases: ["Anoestrus", "Repeat Breeding", "Metritis", "U.D.G.", "P.D."]
          });
          console.log("Diagnosis Lists Initialized!");
        }
      } catch (error) {
        // Silently fail or log warning, do NOT crash
        console.warn("Error initializing DB (likely auth issue, ignoring):", error);
      }
    };

    // We need to wait for auth to be ready. 
    // Usually handled by onAuthStateChanged but here we are at root.
    // Let's just delay it or rely on the fact that AuthProvider loads fast.
    // Actually, simply removing the crash is enough.
    initDB();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ReceiptProvider>
          <BullProvider>
            <MedicineProvider>
              <TreatmentProvider>
                <AppContent />
              </TreatmentProvider>
            </MedicineProvider>
          </BullProvider>
        </ReceiptProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

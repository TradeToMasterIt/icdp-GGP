import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../db';

const AuthGuard = ({ children }) => {
    const { currentUser } = useAuth();

    if (!currentUser) return null;

    if (currentUser.accessStatus === 'Pending') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-teal-100">
                    <div className="text-6xl mb-4">⏳</div>
                    <h2 className="text-2xl font-bold text-teal-800 mb-2">Access Pending</h2>
                    <p className="text-gray-600 mb-6 font-medium">
                        Your account is waiting for Administrator approval.
                    </p>
                    <p className="text-sm text-gray-400 mb-8 border-t border-b py-4 border-gray-100">
                        Please contact the admin to activate your account.<br />
                        <span className="font-mono text-xs mt-2 block bg-gray-50 p-1 rounded">UID: {currentUser.uid.slice(0, 8)}...</span>
                    </p>
                    <button
                        onClick={() => signOut(auth)}
                        className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    if (currentUser.accessStatus === 'Blocked') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 font-sans text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
                    <div className="text-6xl mb-4">🚫</div>
                    <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6 font-medium">
                        Your account has been suspended by the Administrator.
                    </p>
                    <button
                        onClick={() => signOut(auth)}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition shadow-lg"
                    >
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    return children;
};

export default AuthGuard;

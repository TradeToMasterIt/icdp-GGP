import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth'; // Import reset function
import { auth } from '../db'; // Import auth instance

const Login = ({ toggleForm }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState({ type: '', text: '' });

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await login(email, password);
            // App.jsx will handle redirect automatically based on auth state
        } catch (err) {
            setError('Failed to log in: ' + err.message);
            console.error(err);
        }
        setLoading(false);
    };

    // Password Reset Handler
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        console.log("Attempting to send reset email to:", resetEmail); // DEBUG

        if (!resetEmail) {
            setResetMessage({ type: 'error', text: 'Please enter an email address.' });
            return;
        }

        try {
            setResetMessage({ type: '', text: 'Sending...' });
            await sendPasswordResetEmail(auth, resetEmail);
            console.log("Reset email sent successfully.");

            setResetMessage({ type: 'success', text: '✅ Reset link sent! Check your email (and Spam folder).' });
            setTimeout(() => {
                setShowResetModal(false);
                setResetMessage({ type: '', text: '' });
                setResetEmail('');
            }, 5000); // Increased time to read message
        } catch (error) {
            console.error("Password Reset Error:", error);

            let msg = '❌ Error: Could not send email.';
            if (error.code === 'auth/user-not-found') msg = '❌ User not found.';
            else if (error.code === 'auth/invalid-email') msg = '❌ Invalid email address.';
            else if (error.code === 'auth/too-many-requests') msg = '❌ Too many requests. Try again later.';

            setResetMessage({ type: 'error', text: msg });
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col items-center">





            {/* Title */}
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md tracking-wide font-sans">GGPATEL</h2>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg tracking-wider mt-1">Login</h1>
            </div>

            {/* Error Message */}
            {error && <div className="w-full mb-4 p-3 text-sm text-red-200 bg-red-900/50 border border-red-500/50 rounded-lg text-center backdrop-blur-sm">{error}</div>}

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-5">

                {/* User ID / Email */}
                <div>
                    {/* Using a visual placeholder for the pre-filled ID style in the image */}
                    <div className="relative">
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 text-lg text-white bg-gray-800/60 border-b-2 border-gray-400 focus:border-white focus:bg-gray-800/80 outline-none transition-all placeholder-gray-400 font-medium"
                            placeholder="User ID"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        {/* Simulating the 'Change User ID' text from image if likely static, otherwise just a helper */}
                        <p className="text-xs text-right text-gray-300 mt-1 cursor-pointer hover:text-white">Change User ID</p>
                    </div>
                </div>

                {/* Password */}
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="w-full px-4 py-3 text-lg text-white bg-white/10 border-b-2 border-white/30 focus:border-white focus:bg-white/20 outline-none transition-all placeholder-gray-200"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <div
                        className="absolute right-3 top-3.5 text-white/70 cursor-pointer hover:text-white transition-colors select-none"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? '👁️' : '🔒'}
                    </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-white text-sm font-medium mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Remember Me
                    </label>
                    <button type="button" onClick={() => setShowResetModal(true)} className="hover:underline text-gray-200 hover:text-white">
                        Forgot Password
                    </button>
                </div>

                {/* Login Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-white text-blue-900 text-xl font-bold uppercase tracking-wider roundedShadow hover:bg-gray-100 transition-all transform hover:scale-[1.02] shadow-xl mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? 'Verifying...' : 'Login'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-white/50">Don't have an account? <button onClick={toggleForm} className="text-white font-bold hover:underline">Sign Up</button></p>
            </div>



            {/* Forgot Password Modal (kept functionality, updated style slightly for consistency) */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reset Password</h3>
                        <p className="text-sm text-gray-500 mb-4">Enter your email to receive a reset link.</p>

                        <form onSubmit={handlePasswordReset}>
                            <input
                                type="email"
                                required
                                className="w-full p-3 mb-4 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Email address"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                            />

                            {resetMessage.text && (
                                <div className={`mb-4 p-2 text-sm text-center rounded ${resetMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {resetMessage.text}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                                <button type="submit" className="flex-1 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">Send</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;

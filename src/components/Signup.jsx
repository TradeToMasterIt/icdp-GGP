import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../db';

const Signup = ({ toggleForm }) => {
    const { signup } = useAuth();
    const [email, setEmail] = useState('');
    const [name, setName] = useState(''); // Added Name state
    const [mobile, setMobile] = useState(''); // Added Mobile state
    const [centerName, setCenterName] = useState(''); // Added Center Name state
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false); // Track success state

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }

        try {
            setError('');
            setLoading(true);
            await signup(email, password, name, mobile, centerName);
            setSuccess(true); // Show success message
            await signOut(auth); // Force Logout immediately to prevent easier access
            // toggleForm(); // Optional: Redirect to login immediately if preferred
        } catch (err) {
            setError('Failed to create account: ' + err.message);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-teal-200 text-center">
                <div className="text-5xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold text-teal-800 mb-2">Registration Successful</h2>
                <p className="text-gray-600 mb-6">
                    Your account has been created and is <strong>waiting for Admin approval</strong>.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                    Please contact the Administrator to activate your account.
                </p>
                <button
                    onClick={toggleForm}
                    className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-bold"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return (

        <div className="w-full max-w-md p-8 bg-white shadow-card rounded-2xl border border-secondary-100">
            <h2 className="text-3xl font-bold text-center font-heading text-secondary-900 mb-2">Create Account</h2>
            <p className="text-center text-sm text-secondary-500 mb-8">Join the GGPATEL platform</p>
            {error && <div className="p-4 mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl animate-pulse">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Full Name</label>
                    <input
                        type="text"
                        required
                        className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Dr. John Doe"
                    />
                </div>
                <div>
                    <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Mobile Number</label>
                    <input
                        type="tel"
                        required
                        className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="1234567890"
                    />
                </div>
                <div>
                    <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Center Name</label>
                    <input
                        type="text"
                        required
                        className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        value={centerName}
                        onChange={(e) => setCenterName(e.target.value)}
                        placeholder="Idar Sub-Center"
                    />
                </div>
                <div>
                    <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Email Address</label>
                    <input
                        type="email"
                        required
                        className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block mb-1.5 text-sm font-semibold text-secondary-700">Confirm</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 text-secondary-900 bg-secondary-50 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 py-3.5 px-4 text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
            </form>

            <div className="text-center mt-6 text-sm text-secondary-500">
                Already have an account? <button onClick={toggleForm} className="font-bold text-primary-600 hover:text-primary-700 hover:underline transition-colors">Log In</button>
            </div>
        </div>
    );
};

export default Signup;

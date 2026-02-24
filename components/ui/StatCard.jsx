import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ icon, value, label, trend, color = "emerald" }) => {
    // Dynamic color classes
    const colorClasses = {
        emerald: "text-emerald-600 bg-emerald-100",
        orange: "text-orange-600 bg-orange-100",
        blue: "text-blue-600 bg-blue-100",
        purple: "text-purple-600 bg-purple-100",
        red: "text-red-600 bg-red-100",
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100 transition-shadow hover:shadow-lg"
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-1">{label}</p>
                    <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
                    {trend && (
                        <p className={`text-xs font-bold mt-2 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {trend} from last month
                        </p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.emerald}`}>
                    <span className="text-2xl">{icon}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default StatCard;

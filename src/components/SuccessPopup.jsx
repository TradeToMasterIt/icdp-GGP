import React from 'react';

const SuccessPopup = ({ entry, onClose }) => {
    if (!entry) return null;

    // Construct the message
    const message = `Veterinary Receipt:
A.I. done for ${entry.jati} (Tag: ${entry.tagNo}).
Bull: ${entry.bullName} (${entry.semenType || 'N/A'}).
Date: ${entry.date.split('-').reverse().join('/')}.
Receipt No: ${entry.receiptNo}.
- Please keep for records.`;

    const encodedMessage = encodeURIComponent(message);

    // WhatsApp URL
    // If mobile number exists, append it. Format: https://wa.me/919876543210?text=...
    // Assuming entry.mobileNumber might be just 10 digits, we might need country code. 
    // Usually wa.me works best with country code. Defaulting to just text if no number, or trying to append if present.
    let whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    if (entry.mobileNumber && entry.mobileNumber.length >= 10) {
        // Strip non-digits
        const cleanNumber = entry.mobileNumber.replace(/\D/g, '');
        // If it looks like a local number without country code (10 digits), maybe prepend 91 for India? 
        // The user context implies 'Jati', 'GIR', likely India context. 
        // Safest is to just use what is typed or let user select contact if generic.
        // But requirement says "If ... pre-fill it".
        // Let's assume input needs to be generic or auto-handled. 
        // https://wa.me/<number>/?text=...
        // If I put just the number, it might work if valid.
        whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    }

    // SMS URL
    // sms:<number>?body=<message> (Android mostly) or sms:?&body= (iOS) - standardizing on generic
    let smsUrl = `sms:?body=${encodedMessage}`;
    if (entry.mobileNumber) {
        smsUrl = `sms:${entry.mobileNumber}?body=${encodedMessage}`;
    }

    const handleWhatsApp = () => {
        window.open(whatsappUrl, '_blank');
    };

    const handleSMS = () => {
        window.location.href = smsUrl;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 p-6 space-y-6">

                <div className="text-center space-y-2">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900">A.I. Done Successfully!</h2>
                    <p className="text-gray-500 text-lg">
                        Receipt <span className="font-mono font-bold text-gray-800">#{entry.receiptNo}</span> saved for <span className="font-semibold text-teal-700">{entry.ownerName}</span>.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleWhatsApp}
                        className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.889-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                        Send via WhatsApp
                    </button>

                    <button
                        onClick={handleSMS}
                        className="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                        Send via SMS
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition-colors mt-2"
                    >
                        Close / New Entry
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessPopup;

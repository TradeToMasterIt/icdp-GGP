import React from 'react';

const PregnancySafetyPopup = ({
    existingEntry,
    onCancel,
    onCorrection
}) => {
    if (!existingEntry) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 p-6 space-y-6 border-t-8 border-red-500">

                <div className="text-center space-y-2">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-2">
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900">Safety Lock Active!</h2>
                    <p className="text-gray-600 text-sm font-medium">
                        Tag <span className="font-mono font-bold text-lg">{existingEntry.tagNo}</span> is marked as <span className="text-red-600 font-bold uppercase">PREGNANT</span>.
                    </p>
                    <p className="text-xs text-gray-400">
                        Last A.I.: {existingEntry.date} • {existingEntry.bullName}
                    </p>
                </div>

                <div className="space-y-3 pt-2">
                    {/* Correction Options Grid */}
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status Correction Options</p>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => onCorrection('Calving')}
                            className="flex flex-col items-center justify-center p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition shadow-sm group"
                        >
                            {/* Calving Icon (Sparkles/Life) */}
                            <svg className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-bold text-green-800 mt-1">Calving</span>
                        </button>

                        <button
                            onClick={() => onCorrection('P.D. -ve')}
                            className="flex flex-col items-center justify-center p-3 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition shadow-sm group"
                        >
                            {/* P.D. -ve Icon (Search w/ minus or warning) */}
                            <svg className="w-8 h-8 text-orange-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span className="text-xs font-bold text-orange-800 mt-1">P.D. -ve</span>
                        </button>

                        <button
                            onClick={() => onCorrection('Abortion')}
                            className="flex flex-col items-center justify-center p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition shadow-sm group"
                        >
                            {/* Abortion Icon (X Circle) */}
                            <svg className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-bold text-red-800 mt-1">Abortion</span>
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                        {/* Option A: Cancel / Oops */}
                        <button
                            onClick={onCancel}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Start Over (Wrong Tag)
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PregnancySafetyPopup;

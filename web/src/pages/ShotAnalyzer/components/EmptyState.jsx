/**
 * EmptyState.jsx
 * 
 * Empty state component for Shot Analyzer
 * Explains the dual-source system to users
 */

export function EmptyState() {
    return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
            <div className="max-w-2xl text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <svg className="w-20 h-20 text-base-content/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                    </svg>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-base-content">
                    Shot Deep Dive Analyzer
                </h2>

                {/* Description */}
                <div className="space-y-4 text-left bg-base-200 rounded-lg p-6">
                    <p className="text-sm text-base-content/80 leading-relaxed">
                        This tool analyzes espresso shots from <strong>two sources</strong>:
                    </p>

                    {/* GaggiMate Source */}
                    <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-lg">
                            🤖
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-base-content mb-1">GaggiMate Controller</h3>
                            <p className="text-sm text-base-content/70">
                                Your saved shots and profiles from the controller.
                                Automatically loaded when connected.
                            </p>
                        </div>
                    </div>

                    {/* Browser Source */}
                    <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-lg">
                            🌐
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-base-content mb-1">Browser Uploads</h3>
                            <p className="text-sm text-base-content/70">
                                Temporary shots uploaded for analysis.
                                Stored locally in your browser, <strong>not saved to GaggiMate</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Filter Tip */}
                    <div className="pt-3 border-t border-base-content/10">
                        <p className="text-xs text-base-content/60 flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            <span>
                                Use the source filter <span className="font-mono bg-base-300 px-1 py-0.5 rounded text-[10px]">All (SRC) / GM / Browser (WEB)</span> to show/hide shots from each source
                            </span>
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="pt-4">
                    <p className="text-sm text-base-content/60 mb-3">
                        Import a shot or profile to get started
                    </p>
                    <div className="flex gap-3 justify-center">
                        <div className="px-4 py-2 bg-base-100 text-primary font-bold text-sm border-2 border-dashed border-primary rounded-lg">
                            IMPORT
                        </div>
                        <div className="px-4 py-2 bg-base-200 text-base-content/40 font-semibold text-sm border-2 border-base-300 rounded-lg">
                            Click to open library
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

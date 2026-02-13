/**
 * EmptyState.jsx
 * * Empty state component for Shot Analyzer.
 * Explains the dual-source system to users.
 */

import DeepDiveLogoOutline from './assets/deepdive.svg';

export function EmptyState() {
    return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
            <div className="max-w-2xl text-center space-y-6">
                
                {/* Logo: Masked Div for Theme Color Adaptation */}
                <div 
                    className="w-16 h-16 mx-auto bg-base-content opacity-30"
                    style={{
                        maskImage: `url(${DeepDiveLogoOutline})`,
                        WebkitMaskImage: `url(${DeepDiveLogoOutline})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center'
                    }}
                />

                <h2 className="text-2xl font-bold text-base-content">
                    Shot Deep Dive Analyzer
                </h2>

                <div className="space-y-4 text-left bg-base-200/50 rounded-lg p-6 border border-base-content/5">
                    <p className="text-sm text-base-content/80 leading-relaxed">
                        This tool analyzes espresso shots from <strong>two sources</strong>:
                    </p>

                    <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-base-content/5">
                            <img src="/gm.svg" alt="GM" className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-base-content text-sm mb-0.5">GaggiMate Controller</h3>
                            <p className="text-xs text-base-content/60">
                                Your saved shots and profiles from the controller.
                                Automatically loaded when connected.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-secondary/10 text-secondary rounded-full flex items-center justify-center text-sm font-bold">WEB</div>
                        <div className="flex-1">
                            <h3 className="font-bold text-base-content text-sm mb-0.5">Browser Uploads</h3>
                            <p className="text-xs text-base-content/60">
                                Import .json shot and profile files for analysis.
                                Drag and drop or click the import button to upload.
                            </p>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-base-content/10 space-y-1.5">
                        <p className="text-xs text-base-content/50">
                            Use the source filter in the table header to show/hide shots from each source.
                        </p>
                        <p className="text-xs text-base-content/40">
                            Toggle between <strong className="text-base-content/60">View Temporarily</strong> and <strong className="text-base-content/60">Save in Browser</strong> in the toolbar to control whether imported files are kept across sessions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
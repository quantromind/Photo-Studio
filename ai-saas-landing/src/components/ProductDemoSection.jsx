import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function ProductDemoSection() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);
    const rotateX = useTransform(scrollYProgress, [0, 0.5], [20, 0]);
    const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

    return (
        <section id="demo" ref={containerRef} className="py-32 relative perspective-[1000px]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Experience the platform</h2>
                    <p className="text-muted text-lg max-w-2xl mx-auto">
                        Interact with real-time model alignment before deploying to production.
                    </p>
                </div>

                <motion.div
                    style={{ scale, rotateX, opacity }}
                    className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-accent1/10 bg-surface/50 backdrop-blur-3xl mx-auto max-w-5xl"
                >
                    {/* Mock Browser Header */}
                    <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/[0.02]">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        <div className="mx-auto px-32 py-1 rounded bg-black/40 border border-white/5 text-xs text-muted font-mono flex items-center justify-center">
                            nexus.ai/dashboard
                        </div>
                    </div>

                    {/* Mock Dashboard Body */}
                    <div className="relative aspect-video bg-[#050505] flex flex-col items-center justify-center p-8 overflow-hidden">
                        {/* Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />

                        {/* Glowing orb behind dashboard */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent1/20 rounded-full blur-[80px]" />

                        <div className="relative z-10 w-full max-w-3xl glass-panel p-6 rounded-xl flex flex-col gap-4 border border-white/10 shadow-2xl">
                            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent1 to-accent2 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(192,132,252,0.5)]">N</div>
                                    <div className="text-sm font-medium text-primary">Model Alignment Engine v2.0</div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mt-1" />
                                    <span className="text-xs text-muted font-mono">Connected</span>
                                </div>
                            </div>

                            <div className="w-full h-40 rounded bg-black border border-white/5 p-4 font-mono text-sm overflow-hidden flex flex-col gap-2 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
                                <span className="text-muted">{">"} Initialize Nexus_Core... <span className="text-green-400">OK [12ms]</span></span>
                                <span className="text-muted">{">"} Establishing secure tunnel... <span className="text-green-400">OK [45ms]</span></span>
                                <span className="text-accent2">{">"} Syncing vector embeddings... 100%</span>
                                <span className="text-accent1 relative pl-4">
                                    <span className="absolute left-0 top-1 w-1 h-3 bg-accent1 animate-pulse" />
                                    Awaiting prompt input...
                                </span>
                            </div>

                            <div className="flex gap-4 mt-2">
                                <div className="flex-1 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center px-4 text-muted text-sm shadow-inner transition-colors hover:bg-white/10 cursor-text">
                                    Generate a neural network architecture...
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-12 h-12 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-shadow hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
                                >
                                    →
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

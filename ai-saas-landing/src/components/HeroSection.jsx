import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';

const AnimatedSphere = () => {
    const sphereRef = useRef(null);

    useFrame((state) => {
        if (sphereRef.current) {
            sphereRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
            sphereRef.current.rotation.x = state.clock.elapsedTime * 0.2;
            sphereRef.current.rotation.y = state.clock.elapsedTime * 0.3;
        }
    });

    return (
        <Sphere ref={sphereRef} args={[1, 64, 64]} scale={2}>
            <MeshDistortMaterial
                color="#c084fc"
                attach="material"
                distort={0.4}
                speed={1.5}
                roughness={0.2}
                metalness={0.8}
                clearcoat={1}
            />
        </Sphere>
    );
};

export default function HeroSection() {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-hero-glow rounded-full blur-[120px] opacity-30 animate-pulse-glow -z-10" />

            {/* 3D Element */}
            <div className="absolute top-1/2 right-10 -translate-y-1/2 w-[400px] h-[400px] opacity-40 -z-10 hidden lg:block">
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <AnimatedSphere />
                </Canvas>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
                <div className="max-w-3xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs font-semibold text-accent1 mb-6"
                    >
                        <span className="w-2 h-2 rounded-full bg-accent1 animate-pulse" />
                        NexusAI 2.0 is now live
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[1.1]"
                    >
                        Intelligence, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent1 via-accent2 to-accent3 text-glow">
                            Amplified.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="text-lg md:text-xl text-muted mb-10 max-w-xl leading-relaxed"
                    >
                        The world's most powerful reasoning engine right at your fingertips. Build, scale, and ship AI applications at the speed of thought.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4"
                    >
                        <button className="px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors button-glow flex items-center justify-center gap-2">
                            Start Building Free
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-[2px]"><path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                        </button>
                        <button className="px-8 py-4 glass-panel font-semibold rounded-full hover:bg-white/10 transition-colors flex items-center justify-center">
                            Read the documentation
                        </button>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

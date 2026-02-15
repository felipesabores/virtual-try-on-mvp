"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import type { FaceMesh as FaceMeshType, Results } from '@mediapipe/face_mesh';
import type { Camera as CameraType } from '@mediapipe/camera_utils';
// Actually, simple rAF loop with video element is often enough and less buggy than camera_utils in React strict mode.
// But let's try to stick to standard MP usage if possible, or manual loop.
// For MVP, manual loop with requestAnimationFrame is robust.

import GlassesModel from './GlassesModel';
import { calculateFaceOrientation, landmarkToVector3, ANCHOR_POINTS } from '../utils/math';

// Mock data for glasses
const GLASSES_LIST = [
    { id: 1, name: 'Classic Aviator', model: '/models/glasses1.glb', scale: 1.1 },
    { id: 2, name: 'Modern Square', model: '/models/glasses2.glb', scale: 1.0 },
    { id: 3, name: 'Retro Round', model: '/models/glasses3.glb', scale: 1.05 },
];

export default function VirtualTryOn() {
    const webcamRef = useRef<Webcam>(null);
    const [selectedGlasses, setSelectedGlasses] = useState(GLASSES_LIST[0]);
    const [faceMatrix, setFaceMatrix] = useState<{ position: THREE.Vector3, rotation: THREE.Euler } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize MediaPipe Face Mesh
    useEffect(() => {
        let camera: CameraType | null = null;
        let faceMesh: FaceMeshType | null = null;

        const initMediaPipe = async () => {
            const { FaceMesh } = await import('@mediapipe/face_mesh');
            const { Camera } = await import('@mediapipe/camera_utils');

            faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                },
            });

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            faceMesh.onResults(onResults);

            if (typeof webcamRef.current !== 'undefined' && webcamRef.current !== null && webcamRef.current.video) {
                camera = new Camera(webcamRef.current.video, {
                    onFrame: async () => {
                        if (webcamRef.current?.video && faceMesh) {
                            await faceMesh.send({ image: webcamRef.current.video });
                        }
                    },
                    width: 1280,
                    height: 720
                });
                camera.start();
            }
        };

        initMediaPipe();

        return () => {
            // Cleanup if possible. MediaPipe doesn't always expose easy cleanup/stop for Camera.
            // camera?.stop(); // Camera utils usually has stop? check types.
            // faceMesh?.close();
        }
    }, []); // Run once

    const onResults = useCallback((results: Results) => {
        setIsLoading(false);
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            // Create a timeout to hide the glasses if face is lost for too long?
            // For MVP, just keep last known or null? 
            // setFaceMatrix(null); // This causes flickering. Better to keep last position or interpolate.
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const videoWidth = webcamRef.current?.video?.videoWidth || 1280;
        const videoHeight = webcamRef.current?.video?.videoHeight || 720;

        // 1. Calculate Position
        // Use Nose Bridge (168) as the anchor point for the glasses
        const noseBridge = landmarks[ANCHOR_POINTS.NOSE_BRIDGE];
        const position = landmarkToVector3(noseBridge, videoWidth, videoHeight);

        // 2. Calculate Rotation
        const rotation = calculateFaceOrientation(landmarks, videoWidth, videoHeight);

        setFaceMatrix({ position, rotation });
    }, []);

    const handleLike = () => {
        console.log(`Gostei deste modelo: ${selectedGlasses.name} (ID: ${selectedGlasses.id})`);
        alert(`Você gostou do modelo: ${selectedGlasses.name}!`);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">
            {/* 1. Camera Feed */}
            <Webcam
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                mirrored
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
                onUserMediaError={(e) => console.error("Camera error:", e)}
            />

            {/* 2. 3D Overlay */}
            <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 1000], fov: 45 }}>
                    {/* 
               FOV and Camera position need to match the video feed somewhat.
               For AR, usually you want an orthographic camera or match the video aspect ratio.
               Position logic in math.ts maps normalized coords to pixels, 
               so we need a camera that views 'width x height' units at Z=0?
               Or easier: Render 3D scene 'on top' with a fixed camera.
             */}
                    <ambientLight intensity={0.5} />
                    <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                    <pointLight position={[-10, -10, -10]} />

                    <React.Suspense fallback={null}>
                        {faceMatrix && (
                            <GlassesModel
                                modelUrl={selectedGlasses.model}
                                position={faceMatrix.position}
                                rotation={faceMatrix.rotation}
                                scale={selectedGlasses.scale * 10} // Scale up because MP coords are in pixels (0..1280)
                            />
                        )}
                    </React.Suspense>
                </Canvas>
            </div>

            {/* 3. UI Overlay */}
            {isLoading && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-white font-bold text-xl bg-black/50 p-4 rounded-xl">
                    Inicializando Câmera...
                </div>
            )}

            {/* Carousel */}
            <div className="absolute bottom-8 left-0 w-full z-20 flex flex-col items-center space-y-4">

                {/* Like Button */}
                <button
                    onClick={handleLike}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 active:scale-95 mb-4"
                >
                    Gostei deste modelo
                </button>

                {/* Selector */}
                <div className="flex space-x-4 overflow-x-auto p-2 bg-white/20 backdrop-blur-md rounded-2xl mx-4">
                    {GLASSES_LIST.map((glasses) => (
                        <button
                            key={glasses.id}
                            onClick={() => setSelectedGlasses(glasses)}
                            className={`relative w-24 h-24 rounded-xl border-4 overflow-hidden transition-all ${selectedGlasses.id === glasses.id ? 'border-yellow-400 scale-110' : 'border-transparent opacity-70'
                                }`}
                        >
                            {/* Thumbnail Placeholder - In real app use stats images */}
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-white text-center p-1">
                                {glasses.name}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import type { FaceMesh as FaceMeshType, Results } from '@mediapipe/face_mesh';
import type { Camera as CameraType } from '@mediapipe/camera_utils';
// Actually, simple rAF loop with video element is often enough and less buggy than camera_utils in React strict mode.
// But let's try to stick to standard MP usage if possible, or manual loop.
// For MVP, manual loop with requestAnimationFrame is robust.

import GlassesModel from './GlassesModel';
import { calculateFaceQuaternion, landmarkToVector3, ANCHOR_POINTS } from '../utils/math';

// Helper component to adjust camera Z so 1 unit = 1 pixel at Z=0
function CameraRig() {
    const { camera, size } = useThree();
    useEffect(() => {
        const cam = camera as THREE.PerspectiveCamera;
        if (!cam.isPerspectiveCamera) return;

        const rad = (cam.fov * Math.PI) / 180;
        // Calculate distance to fit height exactly at Z=0 plane
        // dist = height / (2 * tan(fov/2))
        const dist = size.height / (2 * Math.tan(rad / 2));
        cam.position.z = dist;
        cam.updateProjectionMatrix();
    }, [camera, size]);
    return null;
}

// Mock data for glasses
const GLASSES_LIST = [
    // Model 1: User image shows upside down. 
    // Trying 180 degrees Z rotation to flip it up/down and left/right.
    {
        id: 1,
        name: 'Classic Aviator',
        model: '/models/glasses1.glb',
        scale: 1.0,
        rotationOffset: new THREE.Euler(-Math.PI * 3 / 4, 0, Math.PI)
    },
    // Model 2: User says this was good with the previous -90 X fix.
    {
        id: 2,
        name: 'Modern Square',
        model: '/models/glasses2.glb',
        scale: 1.0,
        rotationOffset: new THREE.Euler(-Math.PI / 2, 0, 0)
    },
    // Model 3: Assuming similar to 2 for now
    {
        id: 3,
        name: 'Retro Round',
        model: '/models/glasses3.glb',
        scale: 1.0,
        rotationOffset: new THREE.Euler(-Math.PI / 2, 0, 0)
    },
    // Model 4: New model
    {
        id: 4,
        name: 'Bold Wayfarer',
        model: '/models/glasses4.glb',
        scale: 1.0,
        rotationOffset: new THREE.Euler(-Math.PI / 2, 0, 0)
    },
    // Model 5: New model
    {
        id: 5,
        name: 'Slim Cat-Eye',
        model: '/models/glasses5.glb',
        scale: 1.0,
        rotationOffset: new THREE.Euler(-Math.PI / 2, 0, 0)
    },
];

export default function VirtualTryOn() {
    const webcamRef = useRef<Webcam>(null);
    const [selectedGlasses, setSelectedGlasses] = useState(GLASSES_LIST[0]);
    const [faceMatrix, setFaceMatrix] = useState<{
        position: THREE.Vector3,
        rotation: THREE.Quaternion,
        faceWidth: number,
        pupils?: { left: THREE.Vector3, right: THREE.Vector3 }
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false); // Toggle for debug visuals

    // Initialize MediaPipe Face Mesh
    useEffect(() => {
        let camera: CameraType | null = null;
        let faceMesh: FaceMeshType | null = null;

        const initMediaPipe = async () => {
            // Basic HTTPS check for non-localhost
            if (
                typeof window !== 'undefined' &&
                window.location.protocol !== 'https:' &&
                window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1'
            ) {
                setError("Camera requires HTTPS. Please use a secure connection or localhost.");
                return;
            }

            try {
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
                                try {
                                    await faceMesh.send({ image: webcamRef.current.video });
                                } catch (e) {
                                    console.error("FaceMesh send error:", e);
                                    // Don't set global error here to avoid spamming, just log
                                }
                            }
                        },
                        width: 1280,
                        height: 720
                    });
                    camera.start();
                }
            } catch (err: any) {
                console.error("MediaPipe Init Error:", err);
                setError(`Failed to initialize Face Mesh: ${err.message || err}`);
                setIsLoading(false);
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

        const videoRef = webcamRef.current?.video;
        if (!videoRef) {
            console.warn("Webcam video element not available for face calculations.");
            return;
        }

        const width = videoRef.clientWidth;   // Use displayed width
        const height = videoRef.clientHeight; // Use displayed height

        const landmarks = results.multiFaceLandmarks[0];

        // 1. Calculate Rotation (Quaternion)
        const rotation = calculateFaceQuaternion(landmarks, width, height);

        // 2. Calculate Face Width using temples (ear landmarks 234 <-> 454)
        // Temples give a realistic glasses-width measurement
        const leftTemple = landmarkToVector3(landmarks[ANCHOR_POINTS.LEFT_EAR], width, height);
        const rightTemple = landmarkToVector3(landmarks[ANCHOR_POINTS.RIGHT_EAR], width, height);
        const faceWidth = leftTemple.distanceTo(rightTemple);

        // 3. Pupil positions
        const leftPupil = landmarkToVector3(landmarks[ANCHOR_POINTS.LEFT_PUPIL], width, height);
        const rightPupil = landmarkToVector3(landmarks[ANCHOR_POINTS.RIGHT_PUPIL], width, height);

        // 4. Anchor = midpoint between pupils — glasses center on the eyes
        const position = new THREE.Vector3(
            (leftPupil.x + rightPupil.x) / 2,
            (leftPupil.y + rightPupil.y) / 2,
            (leftPupil.z + rightPupil.z) / 2
        );

        setFaceMatrix({ position, rotation, faceWidth, pupils: { left: leftPupil, right: rightPupil } });
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
                onUserMediaError={(e) => {
                    console.error("Camera error:", e);
                    const errStr = typeof e === 'string' ? e : (e as any).message || JSON.stringify(e);
                    setError(`Camera Error: ${errStr}. Ensure camera permissions are granted.`);
                    setIsLoading(false);
                }}
            />

            {/* 2. 3D Overlay - Mirrored to match Webcam */}
            <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
                {/* Remove fixed Z position, let Rig handle it */}
                <Canvas camera={{ fov: 45 }}>
                    <CameraRig />
                    <ambientLight intensity={0.5} />
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
                            <>
                                <GlassesModel
                                    modelUrl={selectedGlasses.model}
                                    position={faceMatrix.position}
                                    rotation={faceMatrix.rotation}
                                    scale={1.0} // Always 1.0, auto-scaled in component
                                    faceWidth={faceMatrix.faceWidth}
                                    rotationOffset={selectedGlasses.rotationOffset}
                                />
                                {/* Debug: Visualizing Anchor Points - ALWAYS ON TOP (Z offset) */}
                                {showDebug && (
                                    <>
                                        {/* Nose Bridge (Green) - Current Anchor */}
                                        <mesh position={[faceMatrix.position.x, faceMatrix.position.y, faceMatrix.position.z + 20]} scale={8}>
                                            <sphereGeometry args={[1, 16, 16]} />
                                            <meshBasicMaterial color="green" depthTest={false} transparent opacity={0.8} />
                                        </mesh>
                                        {/* Pupils (Red) - Optical Centers */}
                                        {faceMatrix.pupils && (
                                            <>
                                                <mesh position={[faceMatrix.pupils.left.x, faceMatrix.pupils.left.y, faceMatrix.pupils.left.z + 20]} scale={6}>
                                                    <sphereGeometry args={[1, 16, 16]} />
                                                    <meshBasicMaterial color="red" depthTest={false} transparent opacity={0.8} />
                                                </mesh>
                                                <mesh position={[faceMatrix.pupils.right.x, faceMatrix.pupils.right.y, faceMatrix.pupils.right.z + 20]} scale={6}>
                                                    <sphereGeometry args={[1, 16, 16]} />
                                                    <meshBasicMaterial color="red" depthTest={false} transparent opacity={0.8} />
                                                </mesh>
                                                {/* Midpoint (Blue) - Ideal Optical Center */}
                                                <mesh
                                                    position={[
                                                        (faceMatrix.pupils.left.x + faceMatrix.pupils.right.x) / 2,
                                                        (faceMatrix.pupils.left.y + faceMatrix.pupils.right.y) / 2,
                                                        (faceMatrix.pupils.left.z + faceMatrix.pupils.right.z) / 2 + 20
                                                    ]}
                                                    scale={6}
                                                >
                                                    <sphereGeometry args={[1, 16, 16]} />
                                                    <meshBasicMaterial color="blue" depthTest={false} transparent opacity={0.8} />
                                                </mesh>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
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

            {/* Error Display */}
            {error && (
                <div className="absolute top-10 left-4 right-4 z-[100] bg-red-600/90 text-white p-4 rounded-lg shadow-lg border border-red-400">
                    <h3 className="font-bold text-lg mb-1">Erro Detectado</h3>
                    <p className="font-mono text-sm break-words">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 bg-white text-red-600 px-4 py-2 rounded font-bold text-sm hover:bg-gray-100"
                    >
                        Recarregar Página
                    </button>
                    <button
                        onClick={() => setError(null)}
                        className="mt-3 ml-3 text-white underline text-sm"
                    >
                        Dispensar
                    </button>
                </div>
            )}

            {/* Debug Toggle */}
            <div className="absolute top-20 right-4 z-[60]">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="bg-black/50 text-white text-xs px-2 py-1 rounded border border-white/20"
                >
                    {showDebug ? "Hide Debug" : "Show Debug"}
                </button>
            </div>

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

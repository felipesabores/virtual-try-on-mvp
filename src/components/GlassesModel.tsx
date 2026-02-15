"use client";

import React, { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlassesModelProps {
    modelUrl: string;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale?: number;
}

export default function GlassesModel({ modelUrl, position, rotation, scale = 1 }: GlassesModelProps) {
    const { scene } = useGLTF(modelUrl);
    const groupRef = useRef<THREE.Group>(null);

    // Clone scene to avoid sharing state between instances (if multiple)
    const clone = React.useMemo(() => scene.clone(), [scene]);

    useFrame(() => {
        if (groupRef.current) {
            // Smooth interpolation for simple jitter reduction
            // Ideally use a more robust mock/filter, but lerp is okay for MVP
            const DAMPING = 0.5;

            // Position
            groupRef.current.position.lerp(position, DAMPING);

            // Rotation - generic Euler lerp is tricky, better to use Quaternions
            const targetQuat = new THREE.Quaternion().setFromEuler(rotation);
            groupRef.current.quaternion.slerp(targetQuat, DAMPING);
        }
    });

    return (
        <group ref={groupRef} dispose={null} scale={scale}>
            <primitive object={clone} />
        </group>
    );
}

// Preload models to avoid popping
// useGLTF.preload('/models/glasses1.glb'); // Enable when files exist

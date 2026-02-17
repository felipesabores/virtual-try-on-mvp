"use client";

import React, { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlassesModelProps {
    modelUrl: string;
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    scale: number; // This prop is no longer directly used for scaling, but kept in interface for compatibility if needed elsewhere.
    faceWidth: number;
    rotationOffset?: THREE.Euler; // Additional rotation per model
}

export default function GlassesModel({ modelUrl, position, rotation, faceWidth, rotationOffset }: GlassesModelProps) {
    const { scene } = useGLTF(modelUrl);
    const groupRef = useRef<THREE.Group>(null);
    const nativeWidthRef = useRef(0);

    // Clone scene to avoid sharing state between instances (if multiple)
    const clone = React.useMemo(() => scene.clone(), [scene]);

    // Calculate native width once per model load
    useEffect(() => {
        if (clone) {
            const box = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3();
            box.getSize(size);
            nativeWidthRef.current = size.x;
            console.log("GlassesModel: Native Width", size.x);
        }
    }, [clone]);

    useFrame(() => {
        if (!groupRef.current) return;

        // Smooth interpolation for simple jitter reduction
        // Ideally use a more robust mock/filter, but lerp is okay for MVP
        const DAMPING = 0.9;

        // Position
        // Add Z offset (+10) to prevent clipping. 
        // Add Y offset (-5) to lower glasses slightly down nose bridge (MP bridge is high)
        // Use Lerp for smoothing
        const targetPos = position.clone();
        targetPos.z += 10;
        targetPos.y -= 5;
        groupRef.current.position.lerp(targetPos, DAMPING);

        // Rotation - Face rotation is now a Quaternion
        const targetQuat = rotation.clone();

        // Apply 180 degree rotation around Y axis to fix orientation (face user, not camera)
        // Note: With CSS mirror and Raw coords, we might need to check this.
        // Standard GL models face +Z (or -Z). MP Z is forward?
        // Let's Keep the 180 flip as baseline for now.
        const correctionY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        targetQuat.multiply(correctionY);

        // Apply -90 degree rotation around X axis (pitch) if needed by model coordinates
        const correctionX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        targetQuat.multiply(correctionX);

        // Apply per-model offset (Euler -> Quat)
        if (rotationOffset) {
            const offsetQuat = new THREE.Quaternion().setFromEuler(rotationOffset);
            targetQuat.multiply(offsetQuat);
        }

        groupRef.current.quaternion.slerp(targetQuat, DAMPING);

        // Scale Logic (in frame loop to avoid state re-renders)
        if (nativeWidthRef.current > 0) {
            // Desired width = Face Width (Temple-to-Temple)
            // With CameraRig/ClientDim, this maps 1:1.
            const desiredWidth = faceWidth;
            const targetScale = (desiredWidth / nativeWidthRef.current); // Apply 1.0 base

            // Lerp current scale
            const currentScale = groupRef.current.scale.x;
            const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
            groupRef.current.scale.setScalar(newScale);
        }
    });

    return (
        <group ref={groupRef} dispose={null}>
            <primitive
                object={clone}
            // Removed scale prop to control it manually in useFrame for smoothing without re-renders
            />
        </group>
    );
}


// Preload models to avoid popping
// useGLTF.preload('/models/glasses1.glb'); // Enable when files exist

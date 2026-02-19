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
    const nativeHeightRef = useRef(0);

    // Clone scene to avoid sharing state between instances (if multiple)
    const clone = React.useMemo(() => scene.clone(), [scene]);

    // Store native bounding box dimensions once per model load
    useEffect(() => {
        if (clone) {
            const box = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3();
            box.getSize(size);
            nativeWidthRef.current = size.x;
            nativeHeightRef.current = size.y;
            console.log("GlassesModel: Native Size", size.x, size.y, size.z);
        }
    }, [clone]);

    useFrame(() => {
        if (!groupRef.current) return;

        // Smooth interpolation for simple jitter reduction
        // Ideally use a more robust mock/filter, but lerp is okay for MVP
        const DAMPING = 0.9;

        // Scale first so we can derive pixel-correct Y offset from the model's own size
        let currentScale = groupRef.current.scale.x;
        if (nativeWidthRef.current > 0) {
            const targetScale = faceWidth / nativeWidthRef.current;
            currentScale = THREE.MathUtils.lerp(currentScale || targetScale, targetScale, 0.15);
            groupRef.current.scale.setScalar(currentScale);
        }

        // Position — anchor is the pupil midpoint.
        // Shift Y down by half the rendered height so the lens center sits on the pupils.
        const targetPos = position.clone();
        if (nativeHeightRef.current > 0 && currentScale > 0) {
            targetPos.y -= (nativeHeightRef.current * currentScale) * 0.15; // slight downward nudge
        }
        targetPos.z += 5; // small Z push to avoid z-fighting with skin
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

        // (Scale already applied above, before position offset)
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
useGLTF.preload('/models/glasses1.glb');
useGLTF.preload('/models/glasses2.glb');
useGLTF.preload('/models/glasses3.glb');
useGLTF.preload('/models/glasses4.glb');
useGLTF.preload('/models/glasses5.glb');

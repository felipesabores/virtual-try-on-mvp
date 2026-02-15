import * as THREE from 'three';
import { NormalizedLandmark } from '@mediapipe/face_mesh';

// MediaPipe Face Mesh Keypoints
export const SILHOUETTE_IDS = [
  10,  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58,  132, 93,  234, 127, 162, 21,  54,  103, 67,  109
];

// Key landmarks for glasses positioning
// 168: Between eyes (Top of nose bridge)
// 6: Nose tip
// 33: Left eye inner corner
// 263: Right eye inner corner
// 133: Left eye outer corner
// 362: Right eye outer corner
export const ANCHOR_POINTS = {
  NOSE_BRIDGE: 168,
  NOSE_TIP: 4, // or 1?? 4 is tip of nose usually. Let's use 168 for anchoring glasses bridge.
  LEFT_EYE: 33,
  RIGHT_EYE: 263,
  LEFT_EAR: 234,
  RIGHT_EAR: 454
};

/**
 * Converts a normalized landmark (0-1) to Three.js world coordinates
 * @param landmark The normalized landmark from MediaPipe
 * @param width Width of the video feed/canvas
 * @param height Height of the video feed/canvas
 */
export const landmarkToVector3 = (landmark: NormalizedLandmark, width: number, height: number): THREE.Vector3 => {
  // MediaPipe: x is 0 (left) to 1 (right), y is 0 (top) to 1 (bottom)
  // Three.js: x is -width/2 to width/2, y is -height/2 to height/2 (up is positive)
  
  // We need to map 0..1 to -w/2..w/2 and -h/2..h/2
  // BUT: MediaPipe Y is down, Three.js Y is up. So we stick to MP coordinates for now or flip Y?
  // Usually easier to flip Y so +Y is up in 3D scene.
  
  const x = (landmark.x - 0.5) * width;
  const y = -(landmark.y - 0.5) * height; // Flip Y
  const z = -landmark.z * width; // Z is depth, roughly same scale as width? MP Z is relative to head width at image center.
  // We might need to scale Z. For now, let's try raw or scaled.
  // Actually, MP Z is "depth in terms of image width". So multiplying by width makes sense.
  
  return new THREE.Vector3(x, y, z);
};

/**
 * Calculates the rotation (Euler angles) of the head based on landmarks
 */
export const calculateFaceOrientation = (landmarks: NormalizedLandmark[], width: number, height: number): THREE.Euler => {
  if (!landmarks || landmarks.length === 0) return new THREE.Euler();

  // 1. Calculate Yaw (Left/Right rotation)
  // Use left and right eye outer corners or ears
  const left = landmarkToVector3(landmarks[ANCHOR_POINTS.LEFT_EYE], width, height);
  const right = landmarkToVector3(landmarks[ANCHOR_POINTS.RIGHT_EYE], width, height);
  
  const eyeVector = new THREE.Vector3().subVectors(right, left);
  // Yaw is rotation around Y axis.
  // atan2(dz, dx) gives yaw
  const yaw = Math.atan2(eyeVector.z, eyeVector.x);

  // 2. Calculate Pitch (Up/Down rotation)
  // Use nose bridge and nose tip? Or Top of head and chin?
  // Let's use Top (10) and Bottom (152) of face logic, or simpler nose vector.
  // Better: Midpoint of eyes vs Nose tip?
  // Let's try Nose Bridge (168) to Nose Tip (4).
  const noseBridge = landmarkToVector3(landmarks[ANCHOR_POINTS.NOSE_BRIDGE], width, height);
  const noseTip = landmarkToVector3(landmarks[4], width, height); // 4 is tip
  
  // Vector pointing out of face?
  // Alternatively, use eyes mid-point vs chin?
  // Let's stick to a simpler approach: 
  // Pitch is rotation around X axis.
  // atan2(dy, dz) or similar.
  // Actually, let's use global face mesh rotation matrix if possible, but we only have landmarks.
  // Standard approximation:
  // vector from nose bridge to chin
  const chin = landmarkToVector3(landmarks[152], width, height);
  const faceVertical = new THREE.Vector3().subVectors(chin, noseBridge);
  // Pitch = angle of faceVertical projected on YZ plane?
  // Ideally, faceVertical should be (0, -1, 0).
  // Pitch ~ atan2(z, y).
  // We need to offset by -PI/2 or similar since 'down' is -Y.
  const pitch = Math.atan2(faceVertical.z, faceVertical.y) + Math.PI / 2;


  // 3. Calculate Roll (Tilt left/right)
  // Rotation around Z axis.
  // Use eye vector.
  // atan2(dy, dx)
  const roll = Math.atan2(eyeVector.y, eyeVector.x);

  return new THREE.Euler(pitch, yaw, roll); // Order might need tweaking (YXZ or ZXY)
};

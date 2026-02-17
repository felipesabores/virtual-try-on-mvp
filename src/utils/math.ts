import * as THREE from 'three';
import { NormalizedLandmark } from '@mediapipe/face_mesh';

// MediaPipe Face Mesh Keypoints
export const SILHOUETTE_IDS = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
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
  RIGHT_EAR: 454,
  LEFT_PUPIL: 468,
  RIGHT_PUPIL: 473
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
 * Calculates a Quaternion representing the face orientation.
 * We construct a coordinate system where:
 * - X axis (Right): Vector from Left Temple to Right Temple (or pupils)
 * - Y axis (Up): Vector from Nose Tip to midpoint of eyes (or Forehead)
 * - Z axis (Forward): Cross product of X and Y (facing out from face)
 */
export const calculateFaceQuaternion = (
  landmarks: NormalizedLandmark[],
  width: number,
  height: number
): THREE.Quaternion => {
  // 1. Define vectors
  // Left/Right Eye (or Temple) for X axis
  const left = landmarkToVector3(landmarks[ANCHOR_POINTS.LEFT_EYE], width, height); // Outer corner
  const right = landmarkToVector3(landmarks[ANCHOR_POINTS.RIGHT_EYE], width, height); // Outer corner

  // 2. Construct Basis Vectors

  // X-Axis: Left to Right (Normalized)
  // Note: Three.js X is Right. Vector right - left.
  const xAxis = new THREE.Vector3().subVectors(right, left).normalize();

  // Y-Axis: Approximate Up vector.
  // Vector from Nose Tip to Nose Bridge is roughly Up.
  const noseBridge = landmarkToVector3(landmarks[ANCHOR_POINTS.NOSE_BRIDGE], width, height); // Need noseBridge
  const noseTip = landmarkToVector3(landmarks[ANCHOR_POINTS.NOSE_TIP], width, height); // Need noseTip
  const yAxis = new THREE.Vector3().subVectors(noseBridge, noseTip).normalize();

  // Z-Axis: Forward (Face Normal).
  // Cross Product of X and Y gives Z.
  // X cross Y -> Z (Right Hand Rule: X=Thumb, Y=Index, Z=Middle)
  // If X is Right, Y is Up, Z creates a right-handed system pointing OUT of face.
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  // Re-orthogonalize Y to ensure strict 90 degrees
  // Y = Z cross X
  yAxis.crossVectors(zAxis, xAxis).normalize();

  // 3. Create Rotation Matrix
  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

  // 4. Convert to Quaternion
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);

  return quaternion;
};

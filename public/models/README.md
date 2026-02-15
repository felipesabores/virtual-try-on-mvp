# 3D Models Directory

Place your `.glb` or `.gltf` files in this directory.

The application expects the following files by default:
- `glasses1.glb`
- `glasses2.glb`
- `glasses3.glb`

You can download free models from Sketchfab or other sources.
Ensure the models are centered at (0,0,0) and have a reasonable scale (unit size approx 14cm width).
If your models have different names, update the `GLASSES_LIST` constant in `src/components/VirtualTryOn.tsx`.

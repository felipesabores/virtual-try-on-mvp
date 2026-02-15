# Virtual Try-On MVP

A Mobile-First Virtual Try-On application using Next.js, MediaPipe Face Mesh, and React Three Fiber.

## Features
- **Real-time Face Tracking**: Uses MediaPipe Face Mesh to detect facial landmarks.
- **3D Glasses Overlay**: Anchors 3D models to the eyes and nose bridge.
- **Interactive UI**: Switch between different glasses models.
- **Mobile Optimized**: Designed for mobile browsers.

## Prerequisite
You must have Node.js installed.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Add 3D Models**:
    Place your `.glb` files in `public/models/`.
    - `public/models/glasses1.glb`
    - `public/models/glasses2.glb`
    - `public/models/glasses3.glb`

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) (or your local IP for mobile testing).

## Repository Setup

This project has been initialized with a local Git repository. To push to GitHub:

1.  Create a new repository on GitHub named `virtual-try-on-mvp`.
2.  Run the following commands:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/virtual-try-on-mvp.git
    git branch -M main
    git push -u origin main
    ```

## Technologies
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)

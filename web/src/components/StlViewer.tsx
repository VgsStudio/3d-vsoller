import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Bounds } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#5bc0de" roughness={0.45} metalness={0.1} />
    </mesh>
  );
}

export function StlViewer({ url }: { url: string }) {
  return (
    <div className="stl-viewer">
      <Canvas camera={{ position: [60, 60, 60], fov: 40 }}>
        {/* Self-contained lighting only — no external HDR/environment fetch,
            which is a hard dependency for a public site (a rate-limited or
            offline CDN would blank the whole page, as it did once here). */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[40, 60, 30]} intensity={1.1} />
        <directionalLight position={[-30, -20, -40]} intensity={0.3} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <Center>
              <Model url={url} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={1.2} />
      </Canvas>
      <div className="stl-viewer-hint">arraste pra girar · scroll pra zoom</div>
    </div>
  );
}

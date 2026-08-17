import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Stage } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry} castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#5bc0de" roughness={0.4} metalness={0.05} />
    </mesh>
  );
}

export function StlViewer({ url }: { url: string }) {
  return (
    <div className="stl-viewer">
      <Canvas camera={{ position: [60, 60, 60], fov: 40 }} shadows>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} adjustCamera={1.4}>
            <Center>
              <Model url={url} />
            </Center>
          </Stage>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={1.2} />
      </Canvas>
      <div className="stl-viewer-hint">arraste pra girar · scroll pra zoom</div>
    </div>
  );
}

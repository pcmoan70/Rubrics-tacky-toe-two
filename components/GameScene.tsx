import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { RubiksCube } from './Cube';

export const GameScene = () => {
  return (
    <div className="w-full h-full relative bg-gray-900">
      <Canvas camera={{ position: [5, 5, 7], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />
        
        <group>
            <RubiksCube />
        </group>

        <OrbitControls 
          enablePan={false} 
          minDistance={4} 
          maxDistance={15} 
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};

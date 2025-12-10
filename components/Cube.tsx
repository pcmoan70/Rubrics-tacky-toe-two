
import React, { useRef, useState, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { HOVER_COLOR } from '../constants';
import { Face } from '../types';

// --- 27 Cubies Implementation ---
const CUBIE_POSITIONS: [number, number, number][] = [];
for(let x=-1; x<=1; x++)
  for(let y=-1; y<=1; y++)
    for(let z=-1; z<=1; z++)
      CUBIE_POSITIONS.push([x, y, z]);

const FACE_CENTERS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1.6, 0),
  D: new THREE.Vector3(0, -1.6, 0),
  F: new THREE.Vector3(0, 0, 1.6),
  B: new THREE.Vector3(0, 0, -1.6),
  R: new THREE.Vector3(1.6, 0, 0),
  L: new THREE.Vector3(-1.6, 0, 0),
};

const getFaceFromIndex = (index: number): Face => {
  if (index >= 0 && index <= 8) return 'U';
  if (index >= 9 && index <= 17) return 'L';
  if (index >= 18 && index <= 26) return 'F';
  if (index >= 27 && index <= 35) return 'R';
  if (index >= 36 && index <= 44) return 'B';
  return 'D';
};

export const RubiksCube = () => {
  const { stickers, phase, placeTile, rotateFace, setIsAnimating, isAnimating, gameMode, lastPlacedStickerIndex } = useGameStore();
  const { camera } = useThree();
  
  const cubiesRef = useRef<(THREE.Object3D | null)[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  
  // Selection state for Twist Phase
  // stores which face is selected and the pending direction
  const [selection, setSelection] = useState<{ face: Face, clockwise: boolean } | null>(null);

  // Auto-placement state
  const [targetCameraPos, setTargetCameraPos] = useState<THREE.Vector3 | null>(null);

  // Helper: Get cubies belonging to a face
  const getCubiesForFace = (face: Face) => {
    return CUBIE_POSITIONS.map((pos, idx) => {
      const [x, y, z] = pos;
      switch(face) {
        case 'U': return y === 1 ? idx : -1;
        case 'D': return y === -1 ? idx : -1;
        case 'R': return x === 1 ? idx : -1;
        case 'L': return x === -1 ? idx : -1;
        case 'F': return z === 1 ? idx : -1;
        case 'B': return z === -1 ? idx : -1;
      }
    }).filter(i => i !== -1);
  };

  // Reset selection when phase changes or animation starts
  useEffect(() => {
    if (phase !== 'TWIST' || isAnimating) {
      setSelection(null);
    }
  }, [phase, isAnimating]);

  // --- RANDOM MODE LOGIC ---
  useEffect(() => {
    if (gameMode === 'RANDOM' && phase === 'PLACE' && !isAnimating) {
        // 1. Find all empty spots
        const emptyIndices = stickers.map((s, i) => s.owner === null ? i : -1).filter(i => i !== -1);
        
        if (emptyIndices.length > 0) {
            setIsAnimating(true); // Lock interaction
            
            // 2. Pick Random
            const rand = Math.floor(Math.random() * emptyIndices.length);
            const targetIndex = emptyIndices[rand];
            const targetFace = getFaceFromIndex(targetIndex);

            // 3. Determine camera position for that face
            // We'll calculate a vector that looks at the center of that face from a distance
            const faceNormal = FACE_CENTERS[targetFace].clone().normalize();
            const distance = 9; // Approx current camera distance
            // Position camera along the normal, plus a bit of 'up' to keep it interesting, but mostly head-on
            const targetPos = faceNormal.multiplyScalar(distance).add(new THREE.Vector3(faceNormal.x ? 0 : 2, faceNormal.y ? 0 : 2, faceNormal.z ? 0 : 2).multiplyScalar(0.2));
            
            setTargetCameraPos(targetPos);

            // 4. Wait for camera move, then Place
            // The useFrame hook below handles the lerp. We just need a timeout to trigger the actual placement.
            setTimeout(() => {
                placeTile(targetIndex);
                setIsAnimating(false);
                setTargetCameraPos(null);
            }, 1200); // 1.2s for camera swing + pause
        }
    }
  }, [gameMode, phase, stickers]); // Dependencies ensure this runs when phase switches to PLACE

  // Smooth Camera Animation
  useFrame((state, delta) => {
      if (targetCameraPos) {
          state.camera.position.lerp(targetCameraPos, 3 * delta);
          state.camera.lookAt(0, 0, 0);
      }
  });


  const handleStickerClick = (e: any, face: Face) => {
    e.stopPropagation();
    if (phase === 'PLACE') return; // Handled by sticker onClick prop for placement
    if (phase !== 'TWIST' || isAnimating) return;

    // Left Click Logic:
    // If the face is already selected, EXECUTE the twist.
    // If not selected, select it (default CW).
    if (selection && selection.face === face) {
        triggerAnimation(selection.face, selection.clockwise);
    } else {
        setSelection({ face, clockwise: true });
    }
  };

  const handleStickerContextMenu = (e: any, face: Face) => {
    e.stopPropagation();
    // Prevent browser context menu handled in CubieSticker via nativeEvent
    if (phase !== 'TWIST' || isAnimating) return;

    // Right Click Logic:
    // Toggle direction if selected, or select with default direction if not.
    if (selection && selection.face === face) {
        setSelection({ ...selection, clockwise: !selection.clockwise });
    } else {
        setSelection({ face, clockwise: true }); // Default to CW on first select
    }
  };

  const handleBackgroundClick = () => {
    if (phase === 'TWIST' && selection) setSelection(null);
  };

  // External trigger for animation
  const triggerAnimation = (face: Face, clockwise: boolean) => {
    if (useGameStore.getState().isAnimating) return;
    useGameStore.getState().setIsAnimating(true);
    setSelection(null); // Clear UI
    
    const group = groupRef.current;
    if (!group) return;
    
    group.rotation.set(0,0,0);
    group.position.set(0,0,0);
    
    const movingCubieIndices = getCubiesForFace(face);
    const movingMeshes = movingCubieIndices.map(i => cubiesRef.current[i]).filter(Boolean) as THREE.Object3D[];
    
    if (movingMeshes.length === 0) {
       useGameStore.getState().setIsAnimating(false);
       return;
    }

    const originalParent = movingMeshes[0].parent;
    movingMeshes.forEach(mesh => group.attach(mesh));
    
    const startTime = Date.now();
    const duration = 300; 
    
    const animate = () => {
      const now = Date.now();
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const angle = (Math.PI / 2) * (clockwise ? -1 : 1) * ease;
      
      if (face === 'U') group.rotation.y = angle;
      else if (face === 'D') group.rotation.y = -angle;
      else if (face === 'R') group.rotation.x = angle;
      else if (face === 'L') group.rotation.x = -angle;
      else if (face === 'F') group.rotation.z = angle;
      else if (face === 'B') group.rotation.z = -angle;

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        useGameStore.getState().rotateFace(face, clockwise); 
        if (originalParent) movingMeshes.forEach(mesh => originalParent.attach(mesh));
        CUBIE_POSITIONS.forEach((pos, idx) => {
            const m = cubiesRef.current[idx];
            if (m) {
                m.position.set(pos[0], pos[1], pos[2]);
                m.rotation.set(0,0,0);
                m.scale.set(1,1,1);
            }
        });
        group.rotation.set(0,0,0);
      }
    };
    animate();
  };
  
  useEffect(() => {
    const handleRotate = (e: CustomEvent) => {
      triggerAnimation(e.detail.face, e.detail.clockwise);
    };
    window.addEventListener('cube-rotate', handleRotate as any);
    window.addEventListener('pointermissed', handleBackgroundClick); 
    return () => {
        window.removeEventListener('cube-rotate', handleRotate as any);
        window.removeEventListener('pointermissed', handleBackgroundClick);
    }
  }, [selection]); 

  return (
    <group>
      <group ref={groupRef} />
      {CUBIE_POSITIONS.map((pos, i) => (
        <Cubie 
          key={i} 
          index={i} 
          position={pos} 
          stickers={stickers} 
          placeTile={placeTile}
          phase={phase}
          gameMode={gameMode}
          lastPlacedIndex={lastPlacedStickerIndex}
          onStickerClick={handleStickerClick}
          onStickerContextMenu={handleStickerContextMenu}
          ref={(el: THREE.Object3D | null) => { cubiesRef.current[i] = el; }}
        />
      ))}
      {selection && (
          <TwistArrow 
             face={selection.face} 
             clockwise={selection.clockwise} 
             onClick={() => triggerAnimation(selection.face, selection.clockwise)}
             onContextMenu={(e: any) => {
                e.stopPropagation();
                setSelection({ ...selection, clockwise: !selection.clockwise });
             }}
          />
      )}
    </group>
  );
};

const TwistArrow = ({ face, clockwise, onClick, onContextMenu }: { face: Face, clockwise: boolean, onClick: () => void, onContextMenu?: any }) => {
    const pos = FACE_CENTERS[face];
    
    // Determine rotation of the arrow mesh to align with face
    let rot: [number, number, number] = [0, 0, 0];
    switch(face) {
        case 'U': rot = [-Math.PI/2, 0, 0]; break; 
        case 'D': rot = [Math.PI/2, 0, 0]; break; 
        case 'F': rot = [0, 0, 0]; break; 
        case 'B': rot = [0, Math.PI, 0]; break;
        case 'R': rot = [0, Math.PI/2, 0]; break;
        case 'L': rot = [0, -Math.PI/2, 0]; break;
    }

    const scale: [number, number, number] = [clockwise ? -1 : 1, 1, 1];

    return (
        <group position={pos} rotation={rot as any}>
            <group 
                scale={scale} 
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                onContextMenu={(e) => { 
                    e.nativeEvent.preventDefault();
                    e.stopPropagation(); 
                    onContextMenu && onContextMenu(e); 
                }}
            >
               <mesh>
                 <ringGeometry args={[0.75, 1.05, 48, 1, -Math.PI/2, Math.PI * 1.5]} />
                 <meshBasicMaterial 
                    color="#fbbf24" 
                    side={THREE.DoubleSide} 
                    toneMapped={false}
                 />
               </mesh>
               
               <mesh position={[-0.9, 0, 0]} rotation={[0,0, -Math.PI/2]}> 
                  <circleGeometry args={[0.3, 3]} />
                  <meshBasicMaterial 
                      color="#fbbf24" 
                      side={THREE.DoubleSide}
                      toneMapped={false}
                  />
               </mesh>

               <mesh visible={false}>
                  <circleGeometry args={[1.3, 16]} />
               </mesh>
            </group>
        </group>
    );
};

// Individual Cubie containing black box + relevant stickers
const Cubie = React.forwardRef(({ index, position, stickers, placeTile, phase, gameMode, lastPlacedIndex, onStickerClick, onStickerContextMenu }: any, ref: any) => {
  const [x, y, z] = position;
  
  const getStickerIndex = (face: Face): number | null => {
    if (face === 'U' && y !== 1) return null;
    if (face === 'D' && y !== -1) return null;
    if (face === 'L' && x !== -1) return null;
    if (face === 'R' && x !== 1) return null;
    if (face === 'F' && z !== 1) return null;
    if (face === 'B' && z !== -1) return null;

    let col = 0, row = 0;
    
    if (face === 'U') { col = x + 1; row = z + 1; return row * 3 + col; }
    if (face === 'L') { col = z + 1; row = 1 - y; return 9 + row * 3 + col; }
    if (face === 'F') { col = x + 1; row = 1 - y; return 18 + row * 3 + col; }
    if (face === 'R') { col = 1 - z; row = 1 - y; return 27 + row * 3 + col; }
    if (face === 'B') { col = 1 - x; row = 1 - y; return 36 + row * 3 + col; }
    if (face === 'D') { col = x + 1; row = 1 - z; return 45 + row * 3 + col; }
    return null;
  };

  const myStickers = [
    { face: 'U', idx: getStickerIndex('U') },
    { face: 'L', idx: getStickerIndex('L') },
    { face: 'F', idx: getStickerIndex('F') },
    { face: 'R', idx: getStickerIndex('R') },
    { face: 'B', idx: getStickerIndex('B') },
    { face: 'D', idx: getStickerIndex('D') },
  ].filter(s => s.idx !== null) as { face: Face, idx: number }[];

  return (
    <group position={position} ref={ref}>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.05} smoothness={4}>
        <meshStandardMaterial 
          color="#d0e5ff" 
          roughness={0.05} 
          metalness={0.2}
          transparent={true}
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </RoundedBox>
      {myStickers.map(({ face, idx }) => (
        <CubieSticker 
          key={face} 
          face={face} 
          color={stickers[idx].color}
          onClick={(e: any) => {
              if (phase === 'PLACE') {
                 // Place logic: Only allow if not random mode
                 if (gameMode !== 'RANDOM' && stickers[idx].owner === null) placeTile(idx);
              } else {
                 // Twist selection logic (Left Click)
                 onStickerClick(e, face);
              }
          }}
          onContextMenu={(e: any) => {
              // Twist direction toggle (Right Click)
              onStickerContextMenu(e, face);
          }}
          active={phase === 'PLACE' && stickers[idx].owner === null && gameMode !== 'RANDOM'}
          canHover={phase === 'PLACE' || phase === 'TWIST'}
          isLastPlaced={lastPlacedIndex === idx}
        />
      ))}
    </group>
  );
});

const CubieSticker = ({ face, color, onClick, onContextMenu, active, canHover, isLastPlaced }: any) => {
  const [hover, setHover] = useState(false);
  
  // Position sticker slightly off surface
  let pos: [number, number, number] = [0,0,0];
  let rot: [number, number, number] = [0,0,0];
  const offset = 0.51;
  
  switch(face) {
    case 'U': pos=[0, offset, 0]; rot=[-Math.PI/2, 0, 0]; break;
    case 'D': pos=[0, -offset, 0]; rot=[Math.PI/2, 0, 0]; break;
    case 'F': pos=[0, 0, offset]; rot=[0, 0, 0]; break;
    case 'B': pos=[0, 0, -offset]; rot=[0, Math.PI, 0]; break;
    case 'R': pos=[offset, 0, 0]; rot=[0, Math.PI/2, 0]; break;
    case 'L': pos=[-offset, 0, 0]; rot=[0, -Math.PI/2, 0]; break;
  }

  return (
    <group position={pos} rotation={rot as any}>
        <mesh 
            onClick={(e) => { 
                e.stopPropagation(); 
                onClick(e);
            }}
            onContextMenu={(e) => {
                e.nativeEvent.preventDefault(); // Stop standard context menu
                e.stopPropagation();
                onContextMenu && onContextMenu(e);
            }}
            onPointerOver={(e) => { e.stopPropagation(); canHover && setHover(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
        >
            <planeGeometry args={[0.85, 0.85]} />
            <meshStandardMaterial 
                color={active && hover ? HOVER_COLOR : (hover && canHover) ? new THREE.Color(color).clone().lerp(new THREE.Color('#ffffff'), 0.2) : color} 
                roughness={0.2} 
                metalness={0.0}
                transparent={true}
                opacity={0.8}
                side={THREE.DoubleSide}
            />
        </mesh>
        
        {/* Bright edges for the last placed tile */}
        {isLastPlaced && (
            <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 4]}>
               <ringGeometry args={[0.53, 0.60, 4]} />
               <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
        )}
    </group>
  );
};

import React, { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
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

export const RubiksCube = () => {
  const { stickers, phase, placeTile, rotateFace, setIsAnimating, isAnimating } = useGameStore();
  
  const cubiesRef = useRef<(THREE.Object3D | null)[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  
  // Selection state for Twist Phase
  // stores which face is selected and the pending direction
  const [selection, setSelection] = useState<{ face: Face, clockwise: boolean } | null>(null);

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
                // Allow toggling direction by right clicking the arrow too
                e.stopPropagation();
                // We must preventDefault on the canvas event or handle it here?
                // R3F events don't have preventDefault on the synthetic event directly for context menu?
                // Actually they do if it's mapped. But the parent listener on window might trigger.
                // It is safe to just flip state.
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

    // CCW arrow geometry by default. Scale X by -1 to make it CW.
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
               {/* Arrow Body (Ring Segment) */}
               {/* Arc from Bottom (-PI/2) to Left (PI) => CCW path */}
               <mesh>
                 <ringGeometry args={[0.75, 1.05, 48, 1, -Math.PI/2, Math.PI * 1.5]} />
                 <meshBasicMaterial 
                    color="#fbbf24" 
                    side={THREE.DoubleSide} 
                    toneMapped={false}
                 />
               </mesh>
               
               {/* Arrow Head (Triangle) */}
               {/* Positioned at the end of the arc (Angle PI => Left side of circle: x=-0.9, y=0) */}
               {/* Mean radius = (0.75+1.05)/2 = 0.9 */}
               <mesh position={[-0.9, 0, 0]} rotation={[0,0, -Math.PI/2]}> 
                  {/* Circle with 3 segments is a triangle. 
                      Default: Point is at Angle 0 (Right).
                      Rotate -90 deg => Point Down. 
                      Tangent at Left side of CCW circle is Down. Correct.
                  */}
                  <circleGeometry args={[0.3, 3]} />
                  <meshBasicMaterial 
                      color="#fbbf24" 
                      side={THREE.DoubleSide}
                      toneMapped={false}
                  />
               </mesh>

               {/* Hit area for easier clicking */}
               <mesh visible={false}>
                  <circleGeometry args={[1.3, 16]} />
               </mesh>
            </group>
        </group>
    );
};

// Individual Cubie containing black box + relevant stickers
const Cubie = React.forwardRef(({ index, position, stickers, placeTile, phase, onStickerClick, onStickerContextMenu }: any, ref: any) => {
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
                 // Place logic
                 if (stickers[idx].owner === null) placeTile(idx);
              } else {
                 // Twist selection logic (Left Click)
                 onStickerClick(e, face);
              }
          }}
          onContextMenu={(e: any) => {
              // Twist direction toggle (Right Click)
              onStickerContextMenu(e, face);
          }}
          active={phase === 'PLACE' && stickers[idx].owner === null}
          canHover={phase === 'PLACE' || phase === 'TWIST'}
        />
      ))}
    </group>
  );
});

const CubieSticker = ({ face, color, onClick, onContextMenu, active, canHover }: any) => {
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
    <mesh 
      position={pos} 
      rotation={rot as any} 
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
  );
};

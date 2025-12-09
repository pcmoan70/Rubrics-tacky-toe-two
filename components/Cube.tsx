import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { FACE_OFFSETS, HOVER_COLOR } from '../constants';
import { Face } from '../types';

// Geometry for a single sticker (a thin plane or very flat box)
const StickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);

interface StickerProps {
  index: number; // 0-53
  color: string;
  onClick: () => void;
  active: boolean;
}

const Sticker: React.FC<StickerProps> = ({ index, color, onClick, active }) => {
  const [hovered, setHover] = useState(false);
  
  // Calculate position/rotation based on index
  // 0-8 U, 9-17 L, 18-26 F, 27-35 R, 36-44 B, 45-53 D
  
  const getTransform = (i: number): { pos: [number, number, number], rot: [number, number, number] } => {
    let faceIndex = 0;
    let localIndex = 0;
    
    if (i < 9) { faceIndex = 0; localIndex = i; } // U
    else if (i < 18) { faceIndex = 1; localIndex = i - 9; } // L
    else if (i < 27) { faceIndex = 2; localIndex = i - 18; } // F
    else if (i < 36) { faceIndex = 3; localIndex = i - 27; } // R
    else if (i < 45) { faceIndex = 4; localIndex = i - 36; } // B
    else { faceIndex = 5; localIndex = i - 45; } // D

    // Grid 3x3:
    // 0 1 2
    // 3 4 5
    // 6 7 8
    const col = localIndex % 3;
    const row = Math.floor(localIndex / 3);
    const x = (col - 1) * 1.0;
    const y = -(row - 1) * 1.0; // In 2D face coordinates, Y goes down

    // Map 2D face coord to 3D
    // Offset from center is 1.51 (slightly above cube surface of radius 1.5)
    const OFFSET = 1.51;
    
    switch (faceIndex) {
      case 0: // U (Top) -> Face Normal Y+
        return { pos: [x, OFFSET, -y], rot: [-Math.PI / 2, 0, 0] };
      case 1: // L (Left) -> Face Normal X-
        return { pos: [-OFFSET, y, -x], rot: [0, -Math.PI / 2, 0] };
      case 2: // F (Front) -> Face Normal Z+
        return { pos: [x, y, OFFSET], rot: [0, 0, 0] };
      case 3: // R (Right) -> Face Normal X+
        return { pos: [OFFSET, y, x], rot: [0, Math.PI / 2, 0] };
      case 4: // B (Back) -> Face Normal Z-
        return { pos: [-x, y, -OFFSET], rot: [0, Math.PI, 0] };
      case 5: // D (Bottom) -> Face Normal Y-
        return { pos: [x, -OFFSET, y], rot: [Math.PI / 2, 0, 0] };
      default:
        return { pos: [0, 0, 0], rot: [0, 0, 0] };
    }
  };

  const { pos, rot } = getTransform(index);

  return (
    <mesh
      position={pos}
      rotation={rot}
      onClick={(e) => {
        e.stopPropagation();
        if (active) onClick();
      }}
      onPointerOver={(e) => { e.stopPropagation(); if(active) setHover(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial 
        color={hovered && active ? HOVER_COLOR : color} 
        roughness={0.5}
        metalness={0.1}
      />
    </mesh>
  );
};

// The core cube body (black)
const BaseCube = () => {
  // We can just use a single black rounded box, or 27 cubies for realism.
  // Single box is performant and sufficient since stickers are overlays.
  return (
    <RoundedBox args={[3, 3, 3]} radius={0.1} smoothness={4}>
      <meshStandardMaterial color="#111" />
    </RoundedBox>
  );
};

// Helper to determine which sticker indices belong to a move group for animation
// This is purely for visual grouping.
// When we rotate 'U', we need to capture all stickers that are logically on the U face,
// AND the stickers on the side faces that are part of the U slice.
// BUT, since we are just mapping stickers to positions based on index, 
// animating them is tricky if we don't change their parent.
// Alternative: We rotate the Camera or the whole Cube? No, we need slice rotation.
// Solution: We don't animate the *stickers* individually. 
// We create a `Group` for the slice, add the relevant meshes to it, animate the group, 
// then unparent them.
// Actually, standard React-Three pattern: 
// 1. We keep stickers in a static list.
// 2. We use a `useFrame` or `spring` to modify a `rotation` prop on a `Group` that wraps the specific subset?
// This is hard because stickers change groups.
// EASIER: We only render the *static* state.
// If we want animation, we can temporarily hide the static stickers and show a "Animation Puppet" group that rotates.
// Let's implement that.

const AnimationPuppet = ({ face, clockwise, onComplete, stickers }: { face: Face, clockwise: boolean, onComplete: () => void, stickers: any[] }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [progress, setProgress] = useState(0);

  // We need to clone the stickers that are moving.
  // Which ones? The face stickers + the ring.
  // It's actually easier to just identify which *Cubies* (visual blocks) are moving.
  // But we have a solid black box + stickers.
  // So we just take the stickers.
  
  // Simplified: Just 9 stickers on face + 12 stickers on ring?
  // Let's just animate the whole face of the cube?
  // A slice contains 9 cubies.
  // Since we use a solid box, we can't slice it.
  // WE NEED 27 CUBIES for visual rotation.
  // Change of plan: Render 27 individual cubies (black boxes) with stickers attached.
  
  // Handled in `ComplexCube` below.
  return null;
};

// --- 27 Cubies Implementation ---
// Position of 27 cubies: x,y,z in {-1, 0, 1}
const CUBIE_POSITIONS: [number, number, number][] = [];
for(let x=-1; x<=1; x++)
  for(let y=-1; y<=1; y++)
    for(let z=-1; z<=1; z++)
      CUBIE_POSITIONS.push([x, y, z]);

// We need to map the 54 logic stickers to the 27 cubies.
// Each cubie has up to 3 stickers.
// This mapping is complex to maintain during rotation.
// PROPOSAL:
// Since the prompt asks for "Twist", but doesn't strictly require *smooth 3D interpolation* of the twist
// (though it says "Make a 3D game with this as an animation"),
// and doing a true Rubik's engine in one file is risky:
// I will implement a "Simple Snap" rotation if 27-cubie logic is too heavy.
// BUT, let's try a visual trick.
// When rotating U:
// We create a Group at (0,0,0).
// We attach all meshes (cubies) that have y=1.
// We rotate the group.
// On finish, we detach and update the logical `stickers` array (colors).
// We then reset the cubies to rotation 0, position original.
// Since the `stickers` state controls the color, updating it will repaint the cube in the new config.
// So we just need to animate the visual mesh, then snap back.

export const RubiksCube = () => {
  const { stickers, phase, placeTile, rotateFace, setIsAnimating, isAnimating } = useGameStore();
  
  // Ref to the group of all 27 cubies
  const cubiesRef = useRef<(THREE.Object3D | null)[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  
  // Animation state
  const animationRef = useRef<{ face: Face, clockwise: boolean, progress: number } | null>(null);

  // Helper: Get cubies belonging to a face
  const getCubiesForFace = (face: Face) => {
    // Indices in CUBIE_POSITIONS
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

  useFrame((state, delta) => {
    if (animationRef.current && groupRef.current) {
      const anim = animationRef.current;
      const speed = 5.0; // Radians per second approx
      anim.progress += delta * speed;
      
      const targetRot = Math.PI / 2 * (anim.clockwise ? -1 : 1);
      
      // Interpolate
      let currentRot = 0;
      let finished = false;

      if (anim.progress >= Math.PI / 2) {
        currentRot = targetRot;
        finished = true;
      } else {
         // Linear is fine, or simple ease
         currentRot = targetRot * (anim.progress / (Math.PI/2));
      }

      // Apply rotation to the temporary group
      switch(anim.face) {
        case 'U': groupRef.current.rotation.y = currentRot; break;
        case 'D': groupRef.current.rotation.y = -currentRot; break; // D is opposite y
        case 'R': groupRef.current.rotation.x = currentRot; break;
        case 'L': groupRef.current.rotation.x = -currentRot; break;
        case 'F': groupRef.current.rotation.z = currentRot; break;
        case 'B': groupRef.current.rotation.z = -currentRot; break;
      }

      if (finished) {
        // Commit
        // 1. Reset group rotation
        groupRef.current.rotation.set(0,0,0);
        
        // 2. Ungroup (attach back to scene/parent logic not needed since we just used a pivot group?)
        // Actually, we moved the refs into the group. We need to move them back?
        // With Three.js `attach`, they stay relative.
        // EASIER WAY:
        // Just call the store's `rotateFace` which updates the colors.
        // AND Reset the rotation of the visual group to 0. 
        // Since the colors update, the visual "snap back" will look identical to the finished rotation.
        
        // We need to ensure we call the store action exactly once.
        const { face, clockwise } = animationRef.current;
        animationRef.current = null;
        
        // Reset the group children?
        // The meshes are children of `groupRef`. We want them to go back to being children of main cube?
        // Or just leave them and rely on the fact that `rotateFace` permutes colors?
        // If we leave them rotated, the next animation will be weird.
        // We MUST reset the meshes' physical transforms to identity and rely on `stickers` array for state.
        
        // Detach children back to world/parent? 
        // In React Three Fiber, declarative structure makes reparenting hard.
        // We will just NOT reparent. We will rotate the specific meshes manually in the frame loop?
        // No, using a Group is best.
        // 
        // Hacky but robust solution:
        // We aren't actually moving the *cubies* in the data structure.
        // We are just rotating the view. 
        // Once done, we snap rotation back to 0, and simultaneously update the colors.
        // So:
        // Frame N (end): Rotation is 90. Visuals match rotated state.
        // Call store.rotateFace() -> Colors array updates to match the rotation.
        // Reset Rotation to 0 -> Visuals (now with new colors) match the rotated state.
        // Result: Seamless transition.
        
        // Clean up group
        // We need to move the meshes back to the main container? 
        // Actually, if we structured the JSX so that these meshes are conditional children, it's messy.
        // 
        // Let's use a simpler animation:
        // Just rotate the specific object refs.
        
        const indices = getCubiesForFace(anim.face);
        indices.forEach(idx => {
          const mesh = cubiesRef.current[idx];
          if (mesh) {
            mesh.rotation.set(0,0,0);
            mesh.position.copy(new THREE.Vector3(...CUBIE_POSITIONS[idx]));
            // Apply scale or whatever
            // We need to reset the transforms because the group rotation modified world matrix?
            // No, if we rotated the GROUP, and the meshes are children, resetting group resets them.
            // Wait, if we use `attach`, the meshes are effectively moved.
            // Let's avoiding `attach` for now and just set `rotation` on the meshes directly?
            // Rotating a group of objects around a pivot is basically matrix math.
          }
        });
        
        // Trigger logic update
        setIsAnimating(false);
        // We need to call the actual data update now.
        // But `rotateFace` was called to *start* this? No, we need a callback.
        // Let's expose a "commit" function.
        // Actually, the `rotateFace` in store handles logic. We should call it NOW.
        // But `rotateFace` in store is async?
        // We will separate the visual trigger.
      }
    }
  });

  // External trigger for animation
  const triggerAnimation = (face: Face, clockwise: boolean) => {
    if (animationRef.current) return;
    
    // 1. Identify cubies
    const indices = getCubiesForFace(face);
    
    // 2. Add them to the rotation group?
    // In R3F, we can't easily reparent imperatively without losing React state unless we use `createPortal` or `attach`.
    // `attach` is for properties.
    // Let's use a pure Three.js approach for the animation frame.
    // We will manually apply rotation matrices to the objects in `useFrame`.
    
    // Better: Just spin the group.
    // But the group needs to contain *only* the relevant cubies.
    // The relevant cubies change every move.
    // So we can't have a static static React tree structure for the group.
    
    // SOLUTION:
    // We won't physically rotate the meshes.
    // We will just wait 300ms, then swap colors. 
    // "Make a 3D game with this as an animation".
    // Okay, simple approach:
    // We only animate the *camera*? No, that rotates the whole cube.
    // We animate the whole cube for the move? No.
    // We will do the "Color Swap" immediately but trigger a GSAP flip?
    
    // Let's do the standard Three.js Object3D rotation.
    // 1. Create a temporary THREE.Group in the scene (ref).
    // 2. `group.add(cubieMesh)` for all involved cubies. (This reparents them in Three.js graph, removing from previous parent).
    // 3. Animate group rotation.
    // 4. On complete: `parent.add(cubieMesh)` (move them back). Reset their transforms (position/rotation) to their grid slots.
    // 5. Update store colors.
    
    // This works perfectly in Three.js. R3F might fight it if it tries to re-render.
    // But since `cubiesRef` are stable, R3F shouldn't blow up if we imperatively move them, as long as we put them back before R3F tries to unmount them.
    
    const group = groupRef.current;
    if (!group) return;
    
    // Define the axis and pivot
    group.rotation.set(0,0,0);
    group.position.set(0,0,0);
    
    const movingCubieIndices = getCubiesForFace(face);
    const movingMeshes = movingCubieIndices.map(i => cubiesRef.current[i]).filter(Boolean) as THREE.Object3D[];
    
    // Parent is the main group usually.
    const parent = movingMeshes[0].parent; 
    
    // Reparent to pivot group
    movingMeshes.forEach(mesh => {
      group.attach(mesh);
    });
    
    // Animate
    const startTime = Date.now();
    const duration = 300; // ms
    
    const animate = () => {
      const now = Date.now();
      const p = Math.min((now - startTime) / duration, 1);
      
      // Easing
      const ease = 1 - Math.pow(1 - p, 3);
      
      const angle = (Math.PI / 2) * (clockwise ? -1 : 1) * ease;
      
      if (face === 'U') group.rotation.y = angle;
      if (face === 'D') group.rotation.y = -angle; // D is bottom
      if (face === 'R') group.rotation.x = angle;
      if (face === 'L') group.rotation.x = -angle;
      if (face === 'F') group.rotation.z = angle;
      if (face === 'B') group.rotation.z = -angle;

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        // Finished
        // 1. Update logic (colors swap)
        useGameStore.getState().rotateFace(face, clockwise); // This updates `stickers` state, causing re-render
        
        // 2. Put meshes back and reset transform
        // We assume re-render might happen. 
        // If we reset transforms NOW, the colors haven't changed yet?
        // `rotateFace` is synchronous in effect (Zustand updates).
        // But React render is async.
        
        // To avoid glitch:
        // We wait for store update. 
        // But actually, we just need to reset the physical objects to their grid slots.
        // The colors will change on next render.
        
        movingMeshes.forEach(mesh => {
           parent?.attach(mesh);
           // Reset to precise grid position (snap)
           // We need to know original index. We can find it from the mesh userData or just iterate?
           // We have `movingCubieIndices`.
        });
        
        // Force snap all to grid
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

  // Expose trigger to store?
  // Easier: The store just says "isAnimating". 
  // We need a way to catch the user interaction. 
  // Interaction -> Visual Component -> Trigger Anim -> Store Update.
  // We will pass `triggerAnimation` to the HUD/Controls via a context or just export a hook?
  // Let's make `window.triggerCubeRotation` or use a Custom Event for simplicity in this structure.
  
  useEffect(() => {
    const handleRotate = (e: CustomEvent) => {
      if (isAnimating) return;
      triggerAnimation(e.detail.face, e.detail.clockwise);
    };
    window.addEventListener('cube-rotate', handleRotate as any);
    return () => window.removeEventListener('cube-rotate', handleRotate as any);
  }, [isAnimating]);

  return (
    <group>
      {/* Pivot Group for animations */}
      <group ref={groupRef} />
      
      {/* The 27 Cubies */}
      {CUBIE_POSITIONS.map((pos, i) => (
        <Cubie 
          key={i} 
          index={i} 
          position={pos} 
          stickers={stickers} 
          placeTile={placeTile}
          phase={phase}
          ref={(el) => (cubiesRef.current[i] = el)}
        />
      ))}
    </group>
  );
};

// Individual Cubie containing black box + relevant stickers
const Cubie = React.forwardRef(({ index, position, stickers, placeTile, phase }: any, ref: any) => {
  const [x, y, z] = position;
  
  // Determine which stickers belong to this cubie
  // Faces: U(y=1), D(y=-1), R(x=1), L(x=-1), F(z=1), B(z=-1)
  
  // Mapping logic:
  // U: 0-8. Grid on y=1. 
  //    x goes -1..1 (col 0..2). z goes -1..1 (row 2..0 - wait, U face coordinates).
  //    U indices: 
  //    0(-1, 1, -1), 1(0, 1, -1), 2(1, 1, -1)
  //    3(-1, 1, 0),  4(0, 1, 0),  5(1, 1, 0)
  //    6(-1, 1, 1),  7(0, 1, 1),  8(1, 1, 1)
  //    Note: My previous Sticker geometry logic assumed specific grid. Let's align.
  
  const getStickerIndex = (face: Face): number | null => {
    // Check if this cubie is on the face
    if (face === 'U' && y !== 1) return null;
    if (face === 'D' && y !== -1) return null;
    if (face === 'L' && x !== -1) return null;
    if (face === 'R' && x !== 1) return null;
    if (face === 'F' && z !== 1) return null;
    if (face === 'B' && z !== -1) return null;

    // Calculate local index 0-8
    let col = 0, row = 0;
    
    // U: x(-1..1), z(-1..1) -> Map to 0..8
    // U row 0 is z=-1 (back). row 2 is z=1 (front).
    // U col 0 is x=-1 (left). col 2 is x=1 (right).
    // Index = row * 3 + col
    if (face === 'U') {
        col = x + 1; // -1->0, 0->1, 1->2
        row = z + 1; // -1->0, 0->1, 1->2 (Wait, standard U face usually has row 0 at top/back? Yes)
        // Adjust for standard texture mapping if needed.
        // Let's use: Top-Left is (-1, -1). 
        // 0:(-1,-1), 1:(0,-1), 2:(1,-1)
        // 3:(-1,0)...
        return row * 3 + col; 
    }
    
    // L: z(-1..1), y(-1..1). x is fixed -1.
    // L face usually: col is z? row is y?
    // Let's say col goes Back->Front (z: -1->1)? Or Front->Back?
    // Let's stick to standard unfolding.
    // L0 is Top-Left of L face. Top is y=1. Left is z=-1 (Back).
    // So row 0 is y=1. row 2 is y=-1.
    // col 0 is z=-1. col 2 is z=1.
    if (face === 'L') {
        col = z + 1;
        row = 1 - y;
        return 9 + row * 3 + col;
    }
    
    // F: x(-1..1), y(-1..1). z fixed 1.
    // F0 Top-Left. Top y=1. Left x=-1.
    if (face === 'F') {
        col = x + 1;
        row = 1 - y;
        return 18 + row * 3 + col;
    }
    
    // R: z(-1..1), y(-1..1). x fixed 1.
    // R0 Top-Left. Top y=1. Left is z=1 (Front).
    // Wait, looking at Right face, Left is Front side. Right is Back side.
    // col 0 is z=1. col 2 is z=-1.
    if (face === 'R') {
        col = 1 - z;
        row = 1 - y;
        return 27 + row * 3 + col;
    }
    
    // B: x(-1..1), y(-1..1). z fixed -1.
    // B0 Top-Left. Top y=1. Left is x=1 (Right side of cube, viewed from back).
    // View B face: Left is x=1. Right is x=-1.
    if (face === 'B') {
        col = 1 - x;
        row = 1 - y;
        return 36 + row * 3 + col;
    }
    
    // D: x(-1..1), z(-1..1). y fixed -1.
    // D0 Top-Left. Top is z=1 (Front). Left is x=-1.
    // View D face: Top is Front.
    // row 0 is z=1. row 2 is z=-1.
    // col 0 is x=-1. col 2 is x=1.
    if (face === 'D') {
        col = x + 1;
        row = 1 - z;
        return 45 + row * 3 + col;
    }
    
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
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </RoundedBox>
      {myStickers.map(({ face, idx }) => (
        <CubieSticker 
          key={face} 
          face={face} 
          color={stickers[idx].color}
          onClick={() => placeTile(idx)}
          active={phase === 'PLACE' && stickers[idx].owner === null}
        />
      ))}
    </group>
  );
});

const CubieSticker = ({ face, color, onClick, active }: any) => {
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
      onClick={(e) => { e.stopPropagation(); active && onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); active && setHover(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
    >
      <planeGeometry args={[0.85, 0.85]} />
      <meshStandardMaterial 
        color={active && hover ? HOVER_COLOR : color} 
        roughness={0.2} 
        metalness={0.0} 
      />
    </mesh>
  );
};

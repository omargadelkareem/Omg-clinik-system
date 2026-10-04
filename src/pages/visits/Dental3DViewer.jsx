import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const STATUS_COLORS = {
  healthy: "#fffaf0",
  caries: "#b96f43",
  filling: "#7f9dad",
  root_canal: "#8a70a0",
  crown: "#d7b95f",
  implant: "#6b9c96",
  missing: "#b9c0c2",
  fracture: "#bd7777",
};

function ToothMesh({ number, index, total, jaw, status, selected, onSelect }) {
  const group = useRef();
  const angle = THREE.MathUtils.lerp(-1.22, 1.22, index / (total - 1));
  const radiusX = 4.75;
  const radiusZ = 2.65;
  const x = Math.sin(angle) * radiusX;
  const z = Math.cos(angle) * radiusZ - 1.15;
  const y = jaw === "upper" ? 1.18 : -1.18;
  const isMolar = index < 3 || index > 12;
  const isPremolar = (index >= 3 && index < 5) || (index > 10 && index <= 12);
  const width = isMolar ? .62 : isPremolar ? .52 : .42;
  const depth = isMolar ? .68 : isPremolar ? .56 : .43;
  const height = isMolar ? .78 : 1.02;
  const missing = status === "missing";
  const implant = status === "implant";
  const color = STATUS_COLORS[status] || STATUS_COLORS.healthy;

  return (
    <group
      ref={group}
      position={[x, y, z]}
      rotation={[jaw === "lower" ? Math.PI : 0, -angle, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(number);
      }}
    >
      {!missing && (
        <>
          <mesh position={[0, -.22, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[width * .22, width * .10, height * .92, 16]} />
            <meshStandardMaterial color="#f2eadc" roughness={.55} metalness={0} />
          </mesh>
          <mesh position={[0, .28, 0]} castShadow receiveShadow scale={selected ? 1.12 : 1}>
            <sphereGeometry args={[.5, 28, 20]} />
            <meshPhysicalMaterial
              color={color}
              roughness={.28}
              metalness={status === "crown" ? .12 : 0}
              clearcoat={.28}
              clearcoatRoughness={.2}
            />
          </mesh>
          <mesh position={[0, .2, 0]} scale={[width / .5, height / 1.02, depth / .5]} castShadow>
            <sphereGeometry args={[.48, 24, 18]} />
            <meshPhysicalMaterial color={color} roughness={.32} clearcoat={.18} />
          </mesh>
          {status === "caries" && (
            <mesh position={[0, .67, .08]}>
              <sphereGeometry args={[.16, 16, 12]} />
              <meshStandardMaterial color="#633d2b" roughness={.9} />
            </mesh>
          )}
          {status === "filling" && (
            <mesh position={[0, .67, .05]} scale={[1.2,.35,1]}>
              <sphereGeometry args={[.2, 16, 12]} />
              <meshStandardMaterial color="#aab8bd" metalness={.45} roughness={.35} />
            </mesh>
          )}
          {status === "root_canal" && (
            <mesh position={[0,-.18,0]}>
              <cylinderGeometry args={[.045,.035,.9,10]} />
              <meshStandardMaterial color="#a44f58" />
            </mesh>
          )}
          {implant && (
            <mesh position={[0,-.55,0]}>
              <cylinderGeometry args={[.12,.09,.82,16]} />
              <meshStandardMaterial color="#839398" metalness={.72} roughness={.28} />
            </mesh>
          )}
          {status === "fracture" && (
            <mesh position={[.08,.5,.32]} rotation={[0,0,.45]}>
              <boxGeometry args={[.035,.52,.035]} />
              <meshStandardMaterial color="#8d4e4e" />
            </mesh>
          )}
        </>
      )}
      {missing && (
        <mesh position={[0,.15,0]} rotation={[Math.PI/2,0,0]}>
          <torusGeometry args={[.31,.045,10,28]} />
          <meshStandardMaterial color="#c5ccce" transparent opacity={.65} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0,.2,0]} scale={[1.35,1.5,1.35]}>
          <sphereGeometry args={[.48,18,14]} />
          <meshBasicMaterial color="#58a6a6" wireframe transparent opacity={.42} />
        </mesh>
      )}
      <Html position={[0, jaw === "upper" ? 1.03 : .96, 0]} center distanceFactor={8}>
        <span className={selected ? "d3-label active" : "d3-label"}>{number}</span>
      </Html>
    </group>
  );
}

function GumArch({ jaw }) {
  return (
    <group position={[0, jaw === "upper" ? .75 : -.75, -.25]} rotation={[jaw === "lower" ? Math.PI : 0,0,0]}>
      <RoundedBox args={[9.9,.42,4.65]} radius={.2} smoothness={5} scale={[1,.8,1]}>
        <meshPhysicalMaterial color="#d99998" roughness={.62} transparent opacity={.42} />
      </RoundedBox>
      <mesh position={[0,.1,.15]} scale={[1,.35,.72]}>
        <torusGeometry args={[3.65,.62,18,64,Math.PI]} />
        <meshPhysicalMaterial color="#e2a3a1" roughness={.6} transparent opacity={.7} />
      </mesh>
    </group>
  );
}

function JawScene({ value, activeTooth, onSelect, showUpper, showLower }) {
  const upper = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight position={[5,8,5]} intensity={2.1} castShadow />
      <directionalLight position={[-5,2,4]} intensity={.75} />
      {showUpper && (
        <group position={[0,.45,0]}>
          <GumArch jaw="upper" />
          {upper.map((number,index)=><ToothMesh key={number} number={number} index={index} total={upper.length} jaw="upper" status={value[String(number)]?.status || "healthy"} selected={activeTooth===number} onSelect={onSelect}/>)}
        </group>
      )}
      {showLower && (
        <group position={[0,-.45,0]}>
          <GumArch jaw="lower" />
          {lower.map((number,index)=><ToothMesh key={number} number={number} index={index} total={lower.length} jaw="lower" status={value[String(number)]?.status || "healthy"} selected={activeTooth===number} onSelect={onSelect}/>)}
        </group>
      )}
      <ContactShadows position={[0,-3.1,0]} opacity={.28} scale={13} blur={2.6} far={6} />
      <Environment preset="studio" />
      <OrbitControls makeDefault enablePan={false} minDistance={7} maxDistance={15} minPolarAngle={.35} maxPolarAngle={2.65} />
    </>
  );
}

export default function Dental3DViewer({ value = {}, activeTooth, onSelect }) {
  const [jawFilter,setJawFilter]=useState("both");
  const key=useMemo(()=>Object.entries(value).map(([k,v])=>`${k}:${v?.status||""}`).join("|"),[value]);

  return (
    <div className="dental-webgl">
      <div className="dental-webgl-toolbar">
        <div>
          <strong>Interactive Dental Model</strong>
          <span>اسحب للدوران · Scroll للتقريب · اضغط على السن</span>
        </div>
        <div className="dental-jaw-filter">
          <button type="button" className={jawFilter==="both"?"active":""} onClick={()=>setJawFilter("both")}>الفكين</button>
          <button type="button" className={jawFilter==="upper"?"active":""} onClick={()=>setJawFilter("upper")}>العلوي</button>
          <button type="button" className={jawFilter==="lower"?"active":""} onClick={()=>setJawFilter("lower")}>السفلي</button>
        </div>
      </div>
      <div className="dental-webgl-canvas" key={key}>
        <Canvas shadows dpr={[1,1.75]} camera={{position:[0,3.8,10],fov:42}}>
          <color attach="background" args={["#edf3f3"]}/>
          <JawScene value={value} activeTooth={activeTooth} onSelect={onSelect} showUpper={jawFilter!=="lower"} showLower={jawFilter!=="upper"}/>
        </Canvas>
      </div>
      <div className="dental-webgl-legend">
        <span><i style={{background:STATUS_COLORS.healthy}}/>سليم</span>
        <span><i style={{background:STATUS_COLORS.caries}}/>تسوس</span>
        <span><i style={{background:STATUS_COLORS.filling}}/>حشو</span>
        <span><i style={{background:STATUS_COLORS.root_canal}}/>علاج جذور</span>
        <span><i style={{background:STATUS_COLORS.crown}}/>تاج</span>
        <span><i style={{background:STATUS_COLORS.implant}}/>زرعة</span>
      </div>
    </div>
  );
}

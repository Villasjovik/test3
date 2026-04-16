/**
 * logo3d.js — 3D logo: centered pivot, speed ramp, float physics, gold sparks
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hexInt = h => parseInt(h.replace('#',''),16);
const darken = (h,f=.12) => { const c=hexInt(h); return (Math.max(0,((c>>16)&0xff)-Math.round(255*f))<<16)|(Math.max(0,((c>>8)&0xff)-Math.round(255*f))<<8)|Math.max(0,(c&0xff)-Math.round(255*f)); };

/* ── GOLD SPARKS ─────────────────────────────── */
function mkSparks(scene) {
  const N=50, pos=new Float32Array(N*3), alp=new Float32Array(N);
  const lt=new Float32Array(N), ag=new Float32Array(N);
  const dx=new Float32Array(N), dy=new Float32Array(N), dz=new Float32Array(N);
  for(let i=0;i<N;i++){alp[i]=0;ag[i]=999;}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('alpha',new THREE.BufferAttribute(alp,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float alpha;varying float vA;void main(){vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=3.5*(300./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.83,.66,.29,vA*smoothstep(.5,0.,d)*.7);}`});
  scene.add(new THREE.Points(geo,mat));
  let tmr=0;
  return(dt,bx)=>{if(!bx)return;tmr+=dt;
    if(tmr>1.6+Math.random()*2){tmr=0;let n=3+Math.floor(Math.random()*4);
      for(let i=0;i<N&&n>0;i++)if(ag[i]>=lt[i]){pos[i*3]=(Math.random()-.5)*bx.w*1.2;pos[i*3+1]=(Math.random()-.5)*bx.h*1.2;pos[i*3+2]=(Math.random()-.5)*30;dx[i]=(Math.random()-.5)*.4;dy[i]=.15+Math.random()*.45;dz[i]=(Math.random()-.5)*.3;lt[i]=1.2+Math.random()*1.5;ag[i]=0;n--;}}
    for(let i=0;i<N;i++){if(ag[i]<lt[i]){ag[i]+=dt;const t=ag[i]/lt[i];alp[i]=(t<.12?t/.12:1-Math.pow((t-.12)/.88,2))*.55;pos[i*3]+=dx[i]*dt;pos[i*3+1]+=dy[i]*dt;pos[i*3+2]+=dz[i]*dt;}else alp[i]=0;}
    geo.attributes.position.needsUpdate=true;geo.attributes.alpha.needsUpdate=true;};
}

/* ── MAIN ────────────────────────────────────── */
function initLogo3D(container) {
  const svgPath = container.dataset.svg;
  const colorHex = container.dataset.color || '#1a1a1a';
  const depth = parseFloat(container.dataset.bevelDepth || '22');
  const rotateSpeed = parseFloat(container.dataset.rotateSpeed || '0.5');
  const fallback = container.dataset.fallback || null;
  const bgColor = container.dataset.bg || 'transparent';
  const hasSparks = container.dataset.sparks !== 'false';
  const rotDelay = parseFloat(container.dataset.delay || '0');
  const nudgeX = parseFloat(container.dataset.nudgeX || '0');
  const yOffset = parseFloat(container.dataset.yOffset || '0');
  const shadowYAbs = container.dataset.shadowY; // absolute Y for shadow (overrides auto)
  const mode = container.dataset.mode || 'spin';
  const isTilt = mode === 'tilt';
  const motion = container.dataset.motion || 'default'; // 'default' | 'float-spin'
  const material = container.dataset.material || 'default'; // gold, chrome, plastic, metal, glass
  const hasShadow = container.dataset.shadow !== 'false';

  try { const c=document.createElement('canvas'); if(!c.getContext('webgl2')&&!c.getContext('webgl'))throw 0; }
  catch { if(fallback) container.innerHTML=`<img src="${fallback}" style="width:100%;height:100%;object-fit:contain;">`; return; }

  const W = container.clientWidth || 800;
  const H = container.clientHeight || 400;
  const isTransparent = bgColor === 'transparent';

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:isTransparent });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  if (isTransparent) renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (!isTransparent) scene.background = new THREE.Color(bgColor);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 5000);
  camera.position.set(0, 0, 1050);

  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  // Lights — strong key from upper right corner
  scene.add(new THREE.AmbientLight(0xfff8f0, 0.7));
  const keyLight = new THREE.DirectionalLight(0xfff2e0, 6.0);
  keyLight.position.set(900, 800, 500); // strong upper-right-front
  keyLight.castShadow = hasShadow;
  if (hasShadow) {
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 100;
    keyLight.shadow.camera.far = 2500;
    keyLight.shadow.camera.left = -400;
    keyLight.shadow.camera.right = 400;
    keyLight.shadow.camera.top = 400;
    keyLight.shadow.camera.bottom = -400;
    keyLight.shadow.bias = -0.001;
    keyLight.shadow.radius = 8;
  }
  scene.add(keyLight);
  // Soft fill from lower left — gives shape without flattening shadows
  const fillLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  fillLight.position.set(-500, -200, 400);
  scene.add(fillLight);
  // Rim from upper-left-back for edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
  rimLight.position.set(-400, 400, -600);
  scene.add(rimLight);

  if (hasShadow) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // MATERIAL PRESETS (matches 3dsvg.design)
  const presets = {
    default: { color: hexInt(colorHex), metalness: 0.2, roughness: 0.28 },
    plastic: { color: hexInt(colorHex), metalness: 0.0, roughness: 0.45 },
    metal:   { color: hexInt(colorHex), metalness: 0.85, roughness: 0.3 },
    glass:   { color: hexInt(colorHex), metalness: 0.0, roughness: 0.05, transparent: true, opacity: 0.4, transmission: 0.9 },
    rubber:  { color: hexInt(colorHex), metalness: 0.0, roughness: 0.85 },
    chrome:  { color: 0xe8e8e8, metalness: 1.0, roughness: 0.05 },
    gold:    { color: 0xd4a84b, metalness: 1.0, roughness: 0.25 },
    pearl:   { color: 0xf5f1eb, metalness: 0.45, roughness: 0.18 },
    porcelain:{color: 0xfafaf6, metalness: 0.0, roughness: 0.12 },
    onyx:    { color: 0x1a1a1a, metalness: 0.9, roughness: 0.18 },
    obsidian:{ color: 0x0d0d10, metalness: 0.7, roughness: 0.12 },
    clay:    { color: hexInt(colorHex), metalness: 0.0, roughness: 0.95 },
    emissive:{ color: hexInt(colorHex), emissive: hexInt(colorHex), emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.4 },
  };
  const preset = presets[material] || presets.default;
  const frontMat = new THREE.MeshStandardMaterial(preset);
  const bevelColors = {
    gold: 0xf0c878,
    chrome: 0xffffff,
    pearl: 0xffffff,
    porcelain: 0xffffff,
    onyx: 0x444444,
    obsidian: 0x2a2a30,
  };
  const bevelMat = new THREE.MeshStandardMaterial({
    ...preset,
    color: bevelColors[material] || darken('#'+(preset.color).toString(16).padStart(6,'0'), 0.08),
    roughness: Math.max(0.02, (preset.roughness || 0.28) - 0.1)
  });

  const updSparks = hasSparks ? mkSparks(scene) : null;
  let logoBox = null;
  let rotAngle = 0;
  let elapsed = 0;

  // PIVOT = rotation point. Logo meshes centered inside.
  const pivot = new THREE.Group();
  scene.add(pivot);

  // GROUND SHADOW — vertical elliptical gradient facing camera
  // (horizontal plane would be edge-on to front camera = invisible)
  let shadowPlane = null;
  if (hasShadow) {
    const shadowGeo = new THREE.PlaneGeometry(400, 50);
    const shadowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: 0.55 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uOpacity;
        void main(){
          // Elongated horizontal ellipse — like a real ground shadow viewed from front
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(vec2(p.x * 0.7, p.y * 2.5));
          float a = smoothstep(1.0, 0.0, d);
          gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
        }`
    });
    shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    // No rotation — keep it facing the camera
    scene.add(shadowPlane);
  }

  const useColorFromSvg = container.dataset.useSvgColor === 'true';

  new SVGLoader().load(svgPath, (data) => {
    const logo = new THREE.Group();

    for (const path of data.paths) {
      // Use SVG's own fill color when requested, else use data-color
      let pathFront = frontMat, pathBevel = bevelMat;
      if (useColorFromSvg && path.color) {
        const c = path.color.getHex();
        pathFront = new THREE.MeshStandardMaterial({
          color: c, metalness: 0.25, roughness: 0.35
        });
        pathBevel = new THREE.MeshStandardMaterial({
          color: darken('#' + c.toString(16).padStart(6,'0'), 0.1),
          metalness: 0.4, roughness: 0.15
        });
      }
      for (const shape of SVGLoader.createShapes(path)) {
        logo.add(new THREE.Mesh(
          new THREE.ExtrudeGeometry(shape, {
            depth, bevelEnabled:true, bevelThickness:3, bevelSize:1.8, bevelSegments:6
          }),
          [pathFront, pathBevel]
        ));
      }
    }

    // CENTERING FIX: translate actual geometry vertices, not mesh.position
    // This ensures the geometric center is at (0,0,0) before any transforms
    const rawBox = new THREE.Box3().setFromObject(logo);
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    logo.children.forEach(child => {
      child.geometry.translate(-rawCenter.x, -rawCenter.y, -rawCenter.z);
    });

    // Now center is at origin. Apply Y-flip + scale.
    const rawSize = rawBox.getSize(new THREE.Vector3());

    const vFOV = camera.fov * Math.PI / 180;
    const visH = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const visW = visH * camera.aspect;

    // Generous margin: logo must fit at all rotation angles
    const diagW = Math.sqrt(rawSize.x * rawSize.x + depth * depth);
    // Aspect-aware fill: wide logos get more margin
    const aspect = rawSize.x / rawSize.y; // >1 = wide, <1 = tall
    const fillW = aspect > 2 ? 0.52 : 0.65; // wide logos like NUURA get smaller fill
    const fillH = 0.70;
    const s = Math.min((visW * fillW) / diagW, (visH * fillH) / rawSize.y);

    logo.scale.set(s, -s, s); // -s flips Y for SVG coords

    // Verify center is still at origin after scale
    const finalBox = new THREE.Box3().setFromObject(logo);
    const drift = finalBox.getCenter(new THREE.Vector3());
    logo.position.sub(drift);

    const fSize = finalBox.getSize(new THREE.Vector3());
    logoBox = { w: fSize.x, h: fSize.y };

    // Cast shadow for all meshes in logo
    if (hasShadow) {
      logo.traverse(m => { if (m.isMesh) m.castShadow = true; });
    }

    pivot.add(logo);

    // Position shadow plane
    // If data-shadow-y is set, use absolute Y (aligns shadows across multiple logos)
    // Otherwise auto: far below logo bottom so logo doesn't sit in its own shadow
    if (shadowPlane) {
      shadowPlane.position.y = shadowYAbs != null
        ? parseFloat(shadowYAbs)
        : -fSize.y / 2 - 50 + yOffset;
      // scale width to match logo, keep height proportional
      shadowPlane.scale.set(fSize.x / 380, 1, 1);
    }
  });

  const clock = new THREE.Clock();

  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (pivot.children.length > 0) {
      const t = elapsed;

      if (isTilt) {
        // ── TILT MODE: subtle float + tilt on the spot (no scrolling) ──
        const phase = svgPath.length * 0.7;
        // Y-rotation tilt: ±8° so depth shows
        pivot.rotation.y = Math.sin(t * 0.35 + phase) * 0.14;
        // X-tilt: ±3° for nodding feel
        pivot.rotation.x = Math.sin(t * 0.28 + phase * 1.3) * 0.055;
        pivot.rotation.z = Math.cos(t * 0.22 + phase * 0.7) * 0.02;
        // Float: noticeable up/down, gentle horizontal sway
        pivot.position.y = Math.sin(t * 0.5 + phase) * 6 + Math.sin(t * 1.1 + phase) * 1.5;
        pivot.position.x = Math.sin(t * 0.38 + phase * 0.8) * 3;

      } else if (rotateSpeed > 0) {
        const timeSinceStart = elapsed - rotDelay;
        if (timeSinceStart > 0) {
          const easeInT = Math.min(1, timeSinceStart / 1.5);
          const easeIn = easeInT * easeInT * (3 - 2 * easeInT);

          if (motion === 'float-spin') {
            // ── FLOAT + SPIN: speed ramp starts earlier, ends later ──
            const angle = rotAngle % (Math.PI * 2);
            const facing = Math.cos(angle); // 1=front, -1=back
            // Narrow readable zone (±41°): accel starts earlier
            // Full speed reached late (~120°): stays fast longer
            const t = Math.max(0, Math.min(1, (0.88 - facing) / 1.45));
            const fast = t * t * t * (t * (t * 6 - 15) + 10); // quintic
            const speedMul = 1.0 + fast * 12.0;
            rotAngle += rotateSpeed * 0.012 * speedMul * easeIn;
          } else {
            // ── DEFAULT: variable speed (slow front, fast back) ──
            const angle = rotAngle % (Math.PI * 2);
            const facing = Math.cos(angle);
            const offCenter = (1.0 - facing) * 0.5;
            const speedMul = 1.0 + offCenter * offCenter * 45.0;
            rotAngle += rotateSpeed * 0.006 * speedMul * easeIn;
          }
          pivot.rotation.y = rotAngle;
        }
      }

      if (!isTilt) {
        if (motion === 'float-spin') {
          const floatY = Math.sin(t * 0.55) * 38 + Math.sin(t * 1.4) * 6;
          const floatX = Math.sin(t * 0.35) * 10 + Math.sin(t * 0.8) * 3;
          const depthExpansion = Math.abs(Math.sin(rotAngle)) * depth * 0.3;
          pivot.position.x = floatX + nudgeX + (nudgeX > 0 ? depthExpansion : -depthExpansion);
          pivot.position.y = floatY + yOffset;
          // Constant forward X-tilt (-7°) positions surface to catch light
          // from upper key — light shimmers across letters as Y rotates
          pivot.rotation.x = -0.12 + Math.sin(t * 0.47) * 0.04;
          pivot.rotation.z = Math.sin(t * 0.31) * 0.025;
        } else {
          const floatX = Math.sin(t * 0.41) * 4 + Math.sin(t * 1.17) * 1.5;
          const floatY = Math.sin(t * 0.33) * 5 + Math.cos(t * 0.79) * 2.5;
          const depthExpansion = Math.abs(Math.sin(rotAngle)) * depth * 0.3;
          pivot.position.x = floatX + nudgeX + (nudgeX > 0 ? depthExpansion : -depthExpansion);
          pivot.position.y = floatY + yOffset;
          pivot.rotation.x = Math.sin(t * 0.29) * 0.02 + Math.sin(t * 0.67) * 0.01;
          pivot.rotation.z = Math.cos(t * 0.37) * 0.015;
        }
      }
    }

    // Dynamic shadow: combines rotation shrink + float-based pulse
    if (shadowPlane && logoBox) {
      const c = Math.cos(rotAngle);
      const rotScale = c * c; // 1 at front, 0 at sides, 1 at back

      // Float-based pulse: high logo = small/light shadow, low logo = wide/dark
      const floatY = pivot.position.y; // current Y from float animation
      const floatNorm = (floatY + 50) / 100; // -50→0, 0→0.5, +50→1
      const heightFactor = 1.3 - Math.max(0, Math.min(1, floatNorm)) * 0.6; // low=1.3, high=0.7

      const baseScale = logoBox.w / 380;
      shadowPlane.position.x = pivot.position.x;
      shadowPlane.scale.x = Math.max(0.05, baseScale * rotScale * heightFactor);
      shadowPlane.scale.y = heightFactor; // also stretches/squashes vertically
      shadowPlane.material.uniforms.uOpacity.value = 0.15 + rotScale * heightFactor * 0.5;
    }

    if (updSparks) updSparks(dt, logoBox);
    renderer.render(scene, camera);
  })();

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);
}

document.querySelectorAll('.logo-3d').forEach(initLogo3D);

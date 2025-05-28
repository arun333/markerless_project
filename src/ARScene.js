import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ARScene = () => {
  const containerRef = useRef();

  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let model = null;
    let modelLoaded = false;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let selectListenerAttached = false;

    // Setup scene, camera, renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Add AR button
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle for surface detection
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0f0 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    scene.add(controller);

    // Load model
    const loader = new GLTFLoader();
    loader.load(
      process.env.PUBLIC_URL + '/models/scene.gltf',
      (gltf) => {
        model = gltf.scene;
        model.scale.set(0.3, 0.3, 0.3);
        model.visible = false;
        scene.add(model);
        modelLoaded = true;
        console.log('%c✅ Model loaded successfully', 'color: limegreen; font-weight: bold;');
      },
      (xhr) => {
        console.log(`📦 Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
      },
      (err) => {
        console.error('❌ Model load error:', err);
      }
    );

    // Render loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        // Attach tap listener once
        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible && modelLoaded && model) {
              const mat = new THREE.Matrix4().fromArray(reticle.matrix.elements);
              const pos = new THREE.Vector3().setFromMatrixPosition(mat);
              model.position.copy(pos);
              model.visible = true;
              console.log('📍 Model placed at', pos);
            }
          });

          session.addEventListener('end', () => {
            selectListenerAttached = false;
            hitTestSourceRequested = false;
            hitTestSource = null;
          });

          selectListenerAttached = true;
        }

        // Request hit test source if needed
        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log('✅ Hit test source ready');
            });
          });

          hitTestSourceRequested = true;
        }

        // Update reticle if hit test results are valid
        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
      }

      renderer.render(scene, camera);
    });

    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} />;
};

export default ARScene;

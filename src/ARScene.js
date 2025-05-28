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

    // Basic setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Add AR button
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Lights
    const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(1, 3, 2);
    scene.add(ambient, directional);

    // Reticle for surface detection
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Load .glb model
    const loader = new GLTFLoader();
    loader.load(
      process.env.PUBLIC_URL + '/models/fish-shaped_besamin_box.glb',
      (gltf) => {
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.visible = false;

        // Ensure all mesh materials are visible
        model.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material.transparent = false;
            node.material.opacity = 1;
            node.material.depthWrite = true;
            node.material.side = THREE.DoubleSide;
            node.material.needsUpdate = true;
          }
        });

        scene.add(model);
        modelLoaded = true;
        console.log('%c✅ .glb Model loaded successfully', 'color: limegreen; font-weight: bold;');
      },
      (xhr) => {
        console.log(`📦 Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
      },
      (error) => {
        console.error('❌ Error loading model:', error);
      }
    );

    // Controller for tap interaction
    controller = renderer.xr.getController(0);
    scene.add(controller);

    // AR session loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        // Tap to place model
        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible && model && modelLoaded) {
              const mat = new THREE.Matrix4().fromArray(reticle.matrix.elements);
              const pos = new THREE.Vector3().setFromMatrixPosition(mat);
              model.position.copy(pos);
              model.position.y += 0.05; // raise slightly
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

        // Hit test setup
        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log('✅ Hit test source ready');
            });
          });
          hitTestSourceRequested = true;
        }

        // Update reticle
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

      try {
        if (renderer && renderer.xr && renderer.getContext()) {
          renderer.render(scene, camera);
        }
      } catch (e) {
        console.warn('⚠️ Render skipped due to context loss', e);
      }
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

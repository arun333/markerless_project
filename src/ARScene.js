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

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // AR Button
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 3, 2);
    scene.add(directionalLight);

    // Reticle
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    scene.add(controller);

    // Load Model
    const loader = new GLTFLoader();
    loader.load(
      process.env.PUBLIC_URL + '/models/scene.gltf',
      (gltf) => {
        model = gltf.scene;
        model.scale.set(0.3, 0.3, 0.3);
        model.visible = false;
        scene.add(model);
        scene.add(new THREE.BoxHelper(model, 0xffff00)); // debugging box
        modelLoaded = true;
        console.log('%c✅ Model loaded successfully', 'color: limegreen; font-weight: bold;');
      },
      (xhr) => {
        console.log(`📦 Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
      },
      (error) => {
        console.error('❌ Model load error:', error);
      }
    );

    // Render loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        // Hit test source setup
        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log('✅ Hit test source ready');
            });
          });

          session.addEventListener('end', () => {
            selectListenerAttached = false;
            hitTestSourceRequested = false;
            hitTestSource = null;
          });

          hitTestSourceRequested = true;
        }

        // Tap handler setup
        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible && modelLoaded && model) {
              const mat = new THREE.Matrix4().fromArray(reticle.matrix.elements);
              const pos = new THREE.Vector3().setFromMatrixPosition(mat);

              model.position.copy(pos);
              model.position.y += 0.05; // Raise slightly above floor
              model.visible = true;

              console.log('📍 Model placed at', model.position);
            }
          });

          selectListenerAttached = true;
        }

        // Reticle update
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
        console.warn('⚠️ Render skipped due to lost context', e);
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

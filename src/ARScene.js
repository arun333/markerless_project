import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import gsap from 'gsap';
import { mod } from 'three/tsl';

const ARScene = () => {
  const containerRef = useRef();
  const [selectedModel, setSelectedModel] = useState('shark.glb');


  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let selectListenerAttached = false;
    let model = null; // globally track your model
    let modelGroup = null;

    let modelPlaced = false;
    let mixer;
    const clock = new THREE.Clock();

      // Touch rotation variables
    let isTouching = false;
    let previousTouchX = 0;
    let previousTouchY = 0;




    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    document.body.appendChild(
      ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
    );

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    controller = renderer.xr.getController(0);
    scene.add(controller);

    const loader = new GLTFLoader();

    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible && !modelPlaced) {
                loader.load(`models/${selectedModel}`, (gltf) => {
                if (modelGroup) {
                  scene.remove(modelGroup);
                  modelGroup = null;
                }


              model = gltf.scene;
              modelGroup = new THREE.Group();
              modelGroup.add(model);


              modelGroup.position.setFromMatrixPosition(reticle.matrix);
              modelGroup.scale.set(0.15, 0.15, 0.15);

              modelGroup.userData.originalY = modelGroup.position.y;

              scene.add(modelGroup);


               mixer = new THREE.AnimationMixer(model);
                if (gltf.animations && gltf.animations.length > 0) {
                  gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                  });
                } else {
                  console.warn('No animations found in glTF model');
                }

              modelPlaced = true;

              reticle.visible = false;

                //console.log("Model placed at", dolphinModel.position);

                
               
              });
            }

           
          });

          selectListenerAttached = true;
        }

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log("Hit test source ready");
            });
          });

          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            selectListenerAttached = false;
            modelPlaced = false;
            if (modelGroup) {
              scene.remove(modelGroup);
              modelGroup = null;
            }
          });

          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(renderer.xr.getReferenceSpace());
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
        if (modelGroup && !modelPlaced) {
             const camera = renderer.xr.getCamera();
              const cameraPosition = new THREE.Vector3();
              camera.getWorldPosition(cameraPosition);

              const cameraDirection = new THREE.Vector3();
              camera.getWorldDirection(cameraDirection);

              // Set dolphin in front of the camera at a fixed distance (e.g. 1 meter)
              const distance = 1.0;
              const targetPosition = cameraPosition.clone().add(cameraDirection.multiplyScalar(distance));

              modelGroup.position.lerp(targetPosition, 0.1); // Smoothly follow
             // dolphinModel.lookAt(cameraPosition); 

        }

         if (modelGroup && selectedModel === 'whale.glb' && modelPlaced) {
          const t = clock.getElapsedTime();
          modelGroup.position.y = modelGroup.userData.originalY + Math.sin(t * 2) * 0.05;
        }
        const delta = clock.getDelta();
          if (mixer) mixer.update(delta);

          renderer.render(scene, camera);

  }

    });

    //Touch Event Listeners
    const onTouchStart = (e) => {
      if (modelPlaced && e.touches.length === 1) {
        isTouching = true;
        previousTouchX = e.touches[0].clientX;
        previousTouchY = e.touches[0].clientY;

      }
    };

    const onTouchMove = (e) => {
      if (!isTouching || e.touches.length !== 1 || !modelGroup) return;

      const currentTouchX = e.touches[0].clientX;
      const currentTouchY = e.touches[0].clientY;

      const deltaX = currentTouchX - previousTouchX;
      const deltaY = currentTouchY - previousTouchY;

      previousTouchX = currentTouchX;
      previousTouchY = currentTouchY;

      const rotationSpeed = 0.005;
      modelGroup.rotation.y += deltaX * rotationSpeed; // Horizontal (left/right)
      modelGroup.rotation.x += deltaY * rotationSpeed; // Vertical (up/down)

      // Optional: Clamp vertical rotation if needed (e.g., to avoid flipping)
      modelGroup.rotation.x = THREE.MathUtils.clamp(modelGroup.rotation.x, -Math.PI / 2, Math.PI / 2);
    };
    

    const onTouchEnd = () => {
      isTouching = false;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [selectedModel]);

  return (
    <div>
      {/* Dropdown menu */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999 }}>
        <select
          value={selectedModel}
          onChange={(e) => {setSelectedModel(e.target.value);}}
        >
          <option value="shark.glb">Shark</option>
          <option value="whale.glb">Dolphin</option>
        </select>
      </div>

      <div ref={containerRef} />
    </div>
  );
};

export default ARScene;
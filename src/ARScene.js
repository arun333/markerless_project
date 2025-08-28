import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import gsap from 'gsap';

const ARScene = () => {
  const containerRef = useRef();
  const [selectedModel, setSelectedModel] = useState('shark');
  //const [modelPlaced, setModelPlaced] = useState(false);
  const modelPlacedRef = useRef(false);
  const [, forceUpdate] = useState(0);


  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let selectListenerAttached = false;
    let activeModel  = null; // globally track your model
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

     //Touch Event Listeners
    const onTouchStart = (e) => {
      if (modelPlacedRef.current && e.touches.length === 1) {
        isTouching = true;
        previousTouchX = e.touches[0].clientX;
        previousTouchY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (!isTouching || e.touches.length !== 1 || !activeModel) return;
      const deltaX = e.touches[0].clientX - previousTouchX;
      const deltaY = e.touches[0].clientY - previousTouchY;
      previousTouchX = e.touches[0].clientX;
      previousTouchY = e.touches[0].clientY;

      const rotationSpeed = 0.005;
      activeModel.rotation.y += deltaX * rotationSpeed; // horizontal swipe
      activeModel.rotation.x += deltaY * rotationSpeed; // vertical swipe
    };

    const onTouchEnd = () => {
      isTouching = false;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible && !modelPlaced) {
                const modelPath = selectedModel === 'shark' ? 'models/shark.glb' : 'models/fish.glb';

                loader.load(modelPath, (gltf) => {
                // Remove existing model if any
                if (activeModel) {
                  scene.remove(activeModel);
                  activeModel = null;
                }

                activeModel = gltf.scene;
                activeModel.position.setFromMatrixPosition(reticle.matrix);
                activeModel.scale.set(0.15, 0.15, 0.15);
                scene.add(activeModel);
                modelPlacedRef.current = true;
                forceUpdate((x) => x + 1);

                reticle.visible = false;

               mixer = new THREE.AnimationMixer(activeModel);
                if (gltf.animations && gltf.animations.length > 0) {
                  const clip = gltf.animations[0];
                  const action = mixer.clipAction(clip);
                  action.setLoop(THREE.LoopRepeat);
                  action.play();
                }
                
                /*

                // Animate model jump toward camera
                const cameraDir = new THREE.Vector3();
                camera.getWorldDirection(cameraDir);
                cameraDir.multiplyScalar(0.5); // how far forward to jump

                const jumpTarget = {
                  x: model.position.x + cameraDir.x,
                  y: model.position.y + 0.3, // jump height
                  z: model.position.z + cameraDir.z,
                };

                gsap.to(model.position, {
                  ...jumpTarget,
                  duration: 1.5,
                  ease: 'power2.out',
                  yoyo: true,
                  repeat: 1,
                  onComplete: () => {
                    console.log('Jump animation complete');
                  },
                });

                gsap.to(model.rotation, {
                  y: model.rotation.y + Math.PI * 2,
                  duration: 1.5,
                  ease: 'power2.inOut',
                });
                */
              });
            }

           
          });

           session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            selectListenerAttached = false;
            setModelPlaced(false);
            activeModel = null;
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


          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length>0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(renderer.xr.getReferenceSpace());
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
        /*
        if (dolphinModel) {
             const camera = renderer.xr.getCamera();
              const cameraPosition = new THREE.Vector3();
              camera.getWorldPosition(cameraPosition);

              const cameraDirection = new THREE.Vector3();
              camera.getWorldDirection(cameraDirection);

              // Set dolphin in front of the camera at a fixed distance (e.g. 1 meter)
              const distance = 1.0;
              const targetPosition = cameraPosition.clone().add(cameraDirection.multiplyScalar(distance));

              dolphinModel.position.lerp(targetPosition, 0.1); // Smoothly follow
             // dolphinModel.lookAt(cameraPosition); 

    }
             */
     const delta = clock.getDelta();
      if (mixer) mixer.update(delta);

      renderer.render(scene, camera);

  }

    });

   
    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [selectedModel, modelPlaced]);

 return (
    <>
      <select
        onChange={(e) => {
          setSelectedModel(e.target.value);
          setModelPlaced(false); // allow re-placing model
        }}
        style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}
      >
        <option value="shark">Shark</option>
        <option value="dolphin">Dolphin</option>
      </select>
      <div ref={containerRef} />
    </>
  );
};

export default ARScene;

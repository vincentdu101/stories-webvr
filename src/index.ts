import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton";
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Group } from "three";
import { OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader} from "three/examples/jsm/loaders/OBJLoader";

let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let mixer: AnimationMixer;
let controls: OrbitControls;
let axes = new THREE.AxesHelper(500);
let clock = new THREE.Clock();
let objLoader = new OBJLoader();
let leftCanyon;
let rightCanyon;
let rightGoat;
let log;
let water;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let speed = 2;
let delta = 0;
let depthTarget, depthTarget2;
let messageHeight: number = 200;

let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let vertex = new THREE.Vector3();
let color = new THREE.Color();

init();
animate();

function getHeight() {
    let height = window.innerHeight - messageHeight;
    return height > 200 ? height : window.innerHeight / 2;
}

function getMessageHeight() {
    if (window.innerHeight < messageHeight) {
        return window.innerHeight / 2;
    } else {
        return messageHeight;
    }
}

function setupMessageBox() {
    let message = document.getElementById("message");
    let title = document.createElement("h3");
    let textContent = document.createTextNode("The Two Goats");
    title.appendChild(textContent);
    message.appendChild(title);
    message.style.top = getHeight() + "px";
}

function createWaterMesh(): THREE.Mesh {
    let vertShader = `
        uniform float uTime;
        varying vec2 vUV;
        varying vec3 WorldPosition;

        void main() {
            vec3 pos = position;
            pos.z += cos(pos.x * 5.0 + uTime) * 0.1 * sin(pos.y * 5.0 + uTime);
            WorldPosition = pos;
            vUV = uv;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    
    `;

    let fragShader = `
        #include <packing>
        varying vec2 vUV;
        varying vec3 WorldPosition;

        uniform sampler2D uSurfaceTexture;
        uniform sampler2D uDepthMap;
        uniform sampler2D uDepthMap2;
        uniform float uTime;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform vec4 uScreenSize;
        uniform bool isMask;

        float readDepth(sampler2D depthSampler, vec2 coord) {
            float fragCoordZ = texture2D(depthSampler, coord).x;
            float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
            return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
        }

        float getLinearDepth(vec3 pos) {
            return -(viewMatrix * vec4(pos, 1.0)).z;
        }

        float getLinearScreenDepth(sampler2D map) {
            vec2 uv = gl_FragCoord.xy * uScreenSize.zw;
            return readDepth(map, uv);
        }

        void main() {
            vec4 color = vec4(0.0, 0.7, 1.0, 0.5);

            vec2 pos = vUV * 2.0;
            pos.y -= uTime * 0.002;
            vec4 WaterLines = texture2D(uSurfaceTexture, pos);
            color.rgba += WaterLines.r * 0.1;

            float worldDepth = getLinearScreenDepth(uDepthMap2);
            float screenDepth = getLinearScreenDepth(uDepthMap);
            float foamLine = clamp((screenDepth - worldDepth), 0.0, 1.0);

            if (foamLine < 0.001) {
                color.rgba += 0.2;
            }

            if (isMask) {
                color = vec4(1.0);
            }

            gl_FragColor = color;
        }
    `;
    
    let waterLinesTexture = THREE.ImageUtils.loadTexture("./src/texture/WaterTexture.png");
    waterLinesTexture.wrapS = THREE.RepeatWrapping;
    waterLinesTexture.wrapT = THREE.RepeatWrapping;
    
    let uniforms = {
        uTime: {value: 0.0},
        uSurfaceTexture: {type: "t", value: waterLinesTexture},
        cameraNear: {value: camera.near},
        cameraFar: {value: camera.far},
        uDepthMap: {value: depthTarget.depthTexture},
        uDepthMap2: {value: depthTarget2.depthTexture},
        isMask: {value: false},
        uScreenSize: {value: new THREE.Vector4(
            window.innerWidth, getHeight(), 1/window.innerWidth, 1/getHeight()
        )}
    };

    let waterGeometry = new THREE.PlaneGeometry(50, 50, 50, 50);
    let waterMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertShader,
        fragmentShader: fragShader,
        transparent: true,
        depthWrite: false
    });

    let waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 2;
    waterMesh.material = waterMaterial;
    return waterMesh;
}

function init() {

    setupMessageBox();

    // set up depth buffer
    depthTarget = new THREE.WebGLRenderTarget(window.innerWidth, getHeight());
    depthTarget.texture.format = THREE.RGBAFormat;
    depthTarget.texture.minFilter = THREE.NearestFilter;
    depthTarget.texture.magFilter = THREE.NearestFilter;
    depthTarget.texture.generateMipMaps = false;
    depthTarget.stencilBuffer = false;
    depthTarget.depthBuffer = true;
    depthTarget.depthTexture = new THREE.DepthTexture(window.innerWidth, getHeight());
    depthTarget.depthTexture.type = THREE.UnsignedShortType;

    // used as hack to get the depth of the pixels at the water surface by redrawing the 
    // scene with the water in the depth buffer
    depthTarget2 = new THREE.WebGLRenderTarget(window.innerWidth, getHeight());
    depthTarget2.texture.format = THREE.RGBAFormat;
    depthTarget2.texture.minFilter = THREE.NearestFilter;
    depthTarget2.texture.magFilter = THREE.NearestFilter;
    depthTarget2.texture.generateMipMaps = false;
    depthTarget2.stencilBuffer = false;
    depthTarget2.depthBuffer = true;
    depthTarget2.depthTexture = new THREE.DepthTexture(window.innerWidth, getHeight());
    depthTarget2.depthTexture.type = THREE.UnsignedShortType;    


    // fov smaller means closer, bigger means farther view
    camera = new THREE.PerspectiveCamera( 7, window.innerWidth / getHeight(), 1, 1000 );
    // camera.position.set(1000, 10, 1500);

    camera.position.x = 75;
    camera.position.y = 50;
    camera.position.z = 0;
    window["camera"] = camera;

    scene = new THREE.Scene();
    // scene.background = new THREE.Color( 0xffffff );
    scene.background = new THREE.Color().setHSL( 0.6, 0, 1 );
    scene.fog = new THREE.Fog( 0xffffff, 0, 750 );
    scene.add(axes);

    let dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.color.setHSL( 0.1, 1, 0.95 );
    dirLight.position.set( - 1, 50, 1 );
    dirLight.position.multiplyScalar( 30 );
    scene.add( dirLight );

    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;

    // floor
    let floorGeometry = new THREE.PlaneBufferGeometry( 20000, 20000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );

    // vertex displacement

    let position = <THREE.BufferAttribute> floorGeometry.attributes.position;

    for ( let i = 0, l = position.count; i < l; i ++ ) {

        vertex.fromBufferAttribute( position, i );

        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;

        position.setXYZ( i, vertex.x, vertex.y, vertex.z );

    }

    floorGeometry = <THREE.PlaneBufferGeometry> floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = <THREE.BufferAttribute> floorGeometry.attributes.position;
    let colors = [];

    for ( let i = 0, l = position.count; i < l; i ++ ) {

        color = new THREE.Color(0x6B8E23);
        colors.push( color.r, color.g, color.b );

    }

    floorGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    let floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );

    let floor = new THREE.Mesh( floorGeometry, floorMaterial );
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add( floor );

    // SkyBox
    let sunlight = new THREE.HemisphereLight(
        0xffffbb, 0x080820, 1
    );
    sunlight.position.set(0, 5, 0);
    scene.add(sunlight);


    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, getHeight() );
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );
    document.body.appendChild(VRButton.createButton(renderer));

    // controls 
    controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.05;
    // controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = 100;
    // controls.maxPolarAngle = Math.PI * 0.5;
    controls.enableZoom = false;

    // goat
    let loader = new GLTFLoader().setPath("./src/models/goat/");
    loader.load("scene.gltf", (gltf: GLTF) => {
        mixer = new THREE.AnimationMixer(gltf.scene);
        let action = mixer.clipAction(gltf.animations[0]);
        action.play();
        gltf.scene.position.y = 3.5;
        gltf.scene.position.z = 0;
        scene.add(gltf.scene);
        rightGoat = gltf;
    }, (event: any) => {
        console.log(event);
    }, (event: any) => {
        console.log(event);
    });

    // water
    water = createWaterMesh();
    scene.add(water);

    // log
    objLoader.load("./src/models/log/low_poly_log.obj", (object) => {
        object.position.y = 3;
        object.position.z = 0;
        object.scale.set(0.01, 0.01, 0.04);
        scene.add(object);
        log = object;
    });

    // canyon
    objLoader.load("./src/models/mountain_canyon_01.obj", (object) => {
        object.position.set(20, 1, -1);
        object.rotateX(180);
        window["canyon"] = object;
        scene.add(object);
        leftCanyon = object;

        rightCanyon = object.clone();
        rightCanyon.position.set(20, 1, 10);
        scene.add(rightCanyon);
    });

    window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / getHeight();
    camera.updateProjectionMatrix();

    // rightGoat.scene.setSize(window.innerWidth, getHeight());
    // log.setSize(window.innerWidth, getHeight());
    // leftCanyon.setSize(window.innerWidth, getHeight());
    // rightCanyon.setSize(window.innerWidth, getHeight());

    renderer.setSize( window.innerWidth, getHeight() );
    water.uniforms.uScreenSize = new THREE.Vector4(
        window.innerWidth, getHeight(), 1 / window.innerWidth, 1 / getHeight()
    );

}

function animate() {

    requestAnimationFrame( animate );

    controls.update();

    delta = clock.getDelta();

    if (mixer) {
        mixer.update(delta);
    }

    if (water) {
        water.material.uniforms.uTime.value += 0.1;
    }

    // if ( controls.isLocked === true ) {

    //     raycaster.ray.origin.copy( controls.getObject().position );
    //     raycaster.ray.origin.y -= 10;

    //     let intersections = raycaster.intersectObjects( objects );

        // let onObject = intersections.length > 0;

        // let time = performance.now();
        // let delta = ( time - prevTime ) / 1000;

        // velocity.x -= velocity.x * 10.0 * delta;
        // velocity.z -= velocity.z * 10.0 * delta;

        // velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        // direction.z = Number( moveForward ) - Number( moveBackward );
        // direction.x = Number( moveRight ) - Number( moveLeft );
        // direction.normalize(); // this ensures consistent movements in all directions

        // if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
        // if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

        // if ( onObject === true ) {

        //     velocity.y = Math.max( 0, velocity.y );
        //     canJump = true;

        // }

        // controls.moveRight( - velocity.x * delta );
        // controls.moveForward( - velocity.z * delta );

        // controls.getObject().position.y += ( velocity.y * delta ); // new behavior

        // if ( controls.getObject().position.y < 10 ) {

        //     velocity.y = 0;
        //     controls.getObject().position.y = 10;

        //     canJump = true;

        // }

        // prevTime = time;

    // }

    renderer.render( scene, camera );

}
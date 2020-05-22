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
let log = new OBJLoader();
let leftCanyon = new OBJLoader();
let rightCanyon;
let rightGoat;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let speed = 2;
let delta = 0;

let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let vertex = new THREE.Vector3();
let color = new THREE.Color();

init();
animate();

function init() {

    // fov smaller means closer, bigger means farther view
    camera = new THREE.PerspectiveCamera( 7, window.innerWidth / window.innerHeight, 1, 1000 );
    // camera.position.set(1000, 10, 1500);

    camera.position.x = 15;
    camera.position.y = 5;
    camera.position.z = 0;
    camera.zoom = 50;
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

    // window["light"] = light;
    // window["lightHelper"] = lightHelper;

    let blocker = document.getElementById( 'blocker' );
    let instructions = document.getElementById( 'instructions' );

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
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );
    document.body.appendChild(VRButton.createButton(renderer));

    // controls 
    controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.05;
    // controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    // controls.maxPolarAngle = Math.PI * 0.5;
    controls.enableZoom = false;

    // goat
    let loader = new GLTFLoader().setPath("./src/models/goat/");
    loader.load("scene.gltf", (gltf: GLTF) => {
        mixer = new THREE.AnimationMixer(gltf.scene);
        let action = mixer.clipAction(gltf.animations[0]);
        action.play();
        console.log(camera.position);
        // gltf.scene.position.set(camera.position.x, camera.position.y, camera.position.z);
        gltf.scene.position.y = 3.5;
        gltf.scene.position.z = 0;
        scene.add(gltf.scene);
        window["gltf"] = gltf;
    }, (event: any) => {
        console.log(event);
    }, (event: any) => {
        console.log(event);
    });

    // log
    log.load("./src/models/log/low_poly_log.obj", (object) => {
        object.position.y = 3;
        object.position.z = 0;
        object.scale.set(0.01, 0.01, 0.04);
        scene.add(object);
    });

    // canyon
    leftCanyon.load("./src/models/mountain_canyon_01.obj", (object) => {
        object.position.set(20, 1, -1);
        object.rotateX(180);
        window["canyon"] = object;
        scene.add(object);

        rightCanyon = object.clone();
        rightCanyon.position.set(20, 1, 10);
        scene.add(rightCanyon);
    });

    window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    requestAnimationFrame( animate );

    controls.update();

    delta = clock.getDelta();

    if (mixer) {
        mixer.update(delta);
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
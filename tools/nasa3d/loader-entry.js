import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import { toCreasedNormals } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE.GLTFLoader = GLTFLoader;
window.THREE.MeshoptDecoder = MeshoptDecoder;
window.THREE.toCreasedNormals = toCreasedNormals;

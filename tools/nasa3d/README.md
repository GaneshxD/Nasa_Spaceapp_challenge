# How the NASA model library was made

These scripts turned NASA 3D Resources into `assets/nasa3d/` and
`assets/moon-sites.js`. They are kept so the work can be checked or repeated;
the game does not need them to run.

Needs Node 18+, Python 3 with Pillow and numpy, and about 1.5 GB of disk.

```sh
cd tools/nasa3d
npm install @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp draco3dgltf three@0.149.0 esbuild
mkdir -p work/raw
# 1. the file list of github.com/nasa/NASA-3D-Resources
curl -L "https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1" -o work/tree.json
# 2. download every .glb into work/raw/NNN.glb and write work/index.json ([{i, path, size}], sorted by path),
#    then: previews, printable STL files, textures, and the manifest
python3 prep.py
# 3. simplify every model (about 15 minutes on one core)
node batch.mjs
# 4. the six Apollo landing sites as height grids
python3 gen-sites.py
# 5. write assets/nasa3d/ (one script per model, thumbnails, catalog.js)
python3 pack.py
# 6. the glTF loader as a plain script
npx esbuild loader-entry.js --bundle --format=iife --minify --alias:three=./three-shim.js --outfile=../../vendor/gltf-loader.min.js
```

Step 2's download of the `.glb` files is not scripted here: fetch each path in
`tree.json` that ends in `.glb` from
`https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/<path>`.

What `process.mjs` does to a model: decode Draco, drop animations and the
extra material layers phones draw slowly, merge parts, weld, simplify to a
triangle budget (falling back to grid clustering for models made of thousands
of loose pieces), drop normals, resize textures to WebP, quantise and
meshopt-compress. Six source files point at texture files that are not in
NASA's repository; those textures become plain white.

The names, collections and descriptions shown in the hangar are in `pack.py`.

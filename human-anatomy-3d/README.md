# Anatomica 3D – Interactive Human Anatomy

A 3D human anatomy website with a beige theme. It shows the **skeleton (34 bone groups)**, the **muscular system (56 muscles and tendons)** and the **nervous system (20 structures)** for a **male** and a **female** body.

## Features
- **3D Body Explorer**: rotate, zoom and pan the full body. Turn each system on or off and change its opacity. Use X-ray mode to see through layers.
- **Click any part**: a panel slides in from the left with the part's name, its Latin name, a description, key facts and male/female notes. You can zoom to the part, isolate it, or open it in the Atlas.
- **Male / Female buttons**: switch between body types. The female body has a wider pelvis, narrower shoulders and ribcage, a larger Q-angle and a smaller overall size.
- **Parts Atlas**: every bone, muscle and nerve is shown on its own, piece by piece. You can filter by body system, by region or by name.
- **Full-body location view**: clicking a piece in the Atlas slides in a 3D panel from the right. It shows that piece highlighted inside its own system only. For example, a bone is shown in the full skeleton with no muscles or nerves.

## Running it
There is no build step. Serve this folder with any static web server (ES modules need http://):

```bash
cd human-anatomy-3d
python3 -m http.server 8000
# open http://localhost:8000
```

three.js r160 and the meshoptimizer decoder are included in `lib/` (MIT licences), so the app works offline apart from the Google Fonts.

## How the 3D model is made
The bones and muscles are sculpted in code as smoothly blended shapes (signed distance fields). Bones are built from their real landmarks: condyles, tubercles, sockets, foramina and processes. Muscles are built from many fibre bundles that run from origin to insertion. The result is turned into a mesh, simplified and compressed into `model/anatomy.bin`, which the page loads in about a second.

To change the anatomy, edit `js/anatomy.js` and rebuild the model:

```bash
cd tools
npm install
npm run build
```

## Files
- `index.html`, `css/style.css`: the page layout and the beige theme
- `js/anatomy.js`: sculpts the bones, muscles and nerves (used by the build tool)
- `js/sdf.js`: the shape-sculpting engine (blended shapes and mesh generation)
- `js/model.js`, `js/warp.js`: load the built model in the browser and apply the female proportions
- `model/`: the pre-built, compressed 3D model
- `tools/`: the offline model build script
- `js/geometry.js`: helper functions for tubes, sheets and ellipsoids
- `js/data.js`: the names, descriptions and facts for every part
- `js/app.js`: the viewer, picking, slide panels, Atlas thumbnails and full-body view

The anatomy is a simplified model built for learning. It is not medically exact.

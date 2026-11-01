# Anatomica 3D – Interactive Human Anatomy

A 3D human anatomy website with a beige theme. It shows the **skeleton (32 bone groups)**, the **muscular system (37 muscles)** and the **nervous system (20 structures)** for a **male** and a **female** body.

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

three.js r160 is included in `lib/` (MIT licence), so the app works offline apart from the Google Fonts.

## Files
- `index.html`, `css/style.css`: the page layout and the beige theme
- `js/anatomy.js`: builds the 3D model of the bones, muscles and nerves, plus the female proportions
- `js/geometry.js`: helper functions for tubes, sheets and ellipsoids
- `js/data.js`: the names, descriptions and facts for every part
- `js/app.js`: the viewer, picking, slide panels, Atlas thumbnails and full-body view

The anatomy is a simplified model built for learning. It is not medically exact.

# SOLARIS — Third-party notices

This project bundles third-party textures, libraries, fonts and derived astronomical data.
All rights remain with their original authors. The notes below satisfy the attribution
requirements of the respective licenses.

---

## Planet, moon and ring textures

**© Solar System Scope — licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).**

- Project: Solar System Scope
- Source: https://www.solarsystemscope.com/textures/
- License: https://creativecommons.org/licenses/by/4.0/
- Changes made for this project: files were downscaled (8K → 4K or 2K), recompressed,
  and are rendered with custom shaders and colour grading. No astronomical content was altered.

Files used from this set:

```
textures/2k_sun.jpg
textures/sun-4k.jpg                    (derived from 8k_sun.jpg)
textures/2k_mercury.jpg
textures/2k_venus_atmosphere.jpg
textures/2k_earth_daymap.jpg
textures/earth-day-4k.jpg              (derived from 8k_earth_daymap.jpg)
textures/2k_earth_nightmap.jpg
textures/2k_earth_clouds.jpg
textures/2k_mars.jpg
textures/mars-4k.jpg                   (derived from 8k_mars.jpg)
textures/jupiter-4k.jpg
textures/2k_saturn.jpg
textures/saturn-4k.jpg                 (derived from 8k_saturn.jpg)
textures/2k_saturn_ring_alpha.png
textures/2k_uranus.jpg
textures/2k_neptune.jpg
textures/moon-4k.jpg                   (derived from 8k_moon.jpg)
```

Attribution to display with the work:

> Planet and lunar textures © Solar System Scope, licensed under CC BY 4.0
> (https://www.solarsystemscope.com/textures/). Textures resized for web use.

---

## Earth specular map

`textures/earth_specular_2048.jpg`

- Source: three.js examples (`https://threejs.org/examples/textures/planets/earth_specular_2048.jpg`)
- Project: three.js — https://threejs.org/
- License: MIT (see below)

---

## Rendering library

**three.js r170**

- Copyright © 2010–2024 three.js authors
- License: MIT — the full license text is included at `lib/three/LICENSE`
- Bundled addons: OrbitControls, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass,
  MaskPass, Pass, CopyShader, LuminosityHighPassShader.
- Source: https://github.com/mrdoob/three.js/

---

## Fonts

All bundled webfonts are licensed under the **SIL Open Font License 1.1 (OFL-1.1)**.
They are self-hosted; the CJK faces are text subsets generated for this interface.
Font files were obtained from Google Fonts (https://fonts.google.com/).

| Family | Designer / Foundry | License |
| --- | --- | --- |
| Fraunces | Phaedra Charles & Flavia Zimbardi, Undercase Type | OFL-1.1 |
| Cormorant Garamond | Christian Thalmann, Catharsis Fonts | OFL-1.1 |
| Space Grotesk | Florian Karsten | OFL-1.1 |
| IBM Plex Mono | IBM / Bold Monday | OFL-1.1 |
| Noto Serif SC | Google / Adobe | OFL-1.1 |
| Noto Sans SC | Google / Adobe | OFL-1.1 |

OFL-1.1 text: https://openfontlicense.org/open-font-license-official-text/

---

## Astronomical data

- **JPL Solar System Dynamics** — E. M. Standish, *Approximate Positions of the Planets*,
  based on Keplerian elements valid for 1800–2050:
  https://ssd.jpl.nasa.gov/planets/approx_pos.html
- **NASA NSSDC Planetary Fact Sheets** (mean radii, masses, rotation, temperatures, gravity):
  https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Confirmed natural-satellite counts follow the IAU / Wikipedia tallies current in 2026.

Astronomical data and the derived real-time positions were computed locally; the app does
not fetch external services at runtime.

---

## Original work

The interface, layout, copy, custom GLSL shaders, procedural nebula, procedural moon
textures, camera choreography, audio synthesis and application code were created for this
project in 2026.

The preview images in `preview/` are screenshots of this application and contain the
CC BY 4.0 Solar System Scope textures listed above.

If you redistribute this project, please retain this notice and the CC BY attribution
for the Solar System Scope textures.

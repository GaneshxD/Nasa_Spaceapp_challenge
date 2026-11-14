# Credits

## NASA data (public domain)

| File | What it is | Source |
| --- | --- | --- |
| `assets/nasa-fires.js` | 126 real fire detections from 2023 (MODIS on Terra and Aqua, Collection 6.1 archive), plus about 1,600 detections from 7 to 14 November 2026 (MODIS near-real-time, global 7-day file) | NASA FIRMS, https://firms.modaps.eosdis.nasa.gov/ |
| `assets/img/earth_day_nasa_gibs_blue_marble.jpg` | Blue Marble Next Generation, August 2004, 4096 × 2048 | NASA GIBS / Worldview snapshot service, layer `BlueMarble_NextGeneration` |
| `assets/img/earth_night_nasa_gibs_black_marble.jpg` | Black Marble 2016 (VIIRS, Suomi NPP), resized to 2048 × 1024 | NASA GIBS / Worldview snapshot service, layer `VIIRS_Black_Marble` |

All three were downloaded directly from NASA servers on 14 November 2026.
We acknowledge the use of data from NASA's Fire Information for Resource
Management System (FIRMS) and imagery from NASA's Global Imagery Browse
Services (GIBS), both part of NASA's Earth Science Data and Information
System (ESDIS). NASA material is not copyrighted; using it does not mean NASA
endorses this game.

`assets/textures.js` holds the two images as data URLs (see
`tools/embed-textures.js` for why).

## Code

- **three.js r149** (`vendor/three.min.js`), MIT licence. Licence text in
  `vendor/three.LICENSE.txt`.

## Fonts (SIL Open Font License 1.1)

- **Fredoka** (headings and numbers). Licence in `assets/fonts/Fredoka-OFL.txt`.
- **Nunito** (reading text). Licence in `assets/fonts/Nunito-OFL.txt`.

Font files come from the Fontsource packages `@fontsource/fredoka` and
`@fontsource/nunito`.

## Everything else

The game design, code, 3D models (built in code), the guide character Pip, icons,
sounds (made on the fly with the Web Audio API) and writing are original to
this project and released under the MIT licence in `LICENSE`.

The lesson-path layout, stars and chunky buttons are inspired by how Duolingo
and Candy Crush guide players step by step. No artwork, characters, sounds or
code from either are used.

Built for the 2026 NASA Space Apps Challenge, "Space Mission Design Game".

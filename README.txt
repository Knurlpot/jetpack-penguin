JETPACK PENGUIN

How to run
----------
This is a browser game written in plain JavaScript. No npm install or build
step is needed. Run index.html in a browser; game.js cannot run on its own
with Node.js because it uses the page's canvas and browser APIs.

Option 1: Open directly
1. Keep index.html, game.js, style.css, and the assets folder together.
2. Double-click index.html to open it in a modern web browser.

Option 2: Use a local web server (requires Python 3)
1. Open a terminal in the jetpack-penguin project folder.
2. Run:

   python3 -m http.server 8000

3. Open http://localhost:8000 in your browser.
4. Leave the terminal running while playing. Press Ctrl+C to stop the server.

If port 8000 is already in use, choose another port, such as 8001, in both
the command and the browser URL.

How to play
-----------
- Press Space or click/tap the game canvas to start.
- Press Space repeatedly or click/tap to fire the jetpack and stay airborne.
  Holding Space does not repeatedly fire it.
- Fly through the gaps and avoid the obstacles and the ground.
- On the title screen, use the on-screen arrows or Left/Right keys to choose
  a penguin skin and its matching world. The selected skin is saved in this
  browser.
- After Game Over, press Space or click/tap to retry.
- Your best score is saved in this browser when local storage is available.

Project files
-------------
- index.html: page entry point and game canvas.
- game.js: game logic, rendering, sound, and input controls.
- style.css: page styling.
- assets/: penguin sprites and background images.

To adjust difficulty, edit the constants near the top of game.js (for example,
GAP, SPEED, G, and FLAP). To disable click/tap controls, set TOUCH_CONTROL to
false near the bottom of game.js.

Troubleshooting
---------------
- If the game stays blank, confirm that all files in assets/ are present and
  that you opened index.html. Try the local-server option above.
- Internet access is only needed for the Google Fonts typeface linked in
  index.html; a monospace fallback is configured if the font cannot load.

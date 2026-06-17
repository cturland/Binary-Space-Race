# Binary Space Race

Binary Space Race is a browser-based classroom game for practising binary and hexadecimal conversions. It uses plain HTML, CSS and JavaScript with an HTML5 Canvas.

## Project Structure

```text
.
|-- assets/
|   `-- graphics/
|-- index.html
|-- styles.css
|-- js/
|   `-- game.js
`-- README.md
```

## Game Rules

1. Select a conversion mode from the start menu.
2. Use the arrow keys to move the spaceman around the moon.
3. Touch a crate to open a conversion question.
4. Movement pauses while the question is open, but the timer keeps running.
5. Type the answer and press Enter or click Submit.
6. A correct answer removes the crate and increases the rocket piece count.
7. An incorrect answer keeps the same question open and adds a 5 second time penalty.
8. Reach 8/8 rocket pieces to board the rocket and launch it.
9. After launch, enter exactly 3 initials to save the score in the local high score table.

Press Escape during a mission to open a confirmation prompt for returning to the main menu and cancelling the current run.

## Conversion Modes

- Binary to Decimal / Decimal to Binary: 4-bit values from 0 to 15
- Binary to Decimal / Decimal to Binary: 8-bit values from 0 to 255
- Binary to Hex / Hex to Binary: 1 byte values from 0 to 255
- Decimal to Hex / Hex to Decimal: 1 byte values from 0 to 255
- All conversions: randomly mixes all conversion types

Binary answers do not need `0b`. Hex answers do not need `0x` and can be uppercase or lowercase. Decimal answers must be numeric.

For decimal-to-binary and hex-to-binary questions, leading zeroes are accepted. For example, decimal 5 can be answered as `101`, `0101` or `00000101`.

## Time Penalty

Each incorrect answer adds 5 seconds to the timer and increases the incorrect attempt count by 1. The final time is:

```text
real elapsed time + 5 seconds for each incorrect answer
```

## Rocket Pieces And Launch

Each correct answer awards one rocket piece. Rocket pieces are shown as a HUD count, such as `Rocket pieces: 0/8`, `1/8`, `2/8` and so on.

The individual rocket piece images may still be loaded, but they are not drawn on the moon. When the player reaches `8/8`, the remaining crates are cleared, the spaceman boards the rocket, `rocket complete.png` appears briefly, then `rocket takeoff.png` launches upward off the canvas.

## High Scores

High scores can be opened from the main menu with **View High Scores**.

Scores are currently saved locally in the browser using `localStorage`. Each game mode has its own table, and each table keeps the top 10 fastest times. Multiple scores from the same initials are allowed.

The high score table shows:

- rank
- initials
- final time
- incorrect attempts

Online Google Sheet leaderboard support will be added later.

## Testing Each Mode

1. Open the game with Live Server.
2. Select one conversion mode.
3. Touch a crate.
4. Try a correct answer and confirm the crate disappears and the HUD count increases.
5. Touch another crate.
6. Try an incorrect answer and confirm the message appears and the timer jumps by 5 seconds.
7. Press Escape and confirm that you can either keep playing or return to the main menu.
8. Reach 8/8 to test the boarding message, rocket complete image, takeoff animation and initials screen.
9. Enter 3 initials and confirm the score appears in the correct high score table.
10. Return to the main menu and use **View High Scores** to open tables for each mode.
11. Repeat for each mode.

Useful examples:

- Binary `0101` equals decimal `5`.
- Decimal `10` equals binary `1010`.
- Binary `11111111` equals hex `FF`.
- Hex `0A` equals binary `1010` or `00001010`.
- Decimal `255` equals hex `FF`.

## Run Locally With VS Code Live Server

1. Open this folder in Visual Studio Code.
2. Install the **Live Server** extension if you do not already have it.
3. Right-click `index.html`.
4. Choose **Open with Live Server**.
5. Select a game mode and use the arrow keys to move the spaceman.

You can also open `index.html` directly in a browser, but Live Server is recommended because it behaves more like the hosted GitHub Pages version.

## Deploy To GitHub Pages

1. Create a new GitHub repository.
2. Add this project folder to the repository.
3. Commit and push the files.
4. On GitHub, open the repository settings.
5. Go to **Pages**.
6. Set the source to deploy from the main branch and the root folder.
7. Save the settings and wait for GitHub to publish the site.

## Editing The Game

Most game settings are near the top of `js/game.js`, including canvas size, player speed, crate count, sprite sizes, launch position and asset paths.

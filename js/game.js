"use strict";

const APP_VERSION = "2026.06.18.6";
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const PLAYER_SPEED = 280;
const SPACEMAN_DRAW_HEIGHT = 96;
const SPACEMAN_FRAME_COUNT = 6;
const SPACEMAN_WALK_FRAME_SECONDS = 0.14;
const SPACEMAN_PICKUP_POSE_SECONDS = 0.35;
const CRATE_COUNT = 8;
const CRATE_SIZE = 58;
const MOON_SURFACE_TOP = 380;
const PLAYER_MOON_SURFACE_TOP = 370;
const TIME_PENALTY_MS = 5000;
const ROCKET_COMPLETE_SECONDS = 1.1;
const ROCKET_TAKEOFF_SPEED = 310;
const LEADERBOARD_STORAGE_PREFIX = "moonBinaryMissionScores";
const LEADERBOARD_API_URL = String(window.LEADERBOARD_API_URL || "").trim();
const LEADERBOARD_REQUEST_TIMEOUT_MS = 8000;

const GAME_STATES = {
  menu: "menu",
  playing: "playing",
  question: "question",
  rocketComplete: "rocketComplete",
  rocketTakeoff: "rocketTakeoff",
  enterInitials: "enterInitials",
  confirmCancel: "confirmCancel",
  leaderboard: "leaderboard"
};

const GAME_MODES = {
  binary_decimal_4bit: {
    label: "Binary to Decimal / Decimal to Binary: 4-bit",
    maxValue: 15,
    bits: 4,
    conversions: ["binary_to_decimal", "decimal_to_binary"]
  },
  binary_decimal_8bit: {
    label: "Binary to Decimal / Decimal to Binary: 8-bit",
    maxValue: 255,
    bits: 8,
    conversions: ["binary_to_decimal", "decimal_to_binary"]
  },
  binary_hex_1byte: {
    label: "Binary to Hex / Hex to Binary: 1 byte",
    maxValue: 255,
    bits: 8,
    conversions: ["binary_to_hex", "hex_to_binary"]
  },
  decimal_hex_1byte: {
    label: "Decimal to Hex / Hex to Decimal: 1 byte",
    maxValue: 255,
    bits: 8,
    conversions: ["decimal_to_hex", "hex_to_decimal"]
  },
  all_conversions: {
    label: "All conversions",
    maxValue: 255,
    bits: 8,
    conversions: [
      "binary_to_decimal",
      "decimal_to_binary",
      "binary_to_hex",
      "hex_to_binary",
      "decimal_to_hex",
      "hex_to_decimal"
    ]
  }
};

const ASSET_PATHS = {
  background: "assets/graphics/moon background.png",
  crate: "assets/graphics/crate.png",
  spaceman: "assets/graphics/spaceman spritesheet.png",
  rocketComplete: "assets/graphics/rocket complete.png",
  rocketTakeoff: "assets/graphics/rocket takeoff.png",
  rocketPieces: [
    "assets/graphics/rocket piece 1.png",
    "assets/graphics/rocket piece 2.png",
    "assets/graphics/rocket piece 3.png",
    "assets/graphics/rocket piece 4.png",
    "assets/graphics/rocket piece 5.png",
    "assets/graphics/rocket piece 6.png",
    "assets/graphics/rocket piece 7.png",
    "assets/graphics/rocket piece 8.png"
  ]
};

const ROCKET_ASSEMBLY_BOX = { x: 900, y: 388, width: 260, height: 260 };

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.context = this.canvas.getContext("2d");
    this.startMenu = document.getElementById("startMenu");
    this.questionModal = document.getElementById("questionModal");
    this.questionForm = document.getElementById("questionForm");
    this.questionText = document.getElementById("questionText");
    this.answerInput = document.getElementById("answerInput");
    this.questionFeedback = document.getElementById("questionFeedback");
    this.cancelGameModal = document.getElementById("cancelGameModal");
    this.confirmCancelGameButton = document.getElementById("confirmCancelGameButton");
    this.resumeGameButton = document.getElementById("resumeGameButton");
    this.launchMessage = document.getElementById("launchMessage");
    this.endScreen = document.getElementById("endScreen");
    this.initialsForm = document.getElementById("initialsForm");
    this.initialsInput = document.getElementById("initialsInput");
    this.initialsFeedback = document.getElementById("initialsFeedback");
    this.leaderboardScreen = document.getElementById("leaderboardScreen");
    this.leaderboardTitle = document.getElementById("leaderboardTitle");
    this.leaderboardModeMenu = document.getElementById("leaderboardModeMenu");
    this.leaderboardTableArea = document.getElementById("leaderboardTableArea");
    this.leaderboardBackButton = document.getElementById("leaderboardBackButton");
    this.savedScoreText = document.getElementById("savedScoreText");
    this.hudMode = document.getElementById("hudMode");
    this.hudTimer = document.getElementById("hudTimer");
    this.hudPieces = document.getElementById("hudPieces");
    this.finalTime = document.getElementById("finalTime");
    this.finalIncorrect = document.getElementById("finalIncorrect");
    this.finalMode = document.getElementById("finalMode");

    this.assets = {};
    this.keys = new Set();
    this.crates = [];
    this.state = GAME_STATES.menu;
    this.selectedModeKey = "all_conversions";
    this.selectedMode = GAME_MODES[this.selectedModeKey];
    this.currentQuestion = null;
    this.currentCrate = null;
    this.stateBeforeCancelPrompt = GAME_STATES.menu;
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.finalTimeMs = 0;
    this.leaderboardRequestId = 0;
    this.timePenaltyMs = 0;
    this.incorrectAttempts = 0;
    this.rocketPiecesCollected = 0;
    this.walkAnimationTime = 0;
    this.pickupPoseTime = 0;
    this.rocketCompleteTime = 0;
    this.takeoffRocketY = ROCKET_ASSEMBLY_BOX.y;

    // The spaceman sheet is one horizontal row of poses.
    // Change SPACEMAN_FRAME_COUNT if the artwork is replaced with a different
    // number of horizontal frames. Frame width is calculated after loading.
    this.spacemanSprite = {
      frameWidth: 0,
      frameHeight: 0,
      drawWidth: 64,
      drawHeight: SPACEMAN_DRAW_HEIGHT
    };

    this.player = {
      x: CANVAS_WIDTH * 0.5 - this.spacemanSprite.drawWidth * 0.5,
      y: MOON_SURFACE_TOP + 80,
      width: this.spacemanSprite.drawWidth,
      height: this.spacemanSprite.drawHeight,
      facing: 1,
      isMoving: false
    };
  }

  async init() {
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    this.showAppVersion();
    this.bindEvents();
    await this.loadAssets();
    this.setupSpacemanSprite();
    this.placeCrates();
    this.draw();
  }

  showAppVersion() {
    const versionText = `Version ${APP_VERSION}`;
    const menuVersion = this.startMenu.querySelector(".app-version");
    if (menuVersion) {
      menuVersion.textContent = versionText;
    }

    let versionBadge = this.startMenu.querySelector(".app-version-badge");
    if (!versionBadge) {
      versionBadge = document.createElement("div");
      versionBadge.className = "app-version-badge";
      this.startMenu.appendChild(versionBadge);
    }

    versionBadge.textContent = versionText;
  }

  bindEvents() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "escape") {
        this.handleEscapeKey(event);
        return;
      }

      if (this.state === GAME_STATES.playing && !isTextInputFocused() && isMovementKey(key)) {
        event.preventDefault();
        this.keys.add(key);
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    this.startMenu.addEventListener("click", (event) => {
      const actionButton = event.target.closest("button[data-action]");
      if (actionButton?.dataset.action === "view-scores") {
        this.showLeaderboardModeMenu();
        return;
      }

      const button = event.target.closest("button[data-mode-key]");
      if (!button) {
        return;
      }

      this.start(button.dataset.modeKey);
    });

    this.leaderboardModeMenu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-score-mode-key]");
      if (!button) {
        return;
      }

      this.showLeaderboardTable(button.dataset.scoreModeKey);
    });

    this.leaderboardBackButton.addEventListener("click", () => {
      if (this.leaderboardTableArea.classList.contains("is-hidden")) {
        this.showMainMenu();
      } else {
        this.showLeaderboardModeMenu();
      }
    });

    this.confirmCancelGameButton.addEventListener("click", () => {
      this.cancelCurrentGame();
    });

    this.resumeGameButton.addEventListener("click", () => {
      this.closeCancelPrompt();
    });

    this.questionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!this.currentQuestion) {
        return;
      }

      if (checkAnswer(this.currentQuestion, this.answerInput.value)) {
        this.handleCorrectAnswer();
      } else {
        this.handleIncorrectAnswer();
      }
    });

    this.initialsInput.addEventListener("input", () => {
      this.initialsInput.value = this.initialsInput.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3);
    });

    this.initialsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveInitials();
    });
  }

  loadAssets() {
    const flatAssetPaths = {
      background: ASSET_PATHS.background,
      crate: ASSET_PATHS.crate,
      spaceman: ASSET_PATHS.spaceman,
      rocketComplete: ASSET_PATHS.rocketComplete,
      rocketTakeoff: ASSET_PATHS.rocketTakeoff
    };

    ASSET_PATHS.rocketPieces.forEach((path, index) => {
      flatAssetPaths[`rocketPiece${index + 1}`] = path;
    });

    const loadPromises = Object.entries(flatAssetPaths).map(([name, path]) => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          this.assets[name] = name === "background" ? image : removeConnectedBackground(image);
          resolve();
        };
        image.onerror = () => reject(new Error(`Could not load ${path}`));
        image.src = path;
      });
    });

    return Promise.all(loadPromises);
  }

  start(modeKey) {
    this.selectedModeKey = GAME_MODES[modeKey] ? modeKey : "all_conversions";
    this.selectedMode = GAME_MODES[this.selectedModeKey];
    this.state = GAME_STATES.playing;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.finalTimeMs = 0;
    this.timePenaltyMs = 0;
    this.incorrectAttempts = 0;
    this.rocketPiecesCollected = 0;
    this.currentQuestion = null;
    this.currentCrate = null;
    this.takeoffRocketY = ROCKET_ASSEMBLY_BOX.y;
    this.placeCrates();
    this.hudMode.textContent = this.selectedMode.label;
    this.hudPieces.textContent = `${this.rocketPiecesCollected}/${CRATE_COUNT}`;
    this.startMenu.classList.add("is-hidden");
    this.launchMessage.classList.add("is-hidden");
    this.endScreen.classList.add("is-hidden");
    this.leaderboardScreen.classList.add("is-hidden");

    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  showMainMenu() {
    this.state = GAME_STATES.menu;
    this.finalTimeMs = 0;
    this.keys.clear();
    this.player.isMoving = false;
    this.hudMode.textContent = "Choose a mode";
    this.hudTimer.textContent = "00:00";
    this.hudPieces.textContent = `0/${CRATE_COUNT}`;
    this.startMenu.classList.remove("is-hidden");
    this.questionModal.classList.add("is-hidden");
    this.cancelGameModal.classList.add("is-hidden");
    this.launchMessage.classList.add("is-hidden");
    this.endScreen.classList.add("is-hidden");
    this.leaderboardScreen.classList.add("is-hidden");
    this.draw();
  }

  showLeaderboardModeMenu() {
    this.state = GAME_STATES.leaderboard;
    this.keys.clear();
    this.player.isMoving = false;
    this.leaderboardTitle.textContent = "High Scores";
    this.savedScoreText.textContent = "";
    this.leaderboardModeMenu.classList.remove("is-hidden");
    this.leaderboardTableArea.classList.add("is-hidden");
    this.leaderboardTableArea.innerHTML = "";
    this.leaderboardBackButton.textContent = "Back";
    this.startMenu.classList.add("is-hidden");
    this.endScreen.classList.add("is-hidden");
    this.cancelGameModal.classList.add("is-hidden");
    this.leaderboardScreen.classList.remove("is-hidden");
  }

  async showLeaderboardTable(modeKey, savedScoreText = "") {
    const mode = GAME_MODES[modeKey] || GAME_MODES.all_conversions;
    const requestId = this.leaderboardRequestId + 1;
    this.leaderboardRequestId = requestId;
    this.state = GAME_STATES.leaderboard;
    this.leaderboardTitle.textContent = mode.label;
    this.savedScoreText.textContent = savedScoreText;
    this.leaderboardModeMenu.classList.add("is-hidden");
    this.leaderboardTableArea.classList.remove("is-hidden");
    this.leaderboardTableArea.innerHTML = `<p class="empty-scores">Loading scores...</p>`;
    this.leaderboardBackButton.textContent = "Back";
    this.startMenu.classList.add("is-hidden");
    this.endScreen.classList.add("is-hidden");
    this.cancelGameModal.classList.add("is-hidden");
    this.leaderboardScreen.classList.remove("is-hidden");

    const scores = await loadScores(modeKey);
    if (requestId !== this.leaderboardRequestId || this.state !== GAME_STATES.leaderboard) {
      return;
    }

    if (!scores) {
      this.leaderboardTableArea.innerHTML = `<p class="empty-scores">Shared leaderboard unavailable</p>`;
      return;
    }

    this.leaderboardTableArea.innerHTML = createLeaderboardMarkup(scores);
  }

  handleEscapeKey(event) {
    if (!this.isCancelableGameState()) {
      return;
    }

    event.preventDefault();
    if (this.state === GAME_STATES.confirmCancel) {
      this.closeCancelPrompt();
    } else {
      this.openCancelPrompt();
    }
  }

  isCancelableGameState() {
    return [
      GAME_STATES.playing,
      GAME_STATES.question,
      GAME_STATES.rocketComplete,
      GAME_STATES.rocketTakeoff,
      GAME_STATES.confirmCancel
    ].includes(this.state);
  }

  openCancelPrompt() {
    this.stateBeforeCancelPrompt = this.state;
    this.state = GAME_STATES.confirmCancel;
    this.keys.clear();
    this.player.isMoving = false;
    this.cancelGameModal.classList.remove("is-hidden");
    this.resumeGameButton.focus();
  }

  closeCancelPrompt() {
    this.state = this.stateBeforeCancelPrompt;
    this.cancelGameModal.classList.add("is-hidden");
    if (this.state === GAME_STATES.question) {
      this.answerInput.focus();
    } else {
      this.canvas.focus();
    }
  }

  cancelCurrentGame() {
    this.crates = [];
    this.keys.clear();
    this.player.isMoving = false;
    this.currentQuestion = null;
    this.currentCrate = null;
    this.questionModal.classList.add("is-hidden");
    this.showMainMenu();
  }

  loop(timestamp) {
    const deltaTime = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    this.update(deltaTime);
    this.draw();

    if (this.state !== GAME_STATES.leaderboard) {
      requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
    }
  }

  update(deltaTime) {
    const activeState = this.getActiveState();
    this.updateAnimationTimers(deltaTime);

    if (this.state === GAME_STATES.playing) {
      this.updatePlayer(deltaTime);
      this.checkCrateCollisions();
    }

    if (activeState === GAME_STATES.rocketComplete) {
      this.rocketCompleteTime += deltaTime;
      if (this.rocketCompleteTime >= ROCKET_COMPLETE_SECONDS) {
        if (this.state === GAME_STATES.confirmCancel) {
          this.stateBeforeCancelPrompt = GAME_STATES.rocketTakeoff;
        } else {
          this.state = GAME_STATES.rocketTakeoff;
        }
        this.launchMessage.classList.add("is-hidden");
        this.takeoffRocketY = ROCKET_ASSEMBLY_BOX.y;
      }
    }

    if (activeState === GAME_STATES.rocketTakeoff) {
      this.takeoffRocketY -= ROCKET_TAKEOFF_SPEED * deltaTime;
      if (this.takeoffRocketY + ROCKET_ASSEMBLY_BOX.height < 0) {
        this.finishMission();
      }
    }

    this.updateHud();
  }

  updateAnimationTimers(deltaTime) {
    if (this.pickupPoseTime > 0) {
      this.pickupPoseTime = Math.max(0, this.pickupPoseTime - deltaTime);
    }
  }

  updatePlayer(deltaTime) {
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has("arrowleft")) moveX -= 1;
    if (this.keys.has("arrowright")) moveX += 1;
    if (this.keys.has("arrowup")) moveY -= 1;
    if (this.keys.has("arrowdown")) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY);
      moveX /= length;
      moveY /= length;
    }

    this.player.isMoving = moveX !== 0 || moveY !== 0;
    if (moveX < 0) {
      this.player.facing = -1;
    } else if (moveX > 0) {
      this.player.facing = 1;
    }

    if (this.player.isMoving) {
      this.walkAnimationTime += deltaTime;
    } else {
      this.walkAnimationTime = 0;
    }

    this.player.x += moveX * PLAYER_SPEED * deltaTime;
    this.player.y += moveY * PLAYER_SPEED * deltaTime;

    this.player.x = clamp(this.player.x, 0, CANVAS_WIDTH - this.player.width);
    this.player.y = clamp(this.player.y, PLAYER_MOON_SURFACE_TOP, CANVAS_HEIGHT - this.player.height);
  }

  placeCrates() {
    this.crates = [];
    const minimumDistance = 92;
    let attempts = 0;

    while (this.crates.length < CRATE_COUNT && attempts < 600) {
      attempts += 1;
      const crate = {
        x: randomNumber(80, CANVAS_WIDTH - CRATE_SIZE - 80),
        y: randomNumber(MOON_SURFACE_TOP + 12, CANVAS_HEIGHT - CRATE_SIZE - 28),
        width: CRATE_SIZE,
        height: CRATE_SIZE
      };

      const overlapsPlayerStart = rectanglesOverlap(crate, this.player);
      const tooCloseToRocket = rectanglesOverlap(crate, {
        x: ROCKET_ASSEMBLY_BOX.x - 28,
        y: ROCKET_ASSEMBLY_BOX.y - 28,
        width: ROCKET_ASSEMBLY_BOX.width + 56,
        height: ROCKET_ASSEMBLY_BOX.height + 56
      });
      const tooCloseToOtherCrate = this.crates.some((otherCrate) => {
        return distance(crate, otherCrate) < minimumDistance;
      });

      if (!overlapsPlayerStart && !tooCloseToRocket && !tooCloseToOtherCrate) {
        this.crates.push(crate);
      }
    }
  }

  checkCrateCollisions() {
    for (let index = this.crates.length - 1; index >= 0; index -= 1) {
      if (rectanglesOverlap(this.player, this.crates[index])) {
        this.startQuestion(this.crates[index]);
        return;
      }
    }
  }

  startQuestion(crate) {
    this.state = GAME_STATES.question;
    this.player.isMoving = false;
    this.keys.clear();
    this.currentCrate = crate;
    this.currentQuestion = generateQuestion(this.selectedModeKey);
    this.questionText.textContent = this.currentQuestion.prompt;
    this.questionFeedback.textContent = "";
    this.answerInput.value = "";
    this.questionModal.classList.remove("is-hidden");
    this.answerInput.focus();
  }

  handleCorrectAnswer() {
    this.questionModal.classList.add("is-hidden");
    this.crates = this.crates.filter((crate) => crate !== this.currentCrate);
    this.currentQuestion = null;
    this.currentCrate = null;
    this.pickupPoseTime = SPACEMAN_PICKUP_POSE_SECONDS;
    this.rocketPiecesCollected += 1;
    this.hudPieces.textContent = `${this.rocketPiecesCollected}/${CRATE_COUNT}`;

    if (this.rocketPiecesCollected >= CRATE_COUNT) {
      this.state = GAME_STATES.rocketComplete;
      this.rocketCompleteTime = 0;
      this.crates = [];
      this.keys.clear();
      this.player.isMoving = false;
      this.launchMessage.classList.remove("is-hidden");
    } else {
      this.state = GAME_STATES.playing;
    }
  }

  handleIncorrectAnswer() {
    this.timePenaltyMs += TIME_PENALTY_MS;
    this.incorrectAttempts += 1;
    this.questionFeedback.textContent = "Not quite - try again. +5 seconds";
    this.answerInput.select();
  }

  finishMission() {
    this.state = GAME_STATES.enterInitials;
    this.cancelGameModal.classList.add("is-hidden");
    this.finalTimeMs = this.getCurrentTimeMs();
    this.finalTime.textContent = formatTime(this.finalTimeMs);
    this.finalIncorrect.textContent = String(this.incorrectAttempts);
    this.finalMode.textContent = this.selectedMode.label;
    this.endScreen.classList.remove("is-hidden");
    this.initialsInput.value = "";
    this.initialsFeedback.textContent = "";
    this.initialsInput.focus();
  }

  async saveInitials() {
    const initials = this.initialsInput.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3);
    if (initials.length !== 3) {
      this.initialsFeedback.textContent = "Please enter exactly 3 letters.";
      this.initialsInput.focus();
      return;
    }

    const finalTime = formatTime(this.finalTimeMs);
    const score = {
      initials,
      timeMs: this.finalTimeMs,
      incorrectAttempts: this.incorrectAttempts,
      modeKey: this.selectedModeKey,
      savedAt: new Date().toISOString()
    };

    this.initialsFeedback.textContent = "Saving score...";
    const saved = await saveScore(score);
    if (!saved) {
      this.initialsFeedback.textContent = "Could not save to the shared leaderboard. Please try again.";
      return;
    }

    console.log(`Score saved: ${initials} - ${finalTime} - ${this.selectedMode.label}`);
    this.endScreen.classList.add("is-hidden");
    this.showLeaderboardTable(this.selectedModeKey, `Saved: ${initials} - ${finalTime}`);
  }

  setupSpacemanSprite() {
    const spaceman = this.assets.spaceman;
    if (!spaceman) {
      return;
    }

    const frameWidth = spaceman.width / SPACEMAN_FRAME_COUNT;
    const frameHeight = spaceman.height;
    const previousCenterX = this.player.x + this.player.width * 0.5;
    const previousBottomY = this.player.y + this.player.height;

    this.spacemanSprite.frameWidth = frameWidth;
    this.spacemanSprite.frameHeight = frameHeight;
    this.spacemanSprite.drawHeight = SPACEMAN_DRAW_HEIGHT;
    this.spacemanSprite.drawWidth = SPACEMAN_DRAW_HEIGHT * (frameWidth / frameHeight);

    this.player.width = this.spacemanSprite.drawWidth;
    this.player.height = this.spacemanSprite.drawHeight;
    this.player.x = previousCenterX - this.player.width * 0.5;
    this.player.y = previousBottomY - this.player.height;
  }

  updateHud() {
    this.hudTimer.textContent = formatTime(this.getCurrentTimeMs());
    this.hudPieces.textContent = `${this.rocketPiecesCollected}/${CRATE_COUNT}`;
  }

  getCurrentTimeMs() {
    if (this.finalTimeMs > 0) {
      return this.finalTimeMs;
    }

    if (this.state === GAME_STATES.menu) {
      return 0;
    }

    return performance.now() - this.startTime + this.timePenaltyMs;
  }

  draw() {
    this.context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawBackground();
    this.drawRocketAssembly();
    this.drawCrates();
    this.drawPlayer();
  }

  drawBackground() {
    const background = this.assets.background;
    if (!background) {
      this.context.fillStyle = "#070b18";
      this.context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }

    this.context.drawImage(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawRocketAssembly() {
    const visibleState = this.getVisibleState();

    if (visibleState === GAME_STATES.rocketComplete) {
      this.drawRocketImage(this.assets.rocketComplete, ROCKET_ASSEMBLY_BOX.y);
      return;
    }

    if (visibleState === GAME_STATES.rocketTakeoff || visibleState === GAME_STATES.enterInitials || visibleState === GAME_STATES.leaderboard) {
      this.drawRocketImage(this.assets.rocketTakeoff, this.takeoffRocketY);
      return;
    }
  }

  drawRocketImage(image, y) {
    if (!image) {
      return;
    }

    this.context.drawImage(
      image,
      ROCKET_ASSEMBLY_BOX.x,
      y,
      ROCKET_ASSEMBLY_BOX.width,
      ROCKET_ASSEMBLY_BOX.height
    );
  }

  drawCrates() {
    const visibleState = this.getVisibleState();

    if (visibleState === GAME_STATES.rocketComplete || visibleState === GAME_STATES.rocketTakeoff) {
      return;
    }

    const crateImage = this.assets.crate;
    if (!crateImage) {
      return;
    }

    this.crates.forEach((crate) => {
      this.context.drawImage(crateImage, crate.x, crate.y, crate.width, crate.height);
    });
  }

  drawPlayer() {
    const visibleState = this.getVisibleState();

    if (
      visibleState === GAME_STATES.rocketComplete ||
      visibleState === GAME_STATES.rocketTakeoff ||
      visibleState === GAME_STATES.enterInitials ||
      visibleState === GAME_STATES.leaderboard
    ) {
      return;
    }

    const spaceman = this.assets.spaceman;
    if (!spaceman) {
      return;
    }

    const frameIndex = this.getSpacemanFrameIndex();
    const sourceX = frameIndex * this.spacemanSprite.frameWidth;

    this.context.save();
    if (this.player.facing === -1) {
      this.context.translate(this.player.x + this.player.width, this.player.y);
      this.context.scale(-1, 1);
    } else {
      this.context.translate(this.player.x, this.player.y);
    }

    this.context.drawImage(
      spaceman,
      sourceX,
      0,
      this.spacemanSprite.frameWidth,
      this.spacemanSprite.frameHeight,
      0,
      0,
      this.player.width,
      this.player.height
    );
    this.context.restore();
  }

  getSpacemanFrameIndex() {
    if (this.pickupPoseTime > 0) {
      return 4;
    }

    if (this.player.isMoving) {
      const walkingFrames = [1, 2, 3];
      const animationIndex = Math.floor(this.walkAnimationTime / SPACEMAN_WALK_FRAME_SECONDS);
      return walkingFrames[animationIndex % walkingFrames.length];
    }

    return 0;
  }

  getVisibleState() {
    return this.state === GAME_STATES.confirmCancel ? this.stateBeforeCancelPrompt : this.state;
  }

  getActiveState() {
    return this.state === GAME_STATES.confirmCancel ? this.stateBeforeCancelPrompt : this.state;
  }
}

function generateQuestion(modeKey) {
  const mode = GAME_MODES[modeKey] || GAME_MODES.all_conversions;
  const conversion = randomItem(mode.conversions);
  const value = randomInteger(0, mode.maxValue);
  const bits = mode.bits;
  const binary = value.toString(2).padStart(bits, "0");
  const hex = value.toString(16).toUpperCase().padStart(bits === 8 ? 2 : 1, "0");

  if (conversion === "binary_to_decimal") {
    return {
      type: conversion,
      value,
      bits,
      prompt: `Convert binary ${binary} to decimal.`
    };
  }

  if (conversion === "decimal_to_binary") {
    return {
      type: conversion,
      value,
      bits,
      prompt: `Convert decimal ${value} to binary.`
    };
  }

  if (conversion === "binary_to_hex") {
    return {
      type: conversion,
      value,
      bits,
      prompt: `Convert binary ${binary} to hex.`
    };
  }

  if (conversion === "hex_to_binary") {
    return {
      type: conversion,
      value,
      bits,
      prompt: `Convert hex ${hex} to binary. An 8-bit answer is encouraged.`
    };
  }

  if (conversion === "decimal_to_hex") {
    return {
      type: conversion,
      value,
      bits,
      prompt: `Convert decimal ${value} to hex.`
    };
  }

  return {
    type: "hex_to_decimal",
    value,
    bits,
    prompt: `Convert hex ${hex} to decimal.`
  };
}

function checkAnswer(question, userAnswer) {
  const answer = userAnswer.trim();
  if (answer === "") {
    return false;
  }

  if (question.type === "binary_to_decimal" || question.type === "hex_to_decimal") {
    return /^\d+$/.test(answer) && Number(answer) === question.value;
  }

  if (question.type === "decimal_to_binary" || question.type === "hex_to_binary") {
    return /^[01]+$/.test(answer) && parseInt(answer, 2) === question.value;
  }

  if (question.type === "binary_to_hex" || question.type === "decimal_to_hex") {
    const cleaned = answer.replace(/^0x/i, "").toUpperCase();
    return /^[0-9A-F]+$/.test(cleaned) && parseInt(cleaned, 16) === question.value;
  }

  return false;
}

function removeConnectedBackground(image) {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const visited = new Uint8Array(width * height);
    const queue = [];

    const addIfBackground = (x, y) => {
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) {
        return;
      }

      const dataIndex = pixelIndex * 4;
      if (
        isLikelyGeneratedBackgroundPixel(
          pixels[dataIndex],
          pixels[dataIndex + 1],
          pixels[dataIndex + 2],
          pixels[dataIndex + 3]
        )
      ) {
        visited[pixelIndex] = 1;
        queue.push(pixelIndex);
      }
    };

    for (let x = 0; x < width; x += 1) {
      addIfBackground(x, 0);
      addIfBackground(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      addIfBackground(0, y);
      addIfBackground(width - 1, y);
    }

    // Runtime clean-up for generated classroom assets: only remove pixels that
    // are connected to the image border, so enclosed white sprite details stay.
    for (let readIndex = 0; readIndex < queue.length; readIndex += 1) {
      const pixelIndex = queue[readIndex];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const dataIndex = pixelIndex * 4;
      pixels[dataIndex + 3] = 0;

      if (x > 0) addIfBackground(x - 1, y);
      if (x < width - 1) addIfBackground(x + 1, y);
      if (y > 0) addIfBackground(x, y - 1);
      if (y < height - 1) addIfBackground(x, y + 1);
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
  } catch (error) {
    console.warn("Sprite background cleanup failed; using original image.", error);
    return image;
  }
}

function isLikelyGeneratedBackgroundPixel(r, g, b, a) {
  if (a < 16) {
    return true;
  }

  const brightest = Math.max(r, g, b);
  const darkest = Math.min(r, g, b);
  const lowSaturation = brightest - darkest <= 28;
  const veryLight = r >= 218 && g >= 218 && b >= 218;
  const lightCheckerGrey = r >= 185 && g >= 185 && b >= 185 && lowSaturation;

  return veryLight || lightCheckerGrey;
}

async function saveScore(score) {
  if (LEADERBOARD_API_URL) {
    const savedRemotely = await saveRemoteScore(score);
    if (!savedRemotely) {
      console.warn("Shared leaderboard unavailable; score was not saved.");
    }
    return savedRemotely;
  }

  saveLocalScore(score);
  return true;
}

function saveLocalScore(score) {
  const scores = loadLocalScores(score.modeKey);
  scores.push(score);
  scores.sort((a, b) => a.timeMs - b.timeMs);
  const topScores = scores.slice(0, 10);

  try {
    localStorage.setItem(getLeaderboardKey(score.modeKey), JSON.stringify(topScores));
  } catch (error) {
    console.warn("Could not save score locally.", error);
  }
}

async function loadScores(modeKey) {
  if (LEADERBOARD_API_URL) {
    return loadRemoteScores(modeKey);
  }

  return loadLocalScores(modeKey);
}

async function saveRemoteScore(score) {
  if (!LEADERBOARD_API_URL) {
    return false;
  }

  try {
    const url = new URL(LEADERBOARD_API_URL);
    url.searchParams.set("action", "save");
    url.searchParams.set("score", JSON.stringify(score));

    const payload = await loadJsonp(url);
    return Boolean(payload?.ok);
  } catch (error) {
    console.warn("Could not save score to shared leaderboard.", error);
    return false;
  }
}

async function loadRemoteScores(modeKey) {
  if (!LEADERBOARD_API_URL) {
    return null;
  }

  try {
    const url = new URL(LEADERBOARD_API_URL);
    url.searchParams.set("modeKey", modeKey);

    const payload = await loadJsonp(url);
    if (!payload || !Array.isArray(payload.scores)) {
      return [];
    }

    return normalizeScores(payload.scores);
  } catch (error) {
    console.warn("Could not load shared leaderboard; using local scores.", error);
    return null;
  }
}

function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `leaderboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Leaderboard request timed out"));
    }, LEADERBOARD_REQUEST_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Leaderboard request failed"));
    };

    url.searchParams.set("callback", callbackName);
    url.searchParams.set("cacheBust", Date.now().toString());
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function loadLocalScores(modeKey) {
  try {
    const savedScores = localStorage.getItem(getLeaderboardKey(modeKey));
    if (!savedScores) {
      return [];
    }

    const parsedScores = JSON.parse(savedScores);
    if (!Array.isArray(parsedScores)) {
      return [];
    }

    return normalizeScores(parsedScores);
  } catch (error) {
    console.warn("Could not load local scores.", error);
    return [];
  }
}

function normalizeScores(scores) {
  return scores
    .map((score) => ({
      initials: String(score.initials || "").replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3),
      timeMs: Number(score.timeMs),
      incorrectAttempts: Number(score.incorrectAttempts),
      modeKey: score.modeKey,
      savedAt: score.savedAt
    }))
    .filter((score) => {
      return (
        score.initials.length === 3 &&
        Number.isFinite(score.timeMs) &&
        Number.isInteger(score.incorrectAttempts)
      );
    })
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 10);
}

function getLeaderboardKey(modeKey) {
  return `${LEADERBOARD_STORAGE_PREFIX}:${modeKey}`;
}

function createLeaderboardMarkup(scores) {
  if (scores.length === 0) {
    return `<p class="empty-scores">No scores yet</p>`;
  }

  const rows = scores.map((score, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(score.initials)}</td>
        <td>${formatTime(score.timeMs)}</td>
        <td>${score.incorrectAttempts}</td>
      </tr>
    `;
  }).join("");

  return `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Initials</th>
          <th>Time</th>
          <th>Incorrect</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isTextInputFocused() {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  return activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA";
}

function isMovementKey(key) {
  return ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInteger(min, max) {
  return Math.floor(randomNumber(min, max + 1));
}

function randomItem(items) {
  return items[randomInteger(0, items.length - 1)];
}

function distance(a, b) {
  const ax = a.x + a.width * 0.5;
  const ay = a.y + a.height * 0.5;
  const bx = b.x + b.width * 0.5;
  const by = b.y + b.height * 0.5;

  return Math.hypot(ax - bx, ay - by);
}

window.addEventListener("DOMContentLoaded", () => {
  const game = new Game();
  game.init().catch((error) => {
    console.error(error);
  });
});

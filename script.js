let engine;
let scene;
let score = 0;
let level = 1;
let gameActive = false;
let player;
let obstacles = [];
let powerUps = [];
let projectiles = [];
let lastShotTime = 0;
let shootSound;
let explosionSound;
let powerUpSound;
let activeEffects = {
    invincible: false,
    canShoot: false,
    doppelganger: false
};

// Add power-up timers
let powerUpTimers = {
    invincible: 0,
    shoot: 0,
    doppelganger: 0
};

let lastPowerUpSpawnTime = 0;
const POWER_UP_SPAWN_INTERVAL = 5000; // Changed to 5 seconds

// Add touch control variables
let touchStartX = 0;
let touchStartY = 0;
let isTouchActive = false;

// Add player stats at the top
let playerStats = {
    level: 1,
    currentExp: 0,
    expToNextLevel: 100,
    maxHealth: 100,
    currentHealth: 100
};

let doppelgangerShip = null;

const canvas = document.getElementById("renderCanvas");

function initGame() {
    // Create engine with antialias and adaptToDeviceRatio options
    engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
        adaptToDeviceRatio: true,
        powerPreference: "high-performance"
    });
    
    scene = new BABYLON.Scene(engine);
    
    // Camera setup for side view (Space Invaders style)
    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -20), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    
    // Set orthographic camera properties
    const aspectRatio = engine.getAspectRatio(camera);
    const orthoSize = 10;
    camera.orthoLeft = -orthoSize * aspectRatio;
    camera.orthoRight = orthoSize * aspectRatio;
    camera.orthoBottom = -orthoSize;
    camera.orthoTop = orthoSize;

    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Initialize sounds with local files
    const soundsToLoad = [
        {
            name: "shoot",
            url: "sounds/laser.mp3",
            options: { volume: 0.5 }
        },
        {
            name: "explosion",
            url: "sounds/explosion.mp3",
            options: { volume: 0.6 }
        },
        {
            name: "powerup",
            url: "sounds/powerup.mp3",
            options: { volume: 0.5 }
        }
    ];

    // Load all sounds with error handling
    soundsToLoad.forEach(sound => {
        const newSound = new BABYLON.Sound(
            sound.name,
            sound.url,
            scene,
            () => {
                console.log(`${sound.name} sound loaded successfully`);
            },
            {
                ...sound.options,
                spatialSound: false,
                distanceModel: "linear",
                streaming: true,
                onError: (error) => {
                    console.warn(`Error loading ${sound.name} sound:`, error);
                }
            }
        );
        
        // Store sound references and add error handling
        if (sound.name === "shoot") shootSound = newSound;
        if (sound.name === "explosion") explosionSound = newSound;
        if (sound.name === "powerup") powerUpSound = newSound;
    });

    // Create a fallback sound in case loading fails
    const fallbackSound = new BABYLON.Sound("fallback", null, scene, null, {
        spatialSound: false,
        distanceModel: "linear"
    });

    // Function to safely play sounds
    window.playSound = function(soundType) {
        try {
            const sound = {
                shoot: shootSound,
                explosion: explosionSound,
                powerup: powerUpSound
            }[soundType] || fallbackSound;

            if (sound && sound.isReady) {
                sound.play();
            }
        } catch (error) {
            console.warn(`Error playing ${soundType} sound:`, error);
        }
    }

    createEnvironment();
    createPlayer();

    engine.runRenderLoop(() => {
        if (gameActive) {
            updateGame();
        }
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });
}

function createEnvironment() {
    // Create a starfield background
    const starCount = 200;
    for (let i = 0; i < starCount; i++) {
        const star = BABYLON.MeshBuilder.CreateBox("star", {size: 0.05}, scene);
        const starMaterial = new BABYLON.StandardMaterial("starMat", scene);
        starMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        star.material = starMaterial;
        
        star.position = new BABYLON.Vector3(
            Math.random() * 40 - 20,
            Math.random() * 20 - 10,
            Math.random() * 5
        );
    }
}

function createExplosionEffect(position) {
    const particleSystem = new BABYLON.ParticleSystem("explosion", 200, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
    
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, -0.5, -0.5);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 0.5);
    
    particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
    
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.5;
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.6;
    
    particleSystem.emitRate = 300;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    
    particleSystem.start();
    setTimeout(() => particleSystem.stop(), 300);
}

function createPlayer() {
    // Create a more detailed spaceship
    const body = BABYLON.MeshBuilder.CreateCylinder("shipBody", {
        height: 1.2,
        diameter: 0.4,
        tessellation: 8
    }, scene);
    body.rotation.z = Math.PI / 2;
    
    const cockpit = BABYLON.MeshBuilder.CreateSphere("cockpit", {
        diameter: 0.5,
        segments: 12
    }, scene);
    cockpit.position.x = 0.4;
    cockpit.scaling = new BABYLON.Vector3(0.8, 0.5, 0.7);
    
    const wing1 = BABYLON.MeshBuilder.CreateBox("wing1", {
        height: 0.1,
        width: 1.2,
        depth: 0.4
    }, scene);
    wing1.position.y = 0.4;
    wing1.rotation.z = -0.2;
    
    const wing2 = wing1.clone("wing2");
    wing2.position.y = -0.4;
    wing2.rotation.z = 0.2;
    
    const engine1 = BABYLON.MeshBuilder.CreateCylinder("engine1", {
        height: 0.4,
        diameter: 0.2
    }, scene);
    engine1.position = new BABYLON.Vector3(-0.3, 0.3, 0);
    engine1.rotation.z = Math.PI / 2;
    
    const engine2 = engine1.clone("engine2");
    engine2.position.y = -0.3;
    
    // Create engine glow
    const engineGlow = new BABYLON.PointLight("engineGlow", new BABYLON.Vector3(-0.5, 0, 0), scene);
    engineGlow.diffuse = new BABYLON.Color3(0.5, 0, 0.5);
    engineGlow.intensity = 0.5;
    
    // Merge all parts
    const parts = [body, cockpit, wing1, wing2, engine1, engine2];
    player = BABYLON.Mesh.MergeMeshes(parts, true);
    
    // Create glowing material for the ship
    const playerMaterial = new BABYLON.StandardMaterial("playerMat", scene);
    playerMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
    playerMaterial.specularPower = 128;
    player.material = playerMaterial;
    
    // Position player at bottom and rotate to face up
    player.position = new BABYLON.Vector3(0, -8, 0);
    player.rotation = new BABYLON.Vector3(0, 0, Math.PI/2); // Rotated to face up
    player.speed = 0.2;
}

function createObstacle() {
    // Create a more menacing alien ship
    const body = BABYLON.MeshBuilder.CreateSphere("alienBody", {
        diameter: 0.8,
        segments: 12
    }, scene);
    
    const topFin = BABYLON.MeshBuilder.CreateCylinder("topFin", {
        height: 0.6,
        diameter: 0.2,
        tessellation: 4
    }, scene);
    topFin.position.y = 0.4;
    topFin.rotation.z = Math.PI / 4;
    
    const bottomFin = topFin.clone("bottomFin");
    bottomFin.position.y = -0.4;
    bottomFin.rotation.z = -Math.PI / 4;
    
    const cannon = BABYLON.MeshBuilder.CreateCylinder("cannon", {
        height: 0.4,
        diameter: 0.15
    }, scene);
    cannon.position.x = 0.4;
    cannon.rotation.z = Math.PI / 2;
    
    const parts = [body, topFin, bottomFin, cannon];
    const obstacle = BABYLON.Mesh.MergeMeshes(parts, true);
    
    const obstacleMaterial = new BABYLON.StandardMaterial("obstacleMat", scene);
    obstacleMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.8, 0.2);
    obstacle.material = obstacleMaterial;
    
    // Position at top with more spread X position
    obstacle.position = new BABYLON.Vector3(
        Math.random() * 24 - 12,
        10,
        0
    );
    
    // Rotate to face down towards player
    obstacle.rotation = new BABYLON.Vector3(0, 0, -Math.PI/2);
    
    // Increase base speed and level scaling for better movement
    obstacle.speed = 0.05 * (1 + (level * 0.1));
    obstacles.push(obstacle);
}

function createPowerUp() {
    const powerUp = BABYLON.MeshBuilder.CreateTorusKnot("powerUp", {
        radius: 0.3,
        tube: 0.1
    }, scene);
    
    const powerUpMaterial = new BABYLON.StandardMaterial("powerUpMat", scene);
    
    // Add doppelganger power-up type
    const type = Math.random() < 0.33 ? 'invincible' : 
                Math.random() < 0.66 ? 'shoot' : 'doppelganger';
    powerUp.powerUpType = type;
    
    if (type === 'invincible') {
        powerUpMaterial.emissiveColor = new BABYLON.Color3(0, 1, 1);
    } else if (type === 'shoot') {
        powerUpMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    } else {
        powerUpMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 1); // Purple for doppelganger
    }
    
    powerUp.material = powerUpMaterial;
    
    // Random fixed position
    powerUp.position = new BABYLON.Vector3(
        Math.random() * 16 - 8,
        Math.random() * 10 - 5,
        0
    );
    
    scene.registerBeforeRender(() => {
        powerUp.rotation.z += 0.02;
    });
    
    powerUps.push(powerUp);
}

function createProjectile() {
    // Create three projectiles in a spread pattern
    const spread = 0.3;
    const angles = [-spread, 0, spread];
    
    angles.forEach(angle => {
        const projectile = BABYLON.MeshBuilder.CreateCylinder("projectile", {
            height: 0.4,
            diameter: 0.15
        }, scene);
        
        const projectileMaterial = new BABYLON.StandardMaterial("projectileMat", scene);
        projectileMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
        projectile.material = projectileMaterial;
        
        projectile.rotation.z = Math.PI / 2;
        projectile.position = new BABYLON.Vector3(
            player.position.x,
            player.position.y,
            0
        );
        
        projectile.speed = 0.3;
        projectile.direction = new BABYLON.Vector3(Math.sin(angle), Math.cos(angle), 0);
        projectiles.push(projectile);
    });
    
    window.playSound("shoot");
}

function createDoppelganger() {
    if (doppelgangerShip) {
        doppelgangerShip.dispose();
    }
    
    doppelgangerShip = player.clone("doppelganger");
    doppelgangerShip.material = new BABYLON.StandardMaterial("doppelMat", scene);
    doppelgangerShip.material.emissiveColor = new BABYLON.Color3(0.5, 0, 1);
    doppelgangerShip.material.alpha = 0.6;
    doppelgangerShip.position.x = -player.position.x;
    doppelgangerShip.position.y = player.position.y;
    
    return doppelgangerShip;
}

function updateGame() {
    // Add this at the beginning of updateGame
    updatePowerUps();

    // Handle player movement with correct controls
    if (keys["ArrowLeft"] || keys["a"]) {
        player.position.x -= player.speed; // Move left
    }
    if (keys["ArrowRight"] || keys["d"]) {
        player.position.x += player.speed; // Move right
    }
    if (keys["ArrowUp"] || keys["w"]) {
        player.position.y += player.speed; // Move up
    }
    if (keys["ArrowDown"] || keys["s"]) {
        player.position.y -= player.speed; // Move down
    }

    // Shoot projectiles with cooldown
    const currentTime = Date.now();
    if ((keys[" "] || keys["Space"]) && activeEffects.canShoot && currentTime - lastShotTime > 500) {
        createProjectile();
        lastShotTime = currentTime;
    }

    // Keep player within bounds
    player.position.x = Math.max(-10, Math.min(10, player.position.x));
    player.position.y = Math.max(-9, Math.min(9, player.position.y));

    // Update projectiles with direction
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.addInPlace(projectile.direction.scale(projectile.speed));

        // Check for collision with obstacles
        for (let j = obstacles.length - 1; j >= 0; j--) {
            const obstacle = obstacles[j];
            if (projectile.intersectsMesh(obstacle, false)) {
                // Create explosion effect at obstacle position
                createExplosionEffect(obstacle.position);
                window.playSound("explosion");
                
                projectile.dispose();
                projectiles.splice(i, 1);
                obstacle.dispose();
                obstacles.splice(j, 1);
                score += 20;
                addExperience(15); // Add experience for destroying enemies
                updateScore();
                break;
            }
        }

        if (projectile.position.y > 10 || projectile.position.x < -10 || projectile.position.x > 10) {
            projectile.dispose();
            projectiles.splice(i, 1);
        }
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.y -= obstacle.speed;

        if (obstacle.intersectsMesh(player, false)) {
            if (activeEffects.invincible) {
                // Destroy enemy and add points when invincible
                createExplosionEffect(obstacle.position);
                window.playSound("explosion");
                obstacle.dispose();
                obstacles.splice(i, 1);
                score += 30;
                addExperience(20);
                updateScore();
                continue;
            } else if (!activeEffects.invincible && !activeEffects.doppelganger) {
                playerStats.currentHealth -= 20;
                updatePlayerUI();
                if (playerStats.currentHealth <= 0) {
                    gameOver();
                    return;
                }
            }
        }

        if (obstacle.position.y < -10) {
            obstacle.dispose();
            obstacles.splice(i, 1);
            score += 10;
            updateScore();
        }
    }

    // Update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (powerUp.intersectsMesh(player, false)) {
            window.playSound("powerup");
            activatePowerUp(powerUp.powerUpType);
            powerUp.dispose();
            powerUps.splice(i, 1);
        }
    }

    // Spawn new obstacles and power-ups
    if (obstacles.length < 5 + level) {
        createObstacle();
    }

    // Update power-ups with timed spawning
    if (powerUps.length === 0 && currentTime - lastPowerUpSpawnTime >= POWER_UP_SPAWN_INTERVAL) {
        createPowerUp();
        lastPowerUpSpawnTime = currentTime;
    }

    // If doppelganger is active, shoot from both positions when spacebar is pressed
    if ((keys[" "] || keys["Space"]) && activeEffects.doppelganger && currentTime - lastShotTime > 500) {
        createProjectile();
        // Create mirror projectiles from opposite side
        const mirrorX = -player.position.x;
        const originalX = player.position.x;
        player.position.x = mirrorX;
        createProjectile();
        player.position.x = originalX;
        lastShotTime = currentTime;
    }

    // Update doppelganger position if active
    if (activeEffects.doppelganger && doppelgangerShip) {
        doppelgangerShip.position.x = -player.position.x;
        doppelgangerShip.position.y = player.position.y;
        doppelgangerShip.rotation = player.rotation.clone();
    }

    // Add experience when destroying enemies
    function addExperience(amount) {
        playerStats.currentExp += amount;
        while (playerStats.currentExp >= playerStats.expToNextLevel) {
            levelUp();
        }
        updatePlayerUI();
    }

    // Level up function
    function levelUp() {
        playerStats.level++;
        playerStats.currentExp -= playerStats.expToNextLevel;
        playerStats.expToNextLevel *= 2;
        playerStats.maxHealth += 20;
        playerStats.currentHealth = playerStats.maxHealth;
        updatePlayerUI();
        
        // Visual effect for level up
        const levelUpEffect = new BABYLON.ParticleSystem("levelUp", 200, scene);
        levelUpEffect.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        levelUpEffect.emitter = player;
        levelUpEffect.color1 = new BABYLON.Color4(1, 1, 0, 1);
        levelUpEffect.color2 = new BABYLON.Color4(1, 1, 1, 1);
        levelUpEffect.start();
        setTimeout(() => levelUpEffect.stop(), 1000);
    }

    // Update level
    if (score > level * 100) {
        level++;
        updateScore();
    }
}

function activatePowerUp(type) {
    const powerUpKey = type === 'shoot' ? 'shoot' : type;
    powerUpTimers[powerUpKey] = (powerUpTimers[powerUpKey] || 0) + 10000; // Add 10 seconds
    
    if (type === 'invincible') {
        activeEffects.invincible = true;
        player.material.emissiveColor = new BABYLON.Color3(0, 1, 1);
    } else if (type === 'shoot') {
        activeEffects.canShoot = true;
    } else if (type === 'doppelganger') {
        activeEffects.doppelganger = true;
        player.visibility = 0.8;
        if (!doppelgangerShip) {
            createDoppelganger();
        }
    }
    score += 25;
    updateScore();
}

function updatePowerUps() {
    const currentTime = Date.now();
    
    // Update each power-up timer
    Object.keys(powerUpTimers).forEach(type => {
        if (powerUpTimers[type] > 0) {
            powerUpTimers[type] -= engine.getDeltaTime();
            
            // Handle invincible flashing warning
            if (type === 'invincible' && powerUpTimers[type] <= 3000) {
                // Flash every 200ms when close to expiring
                if (Math.floor(powerUpTimers[type] / 200) % 2 === 0) {
                    player.material.emissiveColor = new BABYLON.Color3(0, 1, 1);
                } else {
                    player.material.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
                }
            }
            
            // Deactivate power-up when timer runs out
            if (powerUpTimers[type] <= 0) {
                powerUpTimers[type] = 0;
                if (type === 'invincible') {
                    activeEffects.invincible = false;
                    player.material.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
                } else if (type === 'shoot') {
                    activeEffects.canShoot = false;
                } else if (type === 'doppelganger') {
                    activeEffects.doppelganger = false;
                    player.visibility = 1;
                    if (doppelgangerShip) {
                        doppelgangerShip.dispose();
                        doppelgangerShip = null;
                    }
                }
            }
        }
    });
}

function updateScore() {
    document.getElementById("scoreboard").innerText = `Score: ${score} | Level: ${level}`;
}

function updatePlayerUI() {
    // Update the health bar
    const healthPercentage = (playerStats.currentHealth / playerStats.maxHealth) * 100;
    const healthFill = document.querySelector('.health-fill');
    if (healthFill) {
        healthFill.style.width = `${healthPercentage}%`;
    }
    
    // Update the experience bar
    const expPercentage = (playerStats.currentExp / playerStats.expToNextLevel) * 100;
    const expFill = document.querySelector('.exp-fill');
    if (expFill) {
        expFill.style.width = `${expPercentage}%`;
    }
}

function gameOver() {
    gameActive = false;
    document.getElementById("retry-button").style.display = "block";
    document.getElementById("scoreboard").innerText = `Game Over! Final Score: ${score}`;
}

// Update start game to handle retry button
function startGame() {
    score = 0;
    level = 1;
    gameActive = true;
    
    // Hide both start buttons and the instructions modal
    document.getElementById("start-button").style.display = "none";
    document.getElementById("start-game").style.display = "none";
    document.getElementById("retry-button").style.display = "none";
    document.getElementById("instructions-modal").style.display = "none";
    
    // Reset player position to bottom
    player.position = new BABYLON.Vector3(0, -8, 0);
    
    // Reset player material
    player.material.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
    player.visibility = 1.0;
    
    // Cleanup any existing doppelganger
    if (doppelgangerShip) {
        doppelgangerShip.dispose();
        doppelgangerShip = null;
    }
    
    // Clear existing objects
    obstacles.forEach(obstacle => obstacle.dispose());
    obstacles = [];
    powerUps.forEach(powerUp => powerUp.dispose());
    powerUps = [];
    projectiles.forEach(projectile => projectile.dispose());
    projectiles = [];
    
    // Reset power-up effects and timers
    Object.keys(activeEffects).forEach(key => activeEffects[key] = false);
    Object.keys(powerUpTimers).forEach(key => powerUpTimers[key] = 0);
    
    // Enable shooting by default so player can fire
    activeEffects.canShoot = true;
    
    // Reset player stats
    playerStats.level = 1;
    playerStats.currentExp = 0;
    playerStats.expToNextLevel = 100;
    playerStats.maxHealth = 100;
    playerStats.currentHealth = 100;
    
    // Initialize first power-up and reset timer
    createPowerUp();
    lastPowerUpSpawnTime = Date.now();
    
    updateScore();
    updatePlayerUI();
}

// Initialize keyboard controls
const keys = {};
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

// Mobile controls
const touchpad = document.getElementById("touchpad");
const fireButton = document.getElementById("fire-button");

// Ensure these elements exist before adding event listeners
if (touchpad) {
    touchpad.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = touchpad.getBoundingClientRect();
        touchStartX = touch.clientX - rect.left;
        touchStartY = touch.clientY - rect.top;
        isTouchActive = true;
    });

    touchpad.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (!isTouchActive || !gameActive) return;

        const touch = e.touches[0];
        const rect = touchpad.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;

        const deltaX = (currentX - touchStartX) / rect.width;
        const deltaY = (currentY - touchStartY) / rect.height;

        // Move player based on touch movement
        player.position.x += deltaX * player.speed * 3;
        player.position.y -= deltaY * player.speed * 3;

        // Keep player within bounds
        player.position.x = Math.max(-10, Math.min(10, player.position.x));
        player.position.y = Math.max(-9, Math.min(9, player.position.y));
    });

    touchpad.addEventListener("touchend", () => {
        isTouchActive = false;
    });
}

// Fire button for mobile
if (fireButton) {
    fireButton.addEventListener("touchstart", (e) => {
        e.preventDefault();
        keys["Space"] = true;
    });

    fireButton.addEventListener("touchend", (e) => {
        e.preventDefault();
        keys["Space"] = false;
    });
}

// Initialize event listeners after document is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Start button event listeners
    const startGameBtn = document.getElementById("start-game");
    const startBtn = document.getElementById("start-button");
    const retryBtn = document.getElementById("retry-button");
    
    if (startGameBtn) {
        startGameBtn.addEventListener("click", startGame);
        // Add touch event for mobile
        startGameBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            startGame();
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener("click", startGame);
        // Add touch event for mobile
        startBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            startGame();
        });
    }
    
    if (retryBtn) {
        retryBtn.addEventListener("click", startGame);
        // Add touch event for mobile
        retryBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            startGame();
        });
    }
    
    // Initialize the game
    initGame();
});
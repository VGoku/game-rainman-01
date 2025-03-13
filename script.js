let canvas = document.getElementById("game-canvas");
let ctx = canvas.getContext("2d");

let player = {
    x: 50,
    y: 50,
    width: 50,
    height: 50,
    color: "purple", // Player's color
    speed: 5,
    invincible: false,
    invincibilityTime: 0
};

let obstacles = [];
let powerUps = [];
let score = 0;
let level = 1;
let gameActive = false;
let gameOver = false;
let keys = {};
let lastObstacleTime = 0;
let lastPowerUpTime = 0;
let particles = [];

// Start the game
function startGame() {
    canvas.width = 800;
    canvas.height = 600;
    gameActive = true;
    score = 0;
    level = 1;
    obstacles = [];
    powerUps = [];
    particles = [];
    lastObstacleTime = Date.now();
    lastPowerUpTime = Date.now();
    document.getElementById("start-button").style.display = "none";
    requestAnimationFrame(gameLoop);
}

// Create random obstacles
function createObstacle() {
    let width = Math.random() * 50 + 30;
    let height = Math.random() * 50 + 30;
    let x = Math.random() * (canvas.width - width);
    let y = Math.random() * (canvas.height - height);
    obstacles.push({ x, y, width, height, speed: level * 0.5 });
}

// Create random power-ups
function createPowerUp() {
    let width = 30;
    let height = 30;
    let x = Math.random() * (canvas.width - width);
    let y = Math.random() * (canvas.height - height);
    powerUps.push({ x, y, width, height });
}

// Game Loop
function gameLoop() {
    if (gameActive && !gameOver) {
        clearCanvas();
        updatePlayer();
        drawPlayer();
        updateObstacles();
        updatePowerUps();  // Ensure this function is defined and called
        drawScore();
        drawLevel();
        
        let now = Date.now();
        if (now - lastObstacleTime > 10000) {
            createObstacle();
            lastObstacleTime = now;
        }
        
        if (now - lastPowerUpTime > 20000) {
            createPowerUp();
            lastPowerUpTime = now;
        }
        
        // Update particles (break effect)
        updateParticles();
        
        requestAnimationFrame(gameLoop);
    } else {
        gameOverScreen();
    }
}

// Clear the canvas before each frame
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Handle player movement based on arrow keys
function updatePlayer() {
    if (keys["ArrowUp"]) player.y -= player.speed;
    if (keys["ArrowDown"]) player.y += player.speed;
    if (keys["ArrowLeft"]) player.x -= player.speed;
    if (keys["ArrowRight"]) player.x += player.speed;

    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y > canvas.height - player.height) player.y = canvas.height - player.height;

    if (player.invincible) {
        player.invincibilityTime -= 1;
        if (player.invincibilityTime <= 0) {
            player.invincible = false;
        }
    }
}

// Draw the player
function drawPlayer() {
    ctx.fillStyle = player.invincible ? "yellow" : player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Draw the score and level
function drawScore() {
    let scoreboard = document.getElementById("scoreboard");
    scoreboard.innerText = `Score: ${score} | Level: ${level}`;
}

// Draw the current level
function drawLevel() {
    // Level is already displayed with the scoreboard, so this can be omitted
}

// Update obstacles and check for collisions
function updateObstacles() {
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        ctx.fillStyle = "darkred"; // Dark red obstacles
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // Collision detection with player
        if (player.invincible && player.x < obstacle.x + obstacle.width &&
            player.x + player.width > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y) {
            
            // Destroy the obstacle if the player is invincible
            obstacles.splice(i, 1);  // Remove the obstacle from the array
            score += 10;  // Add 10 points for destroying the enemy
            i--; // Adjust index to avoid skipping the next obstacle after removal
        } else if (!player.invincible && player.x < obstacle.x + obstacle.width &&
                   player.x + player.width > obstacle.x &&
                   player.y < obstacle.y + obstacle.height &&
                   player.y + player.height > obstacle.y) {
            // If the player is not invincible, check for normal collision and end the game
            gameOver = true;
        }

        // Move obstacles down
        obstacle.y += obstacle.speed;

        if (obstacle.y > canvas.height) {
            obstacle.y = -obstacle.height;
            obstacle.x = Math.random() * (canvas.width - obstacle.width);

            if (score % 5 === 0) {
                level++;
            }
        }
    }
}

// Function to split an obstacle into 4 smaller ones
function splitObstacle(obstacle, index) {
    // Remove the original obstacle
    obstacles.splice(index, 1);

    // Create 4 smaller obstacles
    for (let i = 0; i < 4; i++) {
        let newObstacle = {
            x: obstacle.x + Math.random() * 20 - 10, // Slight offset for variety
            y: obstacle.y + Math.random() * 20 - 10,
            width: obstacle.width / 2, // Smaller size
            height: obstacle.height / 2, // Smaller size
            speed: obstacle.speed * 1.2, // Slightly faster
        };
        obstacles.push(newObstacle);
    }
}

// Simulate a breaking effect for power-up
function createBreakEffect(x, y) {
    for (let i = 0; i < 10; i++) {
        let angle = Math.random() * 2 * Math.PI;
        let speed = Math.random() * 2 + 1;
        particles.push({
            x: x,
            y: y,
            speedX: Math.cos(angle) * speed,
            speedY: Math.sin(angle) * speed,
            size: Math.random() * 5 + 2,
            opacity: 1
        });
    }
}

// Update and draw particles (for break effect)
function updateParticles() {
    for (let i = 0; i < particles.length; i++) {
        particles[i].x += particles[i].speedX;
        particles[i].y += particles[i].speedY;
        particles[i].size *= 0.98;
        particles[i].opacity -= 0.02;

        ctx.fillStyle = `rgba(255, 0, 0, ${particles[i].opacity})`;
        ctx.beginPath();
        ctx.arc(particles[i].x, particles[i].y, particles[i].size, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Remove particles that have faded out
    particles = particles.filter(p => p.opacity > 0);
}

// Game Over Screen
function gameOverScreen() {
    ctx.fillStyle = "#e60000";
    ctx.font = "32px Cinzel";
    ctx.fillText("Game Over! Score: " + score, canvas.width / 3, canvas.height / 2);
}

// Start button event listener
document.getElementById("start-button").addEventListener("click", startGame);

// Listen for key presses to move the player
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

// Function to update power-ups
function updatePowerUps() {
    for (let i = 0; i < powerUps.length; i++) {
        const powerUp = powerUps[i];
        ctx.fillStyle = "lightblue"; // Power-up color (light blue)
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);

        // Collision detection with player
        if (player.x < powerUp.x + powerUp.width &&
            player.x + player.width > powerUp.x &&
            player.y < powerUp.y + powerUp.height &&
            player.y + player.height > powerUp.y) {
            // Power-up collected by player, apply effect
            score += 10; // Example effect: increase score when collected
            player.invincible = true; // Make player invincible for a short time
            player.invincibilityTime = 500; // Set invincibility duration (can be adjusted)
            powerUps.splice(i, 1); // Remove the power-up after collection
            i--; // Adjust index to avoid skipping the next power-up
        }
    }
}

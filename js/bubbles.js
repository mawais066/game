/**
 * Mode A: Bubbles (Letter Recognition)
 * - Minimum 5 bubbles active simultaneously
 * - Controlled upward movement
 * - Correct letter pop with particle feedback & score increase
 * - Defined penalty for incorrect keypresses (-5 pts, streak reset, screen shake)
 * - Miss counted when bubble reaches top boundary (limit = game over)
 * - Dynamic difficulty ramp-up during gameplay
 * - Clear Win Condition: Clear target goal bubbles for chosen difficulty
 * - Clear Game Over Condition: Escaped bubbles reach miss limit
 * - Reliable Restart and Reset controls with zero page reloads
 * - Strict timer cleanup preventing duplicate loops
 */

class BubblesGame {
    constructor(arenaEl, options = {}) {
        this.arena = arenaEl;
        this.options = options;
        
        // Difficulty presets (speed, target complexity, miss survival limit, target goal)
        this.difficultyConfigs = {
            easy: {
                minBubbles: 5,
                baseSpeed: 1.15,
                maxMisses: 6,
                targetGoal: 30,
                allowedCharacters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                speedIncrement: 0.05,
                milestonePoints: 50
            },
            medium: {
                minBubbles: 6,
                baseSpeed: 1.65,
                maxMisses: 5,
                targetGoal: 45,
                allowedCharacters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                speedIncrement: 0.08,
                milestonePoints: 45
            },
            hard: {
                minBubbles: 7,
                baseSpeed: 2.25,
                maxMisses: 4,
                targetGoal: 60,
                allowedCharacters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                speedIncrement: 0.12,
                milestonePoints: 40
            }
        };

        this.currentDifficulty = 'easy';
        this.config = this.difficultyConfigs.easy;

        // State variables
        this.isRunning = false;
        this.isPaused = false;
        this.bubbles = []; // Array of active bubble objects
        this.score = 0;
        this.misses = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.correctHits = 0;
        this.incorrectHits = 0;
        this.level = 1;
        this.currentSpeed = 1.15;
        this.totalSpawned = 0;
        this.animationFrameId = null;
        this.lastTime = 0;

        // Callback hooks for UI
        this.onScoreUpdate = options.onScoreUpdate || (() => {});
        this.onMissUpdate = options.onMissUpdate || (() => {});
        this.onStreakUpdate = options.onStreakUpdate || (() => {});
        this.onLevelUpdate = options.onLevelUpdate || (() => {});
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
        this.onGameOver = options.onGameOver || (() => {});
        this.onStatusMessage = options.onStatusMessage || (() => {});

        this.loop = this.loop.bind(this);
    }

    setDifficulty(diffKey) {
        if (this.difficultyConfigs[diffKey]) {
            this.currentDifficulty = diffKey;
            this.config = this.difficultyConfigs[diffKey];
        }
    }

    start() {
        this.stop(); // Safe timer cleanup before start
        this.resetState();
        this.isRunning = true;
        this.isPaused = false;

        // Ensure minimum simultaneous bubbles right away
        for (let i = 0; i < this.config.minBubbles; i++) {
            this.spawnBubble(true, i * 75); // Stagger initial heights
        }

        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop);
        
        this.notifyHUD();
        this.onStatusMessage(`Bubbles Arena active [${this.currentDifficulty.toUpperCase()}] - Pop ${this.config.targetGoal} bubbles to win!`);
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.lastTime = performance.now();
            this.animationFrameId = requestAnimationFrame(this.loop);
            this.onStatusMessage(`Session Resumed. Keep popping!`);
        } else {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this.onStatusMessage(`Session Paused. Click Resume to continue.`);
        }
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    reset() {
        this.stop();
        this.clearAllBubblesFromDOM();
        this.resetState();
        this.notifyHUD();
        this.onStatusMessage(`Bubbles Mode reset to zero. Press Start when ready.`);
    }

    restart() {
        this.stop();
        this.clearAllBubblesFromDOM();
        this.start();
    }

    resetState() {
        this.clearAllBubblesFromDOM();
        this.bubbles = [];
        this.score = 0;
        this.misses = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.correctHits = 0;
        this.incorrectHits = 0;
        this.level = 1;
        this.currentSpeed = this.config.baseSpeed;
        this.totalSpawned = 0;
    }

    clearAllBubblesFromDOM() {
        if (!this.arena) return;
        const existing = this.arena.querySelectorAll('.game-bubble, .particle, .score-flyer, .arena-toast');
        existing.forEach(el => el.remove());
    }

    notifyHUD() {
        const livesLeft = Math.max(0, this.config.maxMisses - this.misses);
        this.onScoreUpdate(this.score);
        this.onMissUpdate(this.misses, this.config.maxMisses, livesLeft);
        this.onStreakUpdate(this.streak, this.maxStreak);
        this.onLevelUpdate(this.level, this.currentSpeed);
        this.onStatsUpdate({
            correct: this.correctHits,
            incorrect: this.incorrectHits,
            progress: `${this.correctHits} / ${this.config.targetGoal}`,
            targetGoal: this.config.targetGoal,
            livesRemaining: livesLeft
        });
    }

    /**
     * Spawn an interactive letter bubble
     */
    spawnBubble(initialStagger = false, staggerOffset = 0) {
        if (!this.arena) return null;

        const arenaRect = this.arena.getBoundingClientRect();
        const bubbleSize = 64; // px
        const padding = 20;

        // Choose random character from current difficulty pool
        const pool = this.config.allowedCharacters;
        const letter = pool[Math.floor(Math.random() * pool.length)];

        // Ensure horizontal placement within arena
        const arenaWidth = arenaRect.width > 0 ? arenaRect.width : 500;
        const usableWidth = Math.max(80, arenaWidth - bubbleSize - padding * 2);
        const xPos = padding + Math.random() * usableWidth;

        // Start below the visible arena, or staggered up if initializing
        const arenaHeight = arenaRect.height > 0 ? arenaRect.height : 500;
        const startY = initialStagger ? (arenaHeight - 90 - staggerOffset) : (arenaHeight + 10);

        // Individual bubble drift speed with slight natural variation
        const speedMultiplier = 0.9 + Math.random() * 0.25;
        const bubbleSpeed = this.currentSpeed * speedMultiplier;

        // Create DOM element
        const el = document.createElement('div');
        el.className = 'game-bubble';
        el.dataset.letter = letter;
        el.innerHTML = `
            <span class="bubble-letter">${letter}</span>
            <div class="bubble-shine"></div>
        `;

        el.style.left = `${xPos}px`;
        el.style.top = `${startY}px`;
        el.style.width = `${bubbleSize}px`;
        el.style.height = `${bubbleSize}px`;

        // Touch & mouse click support for responsive mobile usability
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.handleInput(letter);
        });

        this.arena.appendChild(el);

        const bubbleObj = {
            id: ++this.totalSpawned,
            letter: letter,
            x: xPos,
            y: startY,
            speed: bubbleSpeed,
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.03,
            el: el
        };

        this.bubbles.push(bubbleObj);
        return bubbleObj;
    }

    /**
     * Main 60fps animation loop
     */
    loop(currentTime) {
        if (!this.isRunning || this.isPaused) return;

        const dt = Math.min((currentTime - this.lastTime) / 16.666, 2.5); // normalized frame delta
        this.lastTime = currentTime;

        const topBoundary = 25; // Top laser/danger boundary threshold

        // Update each bubble
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];

            b.y -= b.speed * dt;
            b.wobblePhase += b.wobbleSpeed * dt;
            const wobbleX = Math.sin(b.wobblePhase) * 6;

            b.el.style.top = `${b.y}px`;
            b.el.style.transform = `translateX(${wobbleX}px)`;

            // Boundary collision check: bubble reaches the top
            if (b.y <= topBoundary) {
                this.handleBubbleMiss(b, i);
                if (!this.isRunning) return; // Game over or win reached
            }
        }

        // Maintain minimum bubbles simultaneously at all times
        while (this.bubbles.length < this.config.minBubbles) {
            this.spawnBubble();
        }

        if (this.isRunning && !this.isPaused) {
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    /**
     * Handle keypress input
     */
    handleInput(key) {
        if (!this.isRunning || this.isPaused) return;

        const char = key.toUpperCase();

        // Find candidate bubbles matching the pressed key
        // Prioritize the one closest to the top boundary (highest urgency)
        let matchedIndex = -1;
        let minY = Infinity;

        for (let i = 0; i < this.bubbles.length; i++) {
            if (this.bubbles[i].letter === char) {
                if (this.bubbles[i].y < minY) {
                    minY = this.bubbles[i].y;
                    matchedIndex = i;
                }
            }
        }

        if (matchedIndex !== -1) {
            // SUCCESSFUL POP
            this.handleBubblePop(this.bubbles[matchedIndex], matchedIndex);
        } else {
            // INCORRECT KEYPRESS PENALTY
            this.handleIncorrectPenalty(char);
        }
    }

    /**
     * Handle popping a matched bubble
     */
    handleBubblePop(bubble, index) {
        this.bubbles.splice(index, 1);
        this.correctHits++;
        this.streak++;
        if (this.streak > this.maxStreak) {
            this.maxStreak = this.streak;
        }

        // Streak multiplier: 1x, 1.5x at 5, 2x at 10, 3x at 20
        let multiplier = 1;
        if (this.streak >= 20) multiplier = 3;
        else if (this.streak >= 10) multiplier = 2;
        else if (this.streak >= 5) multiplier = 1.5;

        const pointsEarned = Math.round(10 * multiplier);
        this.score += pointsEarned;

        // Sound effect
        if (window.soundEngine) {
            window.soundEngine.playPop();
            if (this.streak > 0 && this.streak % 5 === 0) {
                window.soundEngine.playStreak();
            }
        }

        // Visual feedback: pop animation & particles
        this.createParticles(bubble.x + 32, bubble.y + 32, 'emerald');
        this.showFloatingText(bubble.x + 20, bubble.y, `+${pointsEarned}`, 'bonus');

        // Remove DOM element with scale effect
        bubble.el.classList.add('pop-burst');
        setTimeout(() => bubble.el.remove(), 200);

        this.notifyHUD();

        // Check Win Condition: Target goal bubbles cleared
        if (this.correctHits >= this.config.targetGoal) {
            this.triggerGameOver('victory');
            return;
        }

        // In-game dynamic difficulty progression check
        this.checkDynamicDifficulty();

        // Spawn a replacement immediately to keep continuous flow
        this.spawnBubble();
    }

    /**
     * Apply penalty on incorrect keypress
     */
    handleIncorrectPenalty(char) {
        this.incorrectHits++;
        const penaltyPoints = 5;
        this.score = Math.max(0, this.score - penaltyPoints);
        this.streak = 0; // Streak broken

        if (window.soundEngine) {
            window.soundEngine.playError();
        }

        // Visual screen shake / red border flash
        if (this.arena) {
            this.arena.classList.remove('arena-shake');
            void this.arena.offsetWidth; // trigger reflow
            this.arena.classList.add('arena-shake');
        }

        // Show penalty flyer in center or top
        this.showFloatingText(
            this.arena.offsetWidth / 2 - 30,
            100,
            `-${penaltyPoints} PENALTY [${char}]`,
            'penalty'
        );

        this.notifyHUD();
        this.onStatusMessage(`Incorrect key [${char}]! -${penaltyPoints} pts penalty.`);
    }

    /**
     * Miss counted when bubble reaches top boundary
     */
    handleBubbleMiss(bubble, index) {
        this.bubbles.splice(index, 1);
        this.misses++;
        this.streak = 0;

        if (window.soundEngine) {
            window.soundEngine.playMiss();
        }

        // Visual red miss pop at boundary
        this.createParticles(bubble.x + 32, bubble.y + 32, 'rose');
        this.showFloatingText(bubble.x, bubble.y + 10, 'MISSED!', 'miss');

        bubble.el.classList.add('bubble-miss-fade');
        setTimeout(() => bubble.el.remove(), 250);

        this.notifyHUD();

        // Check Game Over condition: Miss limit exceeded
        if (this.misses >= this.config.maxMisses) {
            this.triggerGameOver('misses_exceeded');
            return;
        }

        this.onStatusMessage(`Bubble '${bubble.letter}' escaped! Miss ${this.misses}/${this.config.maxMisses}`);

        // Keep at least minimum bubbles
        this.spawnBubble();
    }

    /**
     * Dynamic difficulty progression during play
     */
    checkDynamicDifficulty() {
        const threshold = this.config.milestonePoints;
        const calculatedLevel = 1 + Math.floor(this.score / threshold);

        if (calculatedLevel > this.level) {
            this.level = calculatedLevel;
            this.currentSpeed = Number((this.config.baseSpeed + (this.level - 1) * this.config.speedIncrement).toFixed(2));
            
            if (window.soundEngine) {
                window.soundEngine.playLevelUp();
            }

            this.onStatusMessage(`⚡ SPEED LEVEL UP! Level ${this.level} (Speed: ${this.currentSpeed}x)`);
            this.showToast(`Level ${this.level} - Speed Up!`);
        }
    }

    triggerGameOver(reason) {
        this.stop();
        if (window.soundEngine) {
            if (reason === 'victory') {
                window.soundEngine.playLevelUp();
            } else {
                window.soundEngine.playGameOver();
            }
        }

        const totalAttempts = this.correctHits + this.incorrectHits;
        const accuracy = totalAttempts > 0 
            ? Math.round((this.correctHits / totalAttempts) * 100) 
            : 0;

        const isVictory = (reason === 'victory');
        const reasonText = isVictory 
            ? `Victory! All ${this.config.targetGoal} Target Bubbles Cleared!` 
            : `Miss Limit Exceeded (${this.misses}/${this.config.maxMisses})`;

        const results = {
            mode: 'bubbles',
            title: 'Bubbles: Letter Recognition',
            reason: reasonText,
            isWin: isVictory,
            score: this.score,
            difficulty: this.currentDifficulty,
            correct: this.correctHits,
            incorrect: this.incorrectHits,
            accuracy: accuracy,
            misses: this.misses,
            maxMisses: this.config.maxMisses,
            livesRemaining: Math.max(0, this.config.maxMisses - this.misses),
            maxStreak: this.maxStreak,
            levelReached: this.level,
            targetGoal: this.config.targetGoal
        };

        this.onGameOver(results);
    }

    /**
     * Visual Particle Burst
     */
    createParticles(x, y, color = 'emerald') {
        const particleCount = 10;
        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.className = `particle particle-${color}`;
            
            const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.4;
            const velocity = 25 + Math.random() * 35;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity;

            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
            p.style.setProperty('--dx', `${dx}px`);
            p.style.setProperty('--dy', `${dy}px`);

            this.arena.appendChild(p);
            setTimeout(() => p.remove(), 450);
        }
    }

    /**
     * Floating text indicator (+10, -5, etc)
     */
    showFloatingText(x, y, text, type = 'bonus') {
        const span = document.createElement('div');
        span.className = `score-flyer flyer-${type}`;
        span.textContent = text;
        span.style.left = `${Math.max(10, x)}px`;
        span.style.top = `${Math.max(20, y)}px`;

        this.arena.appendChild(span);
        setTimeout(() => span.remove(), 700);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'arena-toast';
        toast.textContent = message;
        this.arena.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 1200);
    }
}

window.BubblesGame = BubblesGame;

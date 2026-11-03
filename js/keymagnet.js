/**
 * Mode B: KeyMagnet (Keyboard Precision)
 * - Visible interactive keyboard layout with magnetic target highlighting
 * - JavaScript array target generation with configurable practice sets
 * - Real-time tracking of correct hits, incorrect hits, accuracy, and reaction latency (ms)
 * - Immediate visual and auditory feedback on correct/incorrect hits
 * - Easy/Medium/Hard difficulty influencing target time-window, sequence length, and strike limits
 * - Strict timer cleanup preventing duplicate loops or orphaned timeouts
 * - Clear Win Condition (Sequence Mastery) and Game Over Condition (Strike Limit)
 * - Reliable Restart and Reset controls with zero page reloads
 */

class KeyMagnetGame {
    constructor(containerEl, keyboardEl, options = {}) {
        this.container = containerEl;
        this.keyboardEl = keyboardEl;
        this.options = options;

        // Practice Sets (JavaScript Arrays)
        this.practiceSets = {
            homeRow: {
                name: 'Home Row (A, S, D, F, J, K, L, ;)',
                keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'],
                description: 'Foundational touch-typing posture and finger resting zone.'
            },
            topRow: {
                name: 'Top Row (Q - P)',
                keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                description: 'Train upward finger reaches and precision.'
            },
            bottomRow: {
                name: 'Bottom Row (Z - M)',
                keys: ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.'],
                description: 'Train downward finger curls and acute angles.'
            },
            alphabet: {
                name: 'Full Alphabet (A - Z)',
                keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
                description: 'Comprehensive 26-letter keyboard fluency.'
            },
            numbers: {
                name: 'Numbers & Symbols (1 - 0)',
                keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
                description: 'Top numerical row precision.'
            }
        };

        // Difficulty configurations
        this.difficultyConfigs = {
            easy: {
                timeLimitMs: 2600, // Generous reaction window
                basePoints: 20,
                penaltyPoints: 5,
                fastBonusThreshold: 800,
                roundTargetCount: 25,
                maxStrikes: 5
            },
            medium: {
                timeLimitMs: 1600, // Standard reaction window
                basePoints: 30,
                penaltyPoints: 10,
                fastBonusThreshold: 550,
                roundTargetCount: 30,
                maxStrikes: 4
            },
            hard: {
                timeLimitMs: 1000, // Twitch reflex window
                basePoints: 50,
                penaltyPoints: 15,
                fastBonusThreshold: 400,
                roundTargetCount: 35,
                maxStrikes: 3
            }
        };

        this.currentSetKey = 'homeRow';
        this.currentDifficulty = 'easy';
        this.config = this.difficultyConfigs.easy;

        // State variables
        this.isRunning = false;
        this.isPaused = false;
        this.currentTarget = null;
        this.currentTargetIndex = 0;
        this.totalTargetsInRound = 25;
        this.targetQueue = [];
        
        // Metrics
        this.score = 0;
        this.correctHits = 0;
        this.incorrectHits = 0;
        this.strikes = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.reactionTimes = []; // array of ms durations
        this.bestReactionTime = Infinity;

        // Timing Engine variables
        this.targetDuration = 2600;
        this.targetRemaining = 2600;
        this.targetStartTime = 0;
        this.progressAnimId = null;
        this.transitionTimerId = null;

        // UI Callbacks
        this.onTargetChange = options.onTargetChange || (() => {});
        this.onScoreUpdate = options.onScoreUpdate || (() => {});
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
        this.onStreakUpdate = options.onStreakUpdate || (() => {});
        this.onRoundComplete = options.onRoundComplete || (() => {});
        this.onStatusMessage = options.onStatusMessage || (() => {});

        this.stepTimer = this.stepTimer.bind(this);
        this.initVirtualKeyboardEvents();
    }

    setPracticeSet(setKey) {
        if (this.practiceSets[setKey]) {
            this.currentSetKey = setKey;
        }
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

        // Generate target sequence for this session from selected array
        this.generateTargetQueue();
        this.totalTargetsInRound = this.targetQueue.length;

        this.nextTarget();
        this.onStatusMessage(`KeyMagnet active: Set [${this.practiceSets[this.currentSetKey].name}] - [${this.currentDifficulty.toUpperCase()}]`);
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            // Pause active timer loop and save remaining time
            if (this.progressAnimId) {
                cancelAnimationFrame(this.progressAnimId);
                this.progressAnimId = null;
            }
            if (this.transitionTimerId) {
                clearTimeout(this.transitionTimerId);
                this.transitionTimerId = null;
            }
            this.onStatusMessage(`Drill Paused. Click Resume to continue.`);
        } else {
            // Resume with the preserved remaining time
            this.targetStartTime = performance.now() - (this.targetDuration - this.targetRemaining);
            this.progressAnimId = requestAnimationFrame(this.stepTimer);
            this.onStatusMessage(`Drill Resumed.`);
        }
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.clearCurrentTimers();
        this.clearKeyHighlights();
    }

    reset() {
        this.stop();
        this.resetState();
        this.clearKeyHighlights();
        this.onTargetChange(null);
        this.resetTargetStationUI();
        this.notifyHUD();
        this.onStatusMessage(`KeyMagnet reset to zero. Press Start when ready.`);
    }

    restart() {
        this.stop();
        this.start();
    }

    resetState() {
        this.score = 0;
        this.correctHits = 0;
        this.incorrectHits = 0;
        this.strikes = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.reactionTimes = [];
        this.bestReactionTime = Infinity;
        this.currentTarget = null;
        this.currentTargetIndex = 0;
        this.targetQueue = [];
        this.targetRemaining = this.config.timeLimitMs;
        this.targetDuration = this.config.timeLimitMs;
    }

    clearCurrentTimers() {
        if (this.progressAnimId) {
            cancelAnimationFrame(this.progressAnimId);
            this.progressAnimId = null;
        }
        if (this.transitionTimerId) {
            clearTimeout(this.transitionTimerId);
            this.transitionTimerId = null;
        }
    }

    resetTargetStationUI() {
        const targetCharEl = document.getElementById('magnet-target-char');
        const roundStepEl = document.getElementById('magnet-round-step');
        const progressEl = document.getElementById('magnet-timer-bar');
        const countdownEl = document.getElementById('magnet-timer-countdown');
        const feedbackBadge = document.getElementById('magnet-feedback-badge');

        if (targetCharEl) targetCharEl.textContent = '--';
        if (roundStepEl) roundStepEl.textContent = `0 / ${this.config.roundTargetCount}`;
        if (progressEl) {
            progressEl.style.width = '0%';
            progressEl.style.backgroundColor = 'var(--color-primary)';
        }
        if (countdownEl) countdownEl.textContent = 'Ready';
        if (feedbackBadge) {
            feedbackBadge.textContent = 'Ready';
            feedbackBadge.className = 'feedback-badge';
        }
    }

    generateTargetQueue() {
        const pool = this.practiceSets[this.currentSetKey].keys;
        const count = this.config.roundTargetCount;
        this.targetQueue = [];

        let lastKey = null;
        for (let i = 0; i < count; i++) {
            // Avoid immediately repeating the same key for better training cadence
            let nextKey;
            do {
                nextKey = pool[Math.floor(Math.random() * pool.length)];
            } while (pool.length > 1 && nextKey === lastKey);
            
            this.targetQueue.push(nextKey);
            lastKey = nextKey;
        }
    }

    nextTarget() {
        if (!this.isRunning) return;

        this.clearCurrentTimers();
        this.clearKeyHighlights();

        if (this.currentTargetIndex >= this.totalTargetsInRound) {
            // All targets in sequence successfully completed!
            this.triggerRoundComplete('completed');
            return;
        }

        this.currentTarget = this.targetQueue[this.currentTargetIndex];
        this.currentTargetIndex++;
        this.targetDuration = this.config.timeLimitMs;
        this.targetRemaining = this.config.timeLimitMs;
        this.targetStartTime = performance.now();

        // Highlight magnetic target on virtual keyboard
        this.highlightTargetKey(this.currentTarget);

        // Notify UI to render target glyph and step
        this.onTargetChange({
            key: this.currentTarget,
            current: this.currentTargetIndex,
            total: this.totalTargetsInRound,
            timeLimitMs: this.config.timeLimitMs
        });

        // Start synchronized timer animation
        this.progressAnimId = requestAnimationFrame(this.stepTimer);
    }

    /**
     * Precision animation frame timer loop
     */
    stepTimer() {
        if (!this.isRunning || this.isPaused) return;

        const now = performance.now();
        const elapsed = now - this.targetStartTime;
        this.targetRemaining = Math.max(0, this.targetDuration - elapsed);
        const ratio = this.targetRemaining / this.targetDuration;

        const progressEl = document.getElementById('magnet-timer-bar');
        const countdownEl = document.getElementById('magnet-timer-countdown');

        if (progressEl) {
            progressEl.style.width = `${ratio * 100}%`;
            // Dynamic color shift as reaction window expires
            if (ratio < 0.25) {
                progressEl.style.backgroundColor = 'var(--color-danger)';
            } else if (ratio < 0.5) {
                progressEl.style.backgroundColor = 'var(--color-warning)';
            } else {
                progressEl.style.backgroundColor = 'var(--color-primary)';
            }
        }

        const secondsText = (this.targetRemaining / 1000).toFixed(1) + 's';
        if (countdownEl) {
            countdownEl.textContent = `${secondsText} remaining`;
        }

        // Live update time left in HUD pill
        this.notifyHUD(null, secondsText);

        if (this.targetRemaining <= 0) {
            this.handleTimeout();
        } else {
            this.progressAnimId = requestAnimationFrame(this.stepTimer);
        }
    }

    handleTimeout() {
        this.clearCurrentTimers();
        this.incorrectHits++;
        this.strikes++;
        this.streak = 0;
        this.reactionTimes.push(this.config.timeLimitMs); // Max latency penalty

        if (window.soundEngine) {
            window.soundEngine.playError();
        }

        this.flashTargetFeedback(false, 'TIMEOUT!');
        this.notifyHUD();

        // Check Game Over: Strike limit exceeded
        if (this.strikes >= this.config.maxStrikes) {
            this.triggerRoundComplete('strikes_exceeded');
            return;
        }

        this.onStatusMessage(`Time expired for target [${this.currentTarget}]! Strike ${this.strikes}/${this.config.maxStrikes}`);

        this.transitionTimerId = setTimeout(() => {
            this.nextTarget();
        }, 320);
    }

    handleInput(key) {
        if (!this.isRunning || this.isPaused || !this.currentTarget) return;

        const pressedKey = key.toUpperCase();
        const targetUpper = this.currentTarget.toUpperCase();
        const now = performance.now();
        const latencyMs = Math.round(now - this.targetStartTime);

        this.clearCurrentTimers();

        // Check if correct
        if (pressedKey === targetUpper) {
            this.handleCorrectKey(pressedKey, latencyMs);
        } else {
            this.handleIncorrectKey(pressedKey);
        }
    }

    handleCorrectKey(key, latencyMs) {
        this.correctHits++;
        this.streak++;
        if (this.streak > this.maxStreak) {
            this.maxStreak = this.streak;
        }

        this.reactionTimes.push(latencyMs);
        if (latencyMs < this.bestReactionTime) {
            this.bestReactionTime = latencyMs;
        }

        // Calculate score with reaction speed bonus
        let points = this.config.basePoints;
        let bonusText = '';
        if (latencyMs <= this.config.fastBonusThreshold) {
            const speedBonus = Math.round((1 - (latencyMs / this.config.fastBonusThreshold)) * 25);
            points += speedBonus;
            bonusText = ` +${speedBonus}⚡`;
        }

        // Multiplier from streak
        if (this.streak >= 15) points = Math.round(points * 2);
        else if (this.streak >= 8) points = Math.round(points * 1.5);

        this.score += points;

        // Auditory feedback
        if (window.soundEngine) {
            window.soundEngine.playCorrect();
            if (this.streak > 0 && this.streak % 5 === 0) {
                window.soundEngine.playStreak();
            }
        }

        // Visual feedback
        this.flashVirtualKey(key, 'correct');
        this.flashTargetFeedback(true, `${latencyMs}ms${bonusText}`);

        this.notifyHUD(latencyMs);
        this.onStatusMessage(`Target [${key}] hit in ${latencyMs}ms! (+${points} pts)`);

        // Check if this was the last target in the round
        if (this.currentTargetIndex >= this.totalTargetsInRound) {
            this.transitionTimerId = setTimeout(() => {
                this.triggerRoundComplete('completed');
            }, 250);
            return;
        }

        // Advance to next target after brief tactile cadence
        this.transitionTimerId = setTimeout(() => {
            this.nextTarget();
        }, 180);
    }

    handleIncorrectKey(key) {
        this.incorrectHits++;
        this.strikes++;
        this.streak = 0;
        this.score = Math.max(0, this.score - this.config.penaltyPoints);

        if (window.soundEngine) {
            window.soundEngine.playError();
        }

        this.flashVirtualKey(key, 'incorrect');
        this.flashTargetFeedback(false, `WRONG [${key}]`);

        this.notifyHUD();

        // Check Game Over condition: Strikes exceeded
        if (this.strikes >= this.config.maxStrikes) {
            this.triggerRoundComplete('strikes_exceeded');
            return;
        }

        this.onStatusMessage(`Incorrect key [${key}]. Expected [${this.currentTarget}]. Strike ${this.strikes}/${this.config.maxStrikes}`);

        this.transitionTimerId = setTimeout(() => {
            this.nextTarget();
        }, 280);
    }

    notifyHUD(lastLatencyMs = null, timeLeftText = null) {
        const total = this.correctHits + this.incorrectHits;
        const accuracy = total > 0 ? Math.round((this.correctHits / total) * 100) : 100;
        
        let avgLatency = 0;
        if (this.reactionTimes.length > 0) {
            const sum = this.reactionTimes.reduce((a, b) => a + b, 0);
            avgLatency = Math.round(sum / this.reactionTimes.length);
        }

        const remainingSeconds = timeLeftText || ((this.targetRemaining / 1000).toFixed(1) + 's');

        this.onScoreUpdate(this.score);
        this.onStreakUpdate(this.streak, this.maxStreak);
        this.onStatsUpdate({
            accuracy,
            avgLatency,
            lastLatency: lastLatencyMs,
            bestLatency: this.bestReactionTime === Infinity ? 0 : this.bestReactionTime,
            correct: this.correctHits,
            incorrect: this.incorrectHits,
            strikes: this.strikes,
            maxStrikes: this.config.maxStrikes,
            timeLeft: remainingSeconds,
            progress: `${this.currentTargetIndex} / ${this.totalTargetsInRound}`
        });
    }

    triggerRoundComplete(reason) {
        this.stop();
        const isWin = (reason === 'completed');
        
        if (window.soundEngine) {
            if (isWin) {
                window.soundEngine.playLevelUp();
            } else {
                window.soundEngine.playGameOver();
            }
        }

        const total = this.correctHits + this.incorrectHits;
        const accuracy = total > 0 ? Math.round((this.correctHits / total) * 100) : 0;
        
        let avgLatency = 0;
        if (this.reactionTimes.length > 0) {
            const sum = this.reactionTimes.reduce((a, b) => a + b, 0);
            avgLatency = Math.round(sum / this.reactionTimes.length);
        }

        const reasonText = isWin 
            ? `Drill Completed! All ${this.totalTargetsInRound} targets cleared.` 
            : `Strike Limit Exceeded (${this.strikes}/${this.config.maxStrikes} strikes)`;

        const results = {
            mode: 'keymagnet',
            title: 'KeyMagnet: Keyboard Precision',
            reason: reasonText,
            isWin: isWin,
            score: this.score,
            difficulty: this.currentDifficulty,
            practiceSet: this.practiceSets[this.currentSetKey].name,
            correct: this.correctHits,
            incorrect: this.incorrectHits,
            strikes: this.strikes,
            maxStrikes: this.config.maxStrikes,
            accuracy: accuracy,
            avgLatencyMs: avgLatency,
            bestLatencyMs: this.bestReactionTime === Infinity ? 0 : this.bestReactionTime,
            maxStreak: this.maxStreak,
            totalTargets: this.totalTargetsInRound
        };

        this.onRoundComplete(results);
    }

    // --- On-screen Keyboard Visualization ---

    initVirtualKeyboardEvents() {
        if (!this.keyboardEl) return;

        this.keyboardEl.addEventListener('click', (e) => {
            const keyBtn = e.target.closest('.vk-key');
            if (keyBtn && keyBtn.dataset.key) {
                const keyValue = keyBtn.dataset.key;
                if (window.soundEngine) {
                    window.soundEngine.playClick();
                }
                this.handleInput(keyValue);
            }
        });
    }

    highlightTargetKey(char) {
        this.clearKeyHighlights();
        if (!this.keyboardEl || !char) return;

        const selector = `.vk-key[data-key="${char.toUpperCase()}"]`;
        const keyEl = this.keyboardEl.querySelector(selector);
        if (keyEl) {
            keyEl.classList.add('vk-target-magnetic');
        }
    }

    flashVirtualKey(char, type) {
        if (!this.keyboardEl || !char) return;

        const selector = `.vk-key[data-key="${char.toUpperCase()}"]`;
        const keyEl = this.keyboardEl.querySelector(selector);
        if (keyEl) {
            keyEl.classList.remove('vk-correct-hit', 'vk-incorrect-hit');
            void keyEl.offsetWidth; // re-flow
            keyEl.classList.add(type === 'correct' ? 'vk-correct-hit' : 'vk-incorrect-hit');
            setTimeout(() => {
                keyEl.classList.remove('vk-correct-hit', 'vk-incorrect-hit');
            }, 300);
        }
    }

    flashTargetFeedback(isSuccess, label) {
        const targetCard = document.getElementById('magnet-target-display');
        const feedbackBadge = document.getElementById('magnet-feedback-badge');

        if (targetCard) {
            targetCard.classList.remove('pulse-success', 'shake-error');
            void targetCard.offsetWidth;
            targetCard.classList.add(isSuccess ? 'pulse-success' : 'shake-error');
        }

        if (feedbackBadge) {
            feedbackBadge.textContent = label;
            feedbackBadge.className = `feedback-badge ${isSuccess ? 'badge-success' : 'badge-danger'} active`;
            setTimeout(() => {
                feedbackBadge.classList.remove('active');
            }, 500);
        }
    }

    clearKeyHighlights() {
        if (!this.keyboardEl) return;
        const keys = this.keyboardEl.querySelectorAll('.vk-key');
        keys.forEach(k => {
            k.classList.remove('vk-target-magnetic', 'vk-correct-hit', 'vk-incorrect-hit');
        });
    }
}

window.KeyMagnetGame = KeyMagnetGame;

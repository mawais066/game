/**
 * TypePulse Pro - Main Application Controller
 * Handles routing, difficulty configurations, HUD updates, results modal,
 * high score persistence, and non-reloading gameplay controls.
 */

class AppController {
    constructor() {
        this.activeMode = null; // 'bubbles' | 'keymagnet' | null
        this.bubblesGame = null;
        this.magnetGame = null;

        // Selected settings on dashboard
        this.bubblesDifficulty = 'easy';
        this.magnetDifficulty = 'easy';
        this.magnetPracticeSet = 'homeRow';

        // Career / LocalStorage records
        this.records = this.loadRecords();

        this.initDOMReferences();
        this.initInstances();
        this.bindEvents();
        this.updateDashboardMetrics();
    }

    loadRecords() {
        try {
            const data = localStorage.getItem('typepulse_records');
            if (data) return JSON.parse(data);
        } catch (e) {
            console.warn('LocalStorage unavailable:', e);
        }
        return {
            bubblesBestScore: 0,
            magnetBestScore: 0,
            bestReactionLatency: null,
            totalHits: 0,
            totalCorrect: 0
        };
    }

    saveRecords() {
        try {
            localStorage.setItem('typepulse_records', JSON.stringify(this.records));
        } catch (e) {
            console.warn('LocalStorage save failed:', e);
        }
    }

    initDOMReferences() {
        // Views
        this.viewHome = document.getElementById('view-home');
        this.viewGame = document.getElementById('view-game');

        // Modals
        this.resultsModal = document.getElementById('results-modal');
        this.guideModal = document.getElementById('guide-modal');

        // HUD Elements
        this.hudModeName = document.getElementById('hud-mode-name');
        this.hudDifficultyPill = document.getElementById('hud-difficulty-pill');
        this.hudScore = document.getElementById('hud-current-score');
        
        // Universal Keypress Counters
        this.hudCorrectCount = document.getElementById('hud-correct-count');
        this.hudIncorrectCount = document.getElementById('hud-incorrect-count');

        // Bubbles HUD
        this.hudBubblesStats = document.getElementById('hud-bubbles-stats');
        this.hudBubblesProgress = document.getElementById('hud-bubbles-progress');
        this.hudMissCount = document.getElementById('hud-miss-count');
        this.hudSpeedMult = document.getElementById('hud-speed-multiplier');
        this.hudStreak = document.getElementById('hud-streak-count');

        // KeyMagnet HUD
        this.hudMagnetStats = document.getElementById('hud-magnet-stats');
        this.hudMagnetProgress = document.getElementById('hud-magnet-progress');
        this.hudMagnetTimeLeft = document.getElementById('hud-magnet-time-left');
        this.hudMagnetStrikes = document.getElementById('hud-magnet-strikes');
        this.hudMagnetAccuracy = document.getElementById('hud-magnet-accuracy');
        this.hudMagnetLatency = document.getElementById('hud-magnet-latency');

        // Arena Containers
        this.bubblesArenaWrapper = document.getElementById('bubbles-arena-wrapper');
        this.bubblesActiveArena = document.getElementById('bubbles-active-arena');
        this.magnetArenaWrapper = document.getElementById('magnet-arena-wrapper');
        this.virtualKeyboard = document.getElementById('virtual-keyboard');
        this.arenaStatusText = document.getElementById('arena-status-text');

        // Action Buttons
        this.btnCtrlStart = document.getElementById('btn-ctrl-start');
        this.btnCtrlPause = document.getElementById('btn-ctrl-pause');
        this.btnCtrlRestart = document.getElementById('btn-ctrl-restart');
        this.btnCtrlReset = document.getElementById('btn-ctrl-reset');
    }

    initInstances() {
        // Initialize Mode A: Bubbles
        this.bubblesGame = new BubblesGame(this.bubblesActiveArena, {
            onScoreUpdate: (score) => {
                if (this.hudScore) this.hudScore.textContent = score.toLocaleString();
            },
            onMissUpdate: (misses, maxMisses, livesLeft) => {
                if (this.hudMissCount) {
                    this.hudMissCount.textContent = `${misses} / ${maxMisses} (${livesLeft} left)`;
                    if (misses >= maxMisses - 1) {
                        this.hudMissCount.className = 'font-mono danger-text font-bold';
                    } else {
                        this.hudMissCount.className = 'font-mono danger-text';
                    }
                }
            },
            onStreakUpdate: (streak) => {
                if (this.hudStreak) this.hudStreak.textContent = `${streak}x`;
            },
            onLevelUpdate: (level, speed) => {
                if (this.hudSpeedMult) this.hudSpeedMult.textContent = `${speed.toFixed(2)}x`;
            },
            onStatsUpdate: (stats) => {
                if (this.hudCorrectCount) this.hudCorrectCount.textContent = stats.correct;
                if (this.hudIncorrectCount) this.hudIncorrectCount.textContent = stats.incorrect;
                if (this.hudBubblesProgress) this.hudBubblesProgress.textContent = stats.progress;
            },
            onStatusMessage: (msg) => {
                this.setStatusMessage(msg);
            },
            onGameOver: (results) => {
                this.handleSessionEnded(results);
            }
        });

        // Initialize Mode B: KeyMagnet
        this.magnetGame = new KeyMagnetGame(this.magnetArenaWrapper, this.virtualKeyboard, {
            onTargetChange: (targetData) => {
                const targetCharEl = document.getElementById('magnet-target-char');
                const roundStepEl = document.getElementById('magnet-round-step');
                if (targetData && targetCharEl) {
                    targetCharEl.textContent = targetData.key;
                    roundStepEl.textContent = `${targetData.current} / ${targetData.total}`;
                } else if (targetCharEl) {
                    targetCharEl.textContent = '--';
                    if (roundStepEl) roundStepEl.textContent = `0 / ${this.magnetGame.config.roundTargetCount}`;
                }
            },
            onScoreUpdate: (score) => {
                if (this.hudScore) this.hudScore.textContent = score.toLocaleString();
            },
            onStatsUpdate: (stats) => {
                if (this.hudCorrectCount) this.hudCorrectCount.textContent = stats.correct;
                if (this.hudIncorrectCount) this.hudIncorrectCount.textContent = stats.incorrect;
                if (this.hudMagnetProgress) this.hudMagnetProgress.textContent = stats.progress;
                if (this.hudMagnetTimeLeft) this.hudMagnetTimeLeft.textContent = stats.timeLeft;
                if (this.hudMagnetStrikes) this.hudMagnetStrikes.textContent = `${stats.strikes} / ${stats.maxStrikes}`;
                if (this.hudMagnetAccuracy) this.hudMagnetAccuracy.textContent = `${stats.accuracy}%`;
                if (this.hudMagnetLatency) this.hudMagnetLatency.textContent = stats.avgLatency > 0 ? `${stats.avgLatency} ms` : '--- ms';
            },
            onStreakUpdate: (streak) => {
                // KeyMagnet streak handling
            },
            onStatusMessage: (msg) => {
                this.setStatusMessage(msg);
            },
            onRoundComplete: (results) => {
                this.handleSessionEnded(results);
            }
        });
    }

    bindEvents() {
        // Navigation & Brand
        document.getElementById('btn-brand-home').addEventListener('click', () => this.navigateToHome());
        document.getElementById('btn-back-home').addEventListener('click', () => this.navigateToHome());

        // Header Modals & Sound
        document.getElementById('btn-how-to-play').addEventListener('click', () => this.showGuideModal(true));
        document.getElementById('btn-close-guide').addEventListener('click', () => this.showGuideModal(false));
        document.getElementById('btn-dismiss-guide').addEventListener('click', () => this.showGuideModal(false));
        document.getElementById('btn-sound-toggle').addEventListener('click', () => this.toggleAudio());

        // Dashboard Difficulty Segments (Mode A)
        const bubblesDiffBtns = document.querySelectorAll('#bubbles-difficulty-selector .segment-btn');
        bubblesDiffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                bubblesDiffBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.bubblesDifficulty = target.dataset.diff;
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Dashboard Practice Set & Difficulty (Mode B)
        const magnetSetSelect = document.getElementById('magnet-set-select');
        magnetSetSelect.addEventListener('change', (e) => {
            this.magnetPracticeSet = e.target.value;
            if (window.soundEngine) window.soundEngine.playClick();
        });

        const magnetDiffBtns = document.querySelectorAll('#magnet-difficulty-selector .segment-btn');
        magnetDiffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                magnetDiffBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.magnetDifficulty = target.dataset.diff;
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Dashboard Mode Launch Buttons
        document.getElementById('btn-start-bubbles').addEventListener('click', () => {
            this.launchMode('bubbles');
        });
        document.getElementById('btn-start-magnet').addEventListener('click', () => {
            this.launchMode('keymagnet');
        });

        // Arena In-Game Difficulty Quick Cycle
        if (this.hudDifficultyPill) {
            this.hudDifficultyPill.addEventListener('click', () => this.cycleDifficultyInGame());
        }

        // Arena Direct Controls (Start, Pause, Restart, Reset without page reload)
        this.btnCtrlStart.addEventListener('click', () => this.handleControlStart());
        this.btnCtrlPause.addEventListener('click', () => this.handleControlPause());
        this.btnCtrlRestart.addEventListener('click', () => this.handleControlRestart());
        this.btnCtrlReset.addEventListener('click', () => this.handleControlReset());

        // Results Modal Actions
        document.getElementById('btn-modal-restart').addEventListener('click', () => {
            this.hideResultsModal();
            this.handleControlRestart();
        });
        document.getElementById('btn-modal-home').addEventListener('click', () => {
            this.hideResultsModal();
            this.navigateToHome();
        });

        // Global Physical Keyboard Listener
        window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
    }

    /**
     * Switch view to Home Dashboard
     */
    navigateToHome() {
        // Stop any running game loops safely
        if (this.bubblesGame) this.bubblesGame.stop();
        if (this.magnetGame) this.magnetGame.stop();

        this.viewGame.classList.remove('active');
        this.viewHome.classList.add('active');
        this.activeMode = null;
        this.updateDashboardMetrics();
    }

    /**
     * Launch selected game mode
     */
    launchMode(modeKey) {
        if (window.soundEngine) {
            window.soundEngine.init();
            window.soundEngine.playClick();
        }

        this.activeMode = modeKey;
        this.viewHome.classList.remove('active');
        this.viewGame.classList.add('active');

        // Reset counters
        if (this.hudScore) this.hudScore.textContent = '0';
        if (this.hudCorrectCount) this.hudCorrectCount.textContent = '0';
        if (this.hudIncorrectCount) this.hudIncorrectCount.textContent = '0';

        if (modeKey === 'bubbles') {
            this.hudModeName.textContent = 'Mode A: Bubbles';
            this.hudDifficultyPill.textContent = this.bubblesDifficulty.toUpperCase();
            this.hudDifficultyPill.className = 'pill-badge pill-badge-btn mode-a-badge';

            this.hudBubblesStats.classList.remove('hidden');
            this.hudMagnetStats.classList.add('hidden');

            this.bubblesArenaWrapper.classList.remove('hidden');
            this.magnetArenaWrapper.classList.add('hidden');

            this.bubblesGame.setDifficulty(this.bubblesDifficulty);
            this.bubblesGame.start();

            this.btnCtrlStart.classList.add('hidden');
            this.btnCtrlPause.classList.remove('hidden');
            this.btnCtrlPause.querySelector('span').textContent = 'Pause';
        } else if (modeKey === 'keymagnet') {
            this.hudModeName.textContent = 'Mode B: KeyMagnet';
            this.hudDifficultyPill.textContent = this.magnetDifficulty.toUpperCase();
            this.hudDifficultyPill.className = 'pill-badge pill-badge-btn mode-b-badge';

            this.hudBubblesStats.classList.add('hidden');
            this.hudMagnetStats.classList.remove('hidden');

            this.bubblesArenaWrapper.classList.add('hidden');
            this.magnetArenaWrapper.classList.remove('hidden');

            this.magnetGame.setPracticeSet(this.magnetPracticeSet);
            this.magnetGame.setDifficulty(this.magnetDifficulty);
            this.magnetGame.start();

            this.btnCtrlStart.classList.add('hidden');
            this.btnCtrlPause.classList.remove('hidden');
            this.btnCtrlPause.querySelector('span').textContent = 'Pause';
        }
    }

    /**
     * In-game difficulty cycling (Easy -> Medium -> Hard -> Easy)
     */
    cycleDifficultyInGame() {
        const diffs = ['easy', 'medium', 'hard'];
        if (this.activeMode === 'bubbles') {
            const nextIdx = (diffs.indexOf(this.bubblesDifficulty) + 1) % diffs.length;
            this.bubblesDifficulty = diffs[nextIdx];
            this.hudDifficultyPill.textContent = this.bubblesDifficulty.toUpperCase();
            this.bubblesGame.setDifficulty(this.bubblesDifficulty);
            this.bubblesGame.start();
            this.setStatusMessage(`Switched to [${this.bubblesDifficulty.toUpperCase()}] difficulty.`);
        } else if (this.activeMode === 'keymagnet') {
            const nextIdx = (diffs.indexOf(this.magnetDifficulty) + 1) % diffs.length;
            this.magnetDifficulty = diffs[nextIdx];
            this.hudDifficultyPill.textContent = this.magnetDifficulty.toUpperCase();
            this.magnetGame.setDifficulty(this.magnetDifficulty);
            this.magnetGame.start();
            this.setStatusMessage(`Switched to [${this.magnetDifficulty.toUpperCase()}] difficulty.`);
        }
        if (window.soundEngine) window.soundEngine.playClick();
    }

    /**
     * Handle Start button
     */
    handleControlStart() {
        if (window.soundEngine) window.soundEngine.playClick();
        if (this.activeMode === 'bubbles') {
            if (!this.bubblesGame.isRunning) {
                this.bubblesGame.start();
            } else if (this.bubblesGame.isPaused) {
                this.bubblesGame.pause();
            }
        } else if (this.activeMode === 'keymagnet') {
            if (!this.magnetGame.isRunning) {
                this.magnetGame.start();
            } else if (this.magnetGame.isPaused) {
                this.magnetGame.pause();
            }
        }
        this.btnCtrlStart.classList.add('hidden');
        this.btnCtrlPause.classList.remove('hidden');
        this.btnCtrlPause.querySelector('span').textContent = 'Pause';
    }

    /**
     * Handle Pause / Resume toggle
     */
    handleControlPause() {
        let isPausedNow = false;
        if (this.activeMode === 'bubbles') {
            this.bubblesGame.pause();
            isPausedNow = this.bubblesGame.isPaused;
        } else if (this.activeMode === 'keymagnet') {
            this.magnetGame.pause();
            isPausedNow = this.magnetGame.isPaused;
        }

        const label = isPausedNow ? 'Resume' : 'Pause';
        this.btnCtrlPause.querySelector('span').textContent = label;
    }

    /**
     * Handle Restart control (instant state reset without page reload)
     */
    handleControlRestart() {
        if (window.soundEngine) window.soundEngine.playClick();
        if (this.hudScore) this.hudScore.textContent = '0';
        if (this.hudCorrectCount) this.hudCorrectCount.textContent = '0';
        if (this.hudIncorrectCount) this.hudIncorrectCount.textContent = '0';

        if (this.activeMode === 'bubbles') {
            this.bubblesGame.restart();
        } else if (this.activeMode === 'keymagnet') {
            this.magnetGame.restart();
        }

        this.btnCtrlStart.classList.add('hidden');
        this.btnCtrlPause.classList.remove('hidden');
        this.btnCtrlPause.querySelector('span').textContent = 'Pause';
        this.setStatusMessage('Game restarted with clean state.');
    }

    /**
     * Handle Reset control (wipes state and stands by without page reload)
     */
    handleControlReset() {
        if (window.soundEngine) window.soundEngine.playClick();
        if (this.activeMode === 'bubbles') {
            this.bubblesGame.reset();
        } else if (this.activeMode === 'keymagnet') {
            this.magnetGame.reset();
        }

        if (this.hudScore) this.hudScore.textContent = '0';
        if (this.hudCorrectCount) this.hudCorrectCount.textContent = '0';
        if (this.hudIncorrectCount) this.hudIncorrectCount.textContent = '0';
        if (this.hudStreak) this.hudStreak.textContent = '0x';

        this.btnCtrlStart.classList.remove('hidden');
        this.btnCtrlPause.classList.add('hidden');
        this.setStatusMessage('Game state reset to zero. Press Start when ready.');
    }

    /**
     * Route physical keyboard keypresses
     */
    handleGlobalKeyDown(e) {
        // Ignore typing if interacting with form dropdowns
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

        // Escape closes modals or exits
        if (e.key === 'Escape') {
            if (!this.guideModal.classList.contains('hidden')) {
                this.showGuideModal(false);
                return;
            }
            if (!this.resultsModal.classList.contains('hidden')) {
                this.hideResultsModal();
                return;
            }
        }

        // Space bar handling
        if (e.key === ' ' && this.activeMode) {
            e.preventDefault(); // Prevent page scroll
        }

        if (!this.activeMode) return;

        // Mode A input routing
        if (this.activeMode === 'bubbles' && this.bubblesGame && this.bubblesGame.isRunning) {
            if (e.key.length === 1) {
                this.bubblesGame.handleInput(e.key);
            }
        }

        // Mode B input routing
        if (this.activeMode === 'keymagnet' && this.magnetGame && this.magnetGame.isRunning) {
            if (e.key.length === 1) {
                this.magnetGame.handleInput(e.key);
            }
        }
    }

    /**
     * Sound Toggle
     */
    toggleAudio() {
        if (!window.soundEngine) return;
        const isMuted = window.soundEngine.toggleMute();
        const iconOn = document.getElementById('icon-sound-on');
        const iconOff = document.getElementById('icon-sound-off');
        const label = document.getElementById('sound-label');

        if (isMuted) {
            iconOn.classList.add('hidden');
            iconOff.classList.remove('hidden');
            label.textContent = 'Audio Muted';
        } else {
            iconOn.classList.remove('hidden');
            iconOff.classList.add('hidden');
            label.textContent = 'Audio On';
            window.soundEngine.playCorrect(); // Instant audible confirmation tone
        }
    }

    /**
     * Guide Modal
     */
    showGuideModal(show) {
        if (window.soundEngine) window.soundEngine.playClick();
        if (show) {
            this.guideModal.classList.remove('hidden');
        } else {
            this.guideModal.classList.add('hidden');
        }
    }

    /**
     * Display Results Screen at end of session
     */
    handleSessionEnded(results) {
        // Update persistent records
        if (results.mode === 'bubbles') {
            if (results.score > this.records.bubblesBestScore) {
                this.records.bubblesBestScore = results.score;
            }
        } else if (results.mode === 'keymagnet') {
            if (results.score > this.records.magnetBestScore) {
                this.records.magnetBestScore = results.score;
            }
            if (results.bestLatencyMs > 0) {
                if (!this.records.bestReactionLatency || results.bestLatencyMs < this.records.bestReactionLatency) {
                    this.records.bestReactionLatency = results.bestLatencyMs;
                }
            }
        }

        this.records.totalHits += (results.correct + results.incorrect);
        this.records.totalCorrect += results.correct;
        this.saveRecords();

        // Calculate Grade (S, A, B, C, D)
        const gradeInfo = this.calculateGrade(results.accuracy, results.score, results.isWin);

        // Fill modal fields
        const gradeBadge = document.getElementById('results-grade-badge');
        gradeBadge.textContent = gradeInfo.grade;
        gradeBadge.className = `grade-badge ${gradeInfo.className}`;

        document.getElementById('modal-results-title').textContent = results.isWin ? 'Session Victory!' : 'Session Complete';
        document.getElementById('modal-results-reason').textContent = results.reason;
        document.getElementById('results-final-score').textContent = results.score.toLocaleString();
        document.getElementById('results-mode-badge').textContent = `${results.title} • ${results.difficulty.toUpperCase()}`;

        document.getElementById('results-accuracy').textContent = `${results.accuracy}%`;
        document.getElementById('results-correct').textContent = results.correct;
        document.getElementById('results-incorrect').textContent = results.incorrect;
        document.getElementById('results-streak').textContent = `${results.maxStreak}x`;

        // Dynamic custom stat cells based on mode
        const stat1Label = document.getElementById('results-stat-1-label');
        const stat1Val = document.getElementById('results-stat-1-val');
        const stat2Label = document.getElementById('results-stat-2-label');
        const stat2Val = document.getElementById('results-stat-2-val');

        if (results.mode === 'bubbles') {
            stat1Label.textContent = 'Misses / Lives';
            stat1Val.textContent = `${results.misses} / ${results.maxMisses}`;
            stat2Label.textContent = 'Speed Reached';
            stat2Val.textContent = `Lvl ${results.levelReached}`;
        } else {
            stat1Label.textContent = 'Avg Latency';
            stat1Val.textContent = `${results.avgLatencyMs} ms`;
            stat2Label.textContent = 'Best Reaction';
            stat2Val.textContent = `${results.bestLatencyMs} ms`;
        }

        document.getElementById('results-verdict-text').textContent = gradeInfo.verdict;

        // Show Modal
        this.resultsModal.classList.remove('hidden');
    }

    hideResultsModal() {
        this.resultsModal.classList.add('hidden');
    }

    calculateGrade(accuracy, score, isWin = false) {
        if (accuracy >= 95 && (score >= 120 || isWin)) {
            return {
                grade: 'S',
                className: 'grade-s',
                headline: 'Flawless Mastery!',
                verdict: 'Phenomenal precision and reaction cadence. Top-tier touch-typing mastery achieved!'
            };
        } else if (accuracy >= 85) {
            return {
                grade: 'A',
                className: 'grade-a',
                headline: 'Great Performance!',
                verdict: 'Consistent accuracy with steady finger positioning and minimal errors.'
            };
        } else if (accuracy >= 70) {
            return {
                grade: 'B',
                className: 'grade-b',
                headline: 'Solid Competence!',
                verdict: 'Good foundational rhythm. Practice tricky peripheral keys to reach tier A.'
            };
        } else if (accuracy >= 50) {
            return {
                grade: 'C',
                className: 'grade-c',
                headline: 'Building Muscle Memory',
                verdict: 'Focus on hitting home-row anchors without glancing down at the physical keys.'
            };
        } else {
            return {
                grade: 'D',
                className: 'grade-d',
                headline: 'Drill Needed',
                verdict: 'Try the Easy difficulty preset to synchronize hand posture and build confidence.'
            };
        }
    }

    setStatusMessage(text) {
        if (this.arenaStatusText) {
            this.arenaStatusText.textContent = text;
        }
    }

    updateDashboardMetrics() {
        const bestBubblesEl = document.getElementById('best-bubbles-score');
        const bestLatencyEl = document.getElementById('best-reaction-time');
        const bestMagnetEl = document.getElementById('best-magnet-score');
        const overallAccEl = document.getElementById('overall-career-accuracy');

        if (bestBubblesEl) bestBubblesEl.textContent = `${this.records.bubblesBestScore} pts`;
        if (bestMagnetEl) bestMagnetEl.textContent = `${this.records.magnetBestScore} pts`;
        if (bestLatencyEl) {
            bestLatencyEl.textContent = this.records.bestReactionLatency 
                ? `${this.records.bestReactionLatency} ms` 
                : '--- ms';
        }
        if (overallAccEl) {
            const acc = this.records.totalHits > 0 
                ? Math.round((this.records.totalCorrect / this.records.totalHits) * 100) 
                : 0;
            overallAccEl.textContent = this.records.totalHits > 0 ? `${acc}%` : '--- %';
        }
    }
}

// Instantiate on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});

/**
 * Web Audio API Sound Synthesizer
 * Provides crystal-clear procedural sound effects with zero external asset dependencies.
 * Includes automatic audio context unlocking on user interaction (resolving browser autoplay policies).
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 0.85; // Crisp, audible default volume
        this.masterGain = null;
        this.initialized = false;

        // Auto-unlock on first user interaction across the entire window
        this.bindUnlockListeners();
    }

    bindUnlockListeners() {
        const unlock = () => {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    // Audio unlocked
                }).catch(() => {});
            }
        };

        ['pointerdown', 'keydown', 'click', 'touchstart'].forEach(eventType => {
            window.addEventListener(eventType, unlock, { passive: true });
        });
    }

    init() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                try {
                    this.ctx = new AudioContextClass();
                    this.masterGain = this.ctx.createGain();
                    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
                    this.masterGain.connect(this.ctx.destination);
                    this.initialized = true;
                } catch (e) {
                    console.warn('AudioContext initialization error:', e);
                }
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, now);
        }
        return this.muted;
    }

    setMuted(muteState) {
        this.muted = !!muteState;
        if (this.masterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, now);
        }
    }

    getNow() {
        this.init();
        if (!this.ctx) return 0;
        return Math.max(this.ctx.currentTime, 0.001) + 0.01;
    }

    /**
     * Mode A: Pleasant Bubble Pop Sound
     */
    playPop() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.getNow();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Resonant rising sine sweep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * Correct Key Hit: Bright Harmonic Bell Chime
     */
    playCorrect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.getNow();
        // Two-tone bell chord: E5 (659Hz) & A5 (880Hz)
        [659.25, 880.0].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);

            gain.gain.setValueAtTime(0.65, now + idx * 0.04);
            gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.04 + 0.22);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.24);
        });
    }

    /**
     * Incorrect Key Press: Low Warning Buzz
     */
    playError() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.getNow();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.16);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.19);
    }

    /**
     * Boundary Escape / Timeout Miss Sound
     */
    playMiss() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.getNow();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.24);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.27);
    }

    /**
     * Combo Streak Milestone: Ascending Chime Arpeggio
     */
    playStreak() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const baseNow = this.getNow();
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const now = baseNow + i * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.55, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.2);
        });
    }

    /**
     * Victory / Level Up Celebration Fanfare
     */
    playLevelUp() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const baseNow = this.getNow();
        const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        notes.forEach((freq, i) => {
            const now = baseNow + i * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.7, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.28);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.3);
        });
    }

    /**
     * Game Over Defeat Jingle
     */
    playGameOver() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const baseNow = this.getNow();
        const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4
        notes.forEach((freq, i) => {
            const now = baseNow + i * 0.12;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.65, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.32);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.35);
        });
    }

    /**
     * Button Click / Key Tap Sound
     */
    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.getNow();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(450, now + 0.06);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.08);
    }
}

// Global SoundEngine instance
window.soundEngine = new SoundEngine();

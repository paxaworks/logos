// SoundManager - Web Audio API 기반 사운드 시스템
// 나중에 실제 오디오 파일(.mp3)로 교체 가능한 구조

class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.currentBGM = null;
    this.bgmNodes = [];
    this.bgmId = null;
    this.masterGain = null;
    this.bgmGain = null;
    this._lastPlayTime = {};
    this._cooldowns = { land: 150, bounce: 100, walk: 220 };
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.3;
      this.bgmGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopBGM();
    }
  }

  // ============ SFX ============

  play(id) {
    if (!this.soundEnabled) return;
    // 쿨다운 체크
    const now = performance.now();
    const cooldown = this._cooldowns[id] || 0;
    if (cooldown > 0) {
      const last = this._lastPlayTime[id] || 0;
      if (now - last < cooldown) return;
    }
    this._lastPlayTime[id] = now;
    const ctx = this._ensureContext();
    const fn = this._sfx[id];
    if (fn) fn.call(this, ctx);
  }

  _sfx = {
    click(ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    },

    create(ctx) {
      // 상승하는 밝은 톤
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);

      // 하모닉
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(ctx.currentTime + 0.05);
      osc2.stop(ctx.currentTime + 0.25);
    },

    place(ctx) {
      // 부드러운 낙하음
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    },

    start(ctx) {
      // 시작 팡파레
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const t = ctx.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    },

    land(ctx) {
      // 착지 사운드 - 짧은 "탁" 소리
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    },

    walk(ctx) {
      // 가벼운 발소리 - 짧은 "톡톡" 느낌
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      // 약간의 랜덤 피치로 자연스러움 추가
      const pitch = 90 + Math.random() * 30;
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    },

    bounce(ctx) {
      // 통통 튀는 스프링 사운드
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    },

    clear(ctx) {
      // 클리어 축하 멜로디
      const notes = [523, 659, 784, 1047, 1319, 1568]; // C E G C E G
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = ctx.currentTime + i * 0.12;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    },

    fail(ctx) {
      // 실패 하강 사운드
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      // 두 번째 하강
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300, ctx.currentTime + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.5);
    }
  };

  // ============ BGM ============

  playBGM(id) {
    if (!this.musicEnabled) return;
    if (this.bgmId === id) return; // 이미 같은 BGM 재생 중
    this.stopBGM();
    this.bgmId = id;

    const ctx = this._ensureContext();
    const fn = this._bgm[id];
    if (fn) fn.call(this, ctx);
  }

  stopBGM() {
    this.bgmNodes.forEach(node => {
      try { node.stop(); } catch (e) { /* already stopped */ }
    });
    this.bgmNodes = [];
    this.bgmId = null;
  }

  _scheduleNote(ctx, freq, start, duration, type = 'triangle', vol = 0.08) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.setValueAtTime(vol, start + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(start);
    osc.stop(start + duration);
    this.bgmNodes.push(osc);
    return osc;
  }

  _loopBGM(ctx, buildFn, loopDuration) {
    let offset = 0;
    const scheduleLoop = () => {
      if (this.bgmId === null) return;
      const now = ctx.currentTime;
      // 2루프 미리 스케줄
      for (let i = 0; i < 2; i++) {
        const start = now + offset;
        buildFn(ctx, start);
        offset += loopDuration;
      }
    };
    scheduleLoop();
    // 루프 반복
    this._bgmInterval = setInterval(() => {
      if (this.bgmId === null) {
        clearInterval(this._bgmInterval);
        return;
      }
      offset = 0;
      // 기존 노드 정리 후 재스케줄
      this.bgmNodes.forEach(n => { try { n.stop(); } catch(e) {} });
      this.bgmNodes = [];
      scheduleLoop();
    }, loopDuration * 1000 * 1.8);
  }

  _bgm = {
    // 메뉴 - 잔잔한 피아노 느낌
    menu(ctx) {
      const bpm = 80;
      const beat = 60 / bpm;
      const melody = [
        [262, 2], [330, 1], [392, 1], // C4 E4 G4
        [349, 2], [330, 1], [294, 1], // F4 E4 D4
        [262, 2], [247, 1], [262, 1], // C4 B3 C4
        [294, 2], [262, 2],           // D4 C4
      ];
      const loopDuration = melody.reduce((s, [, d]) => s + d, 0) * beat;

      const buildFn = (ctx, startTime) => {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          this._scheduleNote(ctx, freq, t, dur * beat * 0.9, 'triangle', 0.06);
          // 옥타브 낮은 베이스
          this._scheduleNote(ctx, freq / 2, t, dur * beat * 0.9, 'sine', 0.04);
          t += dur * beat;
        });
      };
      this._loopBGM(ctx, buildFn, loopDuration);
    },

    // 월드1 아침 숲 - 밝고 경쾌
    world1(ctx) {
      const bpm = 110;
      const beat = 60 / bpm;
      const melody = [
        [392, 1], [440, 0.5], [494, 0.5], [523, 1], [494, 0.5], [440, 0.5],
        [392, 1], [349, 0.5], [330, 0.5], [294, 1], [330, 1],
        [349, 1], [392, 0.5], [440, 0.5], [392, 1], [349, 0.5], [330, 0.5],
        [294, 1], [262, 0.5], [294, 0.5], [330, 1], [294, 1],
      ];
      const loopDuration = melody.reduce((s, [, d]) => s + d, 0) * beat;

      const buildFn = (ctx, startTime) => {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          this._scheduleNote(ctx, freq, t, dur * beat * 0.85, 'triangle', 0.06);
          this._scheduleNote(ctx, freq / 2, t, dur * beat * 0.85, 'sine', 0.03);
          t += dur * beat;
        });
      };
      this._loopBGM(ctx, buildFn, loopDuration);
    },

    // 월드2 한낮 사막 - 신비로운 아라비안 느낌
    world2(ctx) {
      const bpm = 90;
      const beat = 60 / bpm;
      // 하모닉 마이너 스케일
      const melody = [
        [330, 1], [349, 0.5], [415, 0.5], [440, 1], [415, 0.5], [349, 0.5],
        [330, 1.5], [294, 0.5], [330, 1], [294, 1],
        [262, 1], [294, 0.5], [349, 0.5], [330, 1.5], [294, 0.5],
        [262, 1], [247, 0.5], [262, 0.5], [294, 1], [262, 1],
      ];
      const loopDuration = melody.reduce((s, [, d]) => s + d, 0) * beat;

      const buildFn = (ctx, startTime) => {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          this._scheduleNote(ctx, freq, t, dur * beat * 0.9, 'sine', 0.06);
          // 5도 하모니
          this._scheduleNote(ctx, freq * 1.5, t + 0.02, dur * beat * 0.5, 'sine', 0.02);
          t += dur * beat;
        });
      };
      this._loopBGM(ctx, buildFn, loopDuration);
    },

    // 월드3 저녁 산 - 차분하고 웅장
    world3(ctx) {
      const bpm = 72;
      const beat = 60 / bpm;
      const melody = [
        [220, 2], [262, 1], [294, 1], // A3 C4 D4
        [330, 2], [294, 1], [262, 1], // E4 D4 C4
        [247, 2], [262, 1], [294, 1], // B3 C4 D4
        [262, 2], [220, 2],           // C4 A3
        [196, 2], [220, 1], [262, 1], // G3 A3 C4
        [247, 2], [220, 2],           // B3 A3
      ];
      const loopDuration = melody.reduce((s, [, d]) => s + d, 0) * beat;

      const buildFn = (ctx, startTime) => {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          this._scheduleNote(ctx, freq, t, dur * beat * 0.9, 'triangle', 0.06);
          // 풍성한 패드 느낌
          this._scheduleNote(ctx, freq * 2, t, dur * beat * 0.9, 'sine', 0.02);
          this._scheduleNote(ctx, freq / 2, t, dur * beat * 0.9, 'sine', 0.04);
          t += dur * beat;
        });
      };
      this._loopBGM(ctx, buildFn, loopDuration);
    },

    // 월드4 밤하늘 성 - 어둡고 미스터리
    world4(ctx) {
      const bpm = 65;
      const beat = 60 / bpm;
      const melody = [
        [165, 2], [196, 1], [185, 1],   // E3 G3 F#3
        [175, 2], [165, 1], [147, 1],   // F3 E3 D3
        [156, 2], [165, 1.5], [147, 0.5], // Eb3 E3 D3
        [131, 2], [147, 1], [165, 1],   // C3 D3 E3
        [156, 2], [147, 1], [131, 1],   // Eb3 D3 C3
        [147, 2], [165, 2],             // D3 E3
      ];
      const loopDuration = melody.reduce((s, [, d]) => s + d, 0) * beat;

      const buildFn = (ctx, startTime) => {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          this._scheduleNote(ctx, freq, t, dur * beat * 0.95, 'sine', 0.05);
          // 으스스한 하모닉스
          this._scheduleNote(ctx, freq * 3, t + 0.1, dur * beat * 0.4, 'sine', 0.015);
          this._scheduleNote(ctx, freq * 0.5, t, dur * beat * 0.95, 'triangle', 0.03);
          t += dur * beat;
        });
      };
      this._loopBGM(ctx, buildFn, loopDuration);
    }
  };
}

export const soundManager = new SoundManager();

// All of Emberfall's sound is synthesised with WebAudio — no audio files, nothing to load.
// Short shaped tones for the action and a slow, quiet pad under everything, so the night
// feels held. The context opens on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let padGain = null;
  let padOsc = [];
  let chordIndex = 0;
  let nextChordAt = 0;
  let muted = false;

  const CHORDS = [
    [110.0, 164.81, 261.63], // A minor
    [87.31, 174.61, 261.63], // F
    [98.0, 196.0, 293.66], // G
    [130.81, 196.0, 329.63], // C
  ];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    startPad();
    return true;
  }

  function startPad() {
    padGain = ctx.createGain();
    padGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 640;
    padGain.connect(filter);
    filter.connect(master);
    padOsc = CHORDS[0].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(padGain);
      osc.start();
      return osc;
    });
    padGain.gain.setTargetAtTime(0.045, ctx.currentTime, 2.5);
    nextChordAt = ctx.currentTime + 6;
  }

  /** Advance the pad's slow chord cycle. Called from the game loop; cheap when idle. */
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (ctx.currentTime < nextChordAt) return;
    chordIndex = (chordIndex + 1) % CHORDS.length;
    const chord = CHORDS[chordIndex];
    padOsc.forEach((osc, i) => osc.frequency.setTargetAtTime(chord[i % chord.length], ctx.currentTime, 1.8));
    nextChordAt = ctx.currentTime + 6;
  }

  function tone(freq, seconds, type, gain, slideTo, delay = 0) {
    if (!ctx || muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise(seconds, gain, delay = 0) {
    if (!ctx || muted) return;
    const start = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start(start);
  }

  return {
    ensure,
    tick,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
      return muted;
    },
    shoot() {
      tone(720 + Math.random() * 120, 0.09, 'square', 0.05, 240);
    },
    hit() {
      noise(0.06, 0.1);
    },
    kill() {
      tone(320, 0.16, 'triangle', 0.12, 60);
      noise(0.12, 0.08);
    },
    pickup() {
      tone(880 + Math.random() * 160, 0.08, 'sine', 0.07, 1320);
    },
    hurt() {
      tone(160, 0.22, 'sawtooth', 0.14, 70);
    },
    treeHurt() {
      tone(110, 0.3, 'sawtooth', 0.12, 55);
      noise(0.18, 0.1);
    },
    dash() {
      noise(0.14, 0.06);
      tone(300, 0.14, 'sine', 0.05, 620);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 0.14, 196);
      tone(147, 0.5, 'triangle', 0.1, 147, 0.02);
    },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.09, freq, i * 0.07));
    },
    victory() {
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.1, freq, i * 0.11));
    },
    defeat() {
      [330, 262, 196, 131].forEach((freq, i) => tone(freq, 0.45, 'triangle', 0.11, freq * 0.94, i * 0.16));
    },
  };
}

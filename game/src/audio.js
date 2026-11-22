// Ember Court — sound. Tiny WebAudio bleeps, synthesized at run time, so
// the game needs no audio files at all. A mute toggle lives on the title
// screen's corner; the game is fully playable silent.

export function createSfx() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    play(name) {
      if (muted) return;
      switch (name) {
        case 'click':
          tone(660, 0.06, 'triangle', 0.08);
          break;
        case 'play':
          tone(392, 0.1, 'triangle', 0.1);
          tone(523, 0.12, 'triangle', 0.1, 0.07);
          break;
        case 'attack':
          tone(180, 0.16, 'sawtooth', 0.1);
          tone(90, 0.2, 'square', 0.08, 0.05);
          break;
        case 'damage':
          tone(140, 0.18, 'sawtooth', 0.12);
          break;
        case 'draw':
          tone(880, 0.05, 'sine', 0.06);
          break;
        case 'win':
          [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.12));
          break;
        case 'lose':
          [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, i * 0.15));
          break;
        case 'turn':
          tone(523, 0.08, 'triangle', 0.08);
          break;
        default:
          break;
      }
    },
  };
}

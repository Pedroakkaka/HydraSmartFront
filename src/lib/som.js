/**
 * Sons do painel gerados na hora com a Web Audio API (sem arquivos de áudio).
 * O navegador só libera áudio depois do primeiro clique do usuário na página.
 */

const CHAVE_MUDO = 'hydrasmart_audio_mudo';
let ctx = null;
let tocandoSirene = false;
let mudo = localStorage.getItem(CHAVE_MUDO) === 'true';

function contexto() {
  if (!ctx) {
    const Classe = window.AudioContext || window.webkitAudioContext;
    if (!Classe) return null;
    ctx = new Classe();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const som = {
  estaMudo: () => mudo,

  alternarMudo() {
    mudo = !mudo;
    localStorage.setItem(CHAVE_MUDO, String(mudo));
    return mudo;
  },

  beep(freq = 880, duracao = 0.06) {
    if (mudo) return;
    try {
      const ac = contexto();
      if (!ac) return;
      const osc = ac.createOscillator();
      const ganho = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      ganho.gain.setValueAtTime(0.12, ac.currentTime);
      ganho.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duracao);
      osc.connect(ganho).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duracao);
    } catch {
      // áudio indisponível: ignora
    }
  },

  sirene() {
    if (mudo || tocandoSirene) return;
    try {
      const ac = contexto();
      if (!ac) return;
      tocandoSirene = true;
      const agora = ac.currentTime;
      const osc = ac.createOscillator();
      const ganho = ac.createGain();
      osc.type = 'sawtooth';
      // Três ciclos de sirene bitonal 580 Hz <-> 920 Hz
      for (let i = 0; i < 3; i++) {
        const t = agora + i * 0.4;
        osc.frequency.setValueAtTime(580, t);
        osc.frequency.linearRampToValueAtTime(920, t + 0.18);
        osc.frequency.linearRampToValueAtTime(580, t + 0.36);
      }
      ganho.gain.setValueAtTime(0.2, agora);
      ganho.gain.exponentialRampToValueAtTime(0.01, agora + 1.2);
      osc.connect(ganho).connect(ac.destination);
      osc.start(agora);
      osc.stop(agora + 1.2);
      setTimeout(() => { tocandoSirene = false; }, 1300);
    } catch {
      tocandoSirene = false;
    }
  }
};

/**
 * Maquete urbana 3D e simulação de alagamento (Three.js).
 *
 * Rua com sarjetas, calçadas e prédios, os dois bueiros monitorados ligados por galeria
 * subterrânea, água subindo dentro dos bueiros e lâmina d'água na pista em caso de
 * transbordo. Inclui vista explodida (grelha, caixilho, suporte do sensor, corpo, base).
 *
 * Classe independente do React: o componente cria, atualiza e descarta a cena.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ALTURA_BUEIRO = 3.6;
const PI = Math.PI; // Intensidades ajustadas para o modelo físico de iluminação do Three.js atual

const CAMERAS = {
  todos: { pos: [0, 28, 17], alvo: [0, -1, -2] },
  bueiro_1: { pos: [-6, 5, 2], alvo: [-6, 0, -5.2] },
  bueiro_2: { pos: [6, 5, 2], alvo: [6, 0, -5.2] }
};

export class UrbanScene {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.fatorExplosao = 0;
    this.alvoExplosao = 0;
    this.nivelB1 = 0;
    this.nivelB2 = 0;
    this.metaB1 = 0;
    this.metaB2 = 0;
    this.lamina = 0;
    this.metaLamina = 0;
    this.animacaoCamera = null;
    this.descartado = false;

    const largura = container.clientWidth || 600;
    const altura = container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070c18);
    this.scene.fog = new THREE.FogExp2(0x070c18, 0.022);

    this.camera = new THREE.PerspectiveCamera(45, largura / altura, 0.1, 1000);
    this.camera.position.set(...CAMERAS.todos.pos);
    this.cameraAlvoInicial = CAMERAS.todos.alvo;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(largura, altura);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 60;
    this.controls.target.set(...this.cameraAlvoInicial);

    this._iluminacao();
    this._cenario();
    this.partesB1 = this._bueiro(-6, 0x00d4e5);
    this.partesB2 = this._bueiro(6, 0xf59e0b);

    this.renderer.setAnimationLoop(() => this._quadro());
  }

  _iluminacao() {
    this.scene.add(new THREE.AmbientLight(0x223344, 1.4 * PI));

    const sol = new THREE.DirectionalLight(0xddeeff, 1.6 * PI);
    sol.position.set(14, 25, 12);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.near = 0.5;
    sol.shadow.camera.far = 60;
    this.scene.add(sol);

    const ciano = new THREE.PointLight(0x00d4e5, 1.2 * PI, 20, 1);
    ciano.position.set(-6, 2.5, -3);
    this.scene.add(ciano);

    const ambar = new THREE.PointLight(0xf59e0b, 1.2 * PI, 20, 1);
    ambar.position.set(6, 2.5, -3);
    this.scene.add(ambar);
  }

  _cenario() {
    const g = new THREE.Group();

    const rua = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 12),
      new THREE.MeshStandardMaterial({ color: 0x171c26, roughness: 0.85, metalness: 0.1 })
    );
    rua.rotation.x = -Math.PI / 2;
    rua.receiveShadow = true;
    g.add(rua);

    const matFaixa = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const geoFaixa = new THREE.PlaneGeometry(2.0, 0.2);
    for (let x = -16; x <= 16; x += 3.5) {
      const faixa = new THREE.Mesh(geoFaixa, matFaixa);
      faixa.rotation.x = -Math.PI / 2;
      faixa.position.set(x, 0.005, 0);
      g.add(faixa);
    }

    const geoCalcada = new THREE.BoxGeometry(38, 0.35, 6);
    const matCalcada = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    for (const z of [9, -9]) {
      const calcada = new THREE.Mesh(geoCalcada, matCalcada);
      calcada.position.set(0, 0.175, z);
      calcada.receiveShadow = true;
      g.add(calcada);
    }

    // Prédios com cores fixas (a maquete fica igual a cada carregamento)
    const cores = [0x0f172a, 0x1e293b, 0x1e2638, 0x111827];
    const predios = [
      [-13, 10.5, 6, 8, 4], [-5, 11, 7, 12, 4.5], [4, 10.5, 6.5, 7, 4], [13, 11.2, 5.5, 10, 4],
      [-12, -10.5, 6.5, 9, 4], [-3, -11, 7.5, 6, 4.5], [6, -10.5, 7, 11, 4], [14, -10.8, 5, 8, 4]
    ];
    predios.forEach(([x, z, larg, alt, prof], i) => {
      const predio = new THREE.Mesh(
        new THREE.BoxGeometry(larg, alt, prof),
        new THREE.MeshStandardMaterial({ color: cores[i % cores.length], roughness: 0.65 })
      );
      predio.position.set(x, alt / 2 + 0.35, z);
      predio.castShadow = true;
      predio.receiveShadow = true;

      const janela = new THREE.Mesh(
        new THREE.PlaneGeometry(larg * 0.7, alt * 0.55),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
      );
      janela.position.set(0, 0, z > 0 ? -prof / 2 - 0.02 : prof / 2 + 0.02);
      if (z > 0) janela.rotation.y = Math.PI;
      predio.add(janela);
      g.add(predio);
    });

    // Galeria subterrânea ligando os dois bueiros
    const tubo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 12, 16),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.45, roughness: 0.3 })
    );
    tubo.rotation.z = Math.PI / 2;
    tubo.position.set(0, -2.4, -5.2);
    g.add(tubo);

    // Lâmina d'água na pista (aparece no transbordo)
    this.aguaRua = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 10.4),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0, depthWrite: false })
    );
    this.aguaRua.rotation.x = -Math.PI / 2;
    this.aguaRua.position.y = 0.015;
    g.add(this.aguaRua);

    // Poças nas sarjetas (começam acima de 50%)
    this.pocas = [-6, 6].map((x) => {
      const poca = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0, depthWrite: false })
      );
      poca.rotation.x = -Math.PI / 2;
      poca.position.set(x, 0.012, -4.8);
      g.add(poca);
      return poca;
    });

    this.scene.add(g);
  }

  _bueiro(x, corDestaque) {
    const grupo = new THREE.Group();
    const p = {};
    const larg = 2.0;
    const prof = 2.0;

    p.base = new THREE.Mesh(
      new THREE.BoxGeometry(larg + 0.3, 0.3, prof + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
    );
    p.base.position.y = -ALTURA_BUEIRO - 0.15;
    p.base.receiveShadow = true;
    grupo.add(p.base);

    const geoCorpo = new THREE.BoxGeometry(larg, ALTURA_BUEIRO, prof);
    const corpo = new THREE.Mesh(
      geoCorpo,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, transparent: true, opacity: 0.35 })
    );
    corpo.position.y = -ALTURA_BUEIRO / 2;
    corpo.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geoCorpo),
      new THREE.LineBasicMaterial({ color: corDestaque, transparent: true, opacity: 0.7 })
    ));
    grupo.add(corpo);

    // Coluna d'água: geometria de altura 1, escalada pela altura real e apoiada no fundo
    p.agua = new THREE.Mesh(
      new THREE.BoxGeometry(larg - 0.08, 1, prof - 0.08),
      new THREE.MeshStandardMaterial({ color: 0x00d4e5, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.82 })
    );
    p.agua.scale.y = 0.01;
    p.agua.position.y = -ALTURA_BUEIRO;
    grupo.add(p.agua);

    p.caixilho = new THREE.Mesh(
      new THREE.BoxGeometry(larg + 0.2, 0.15, prof + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
    );
    p.caixilho.position.y = 0.075;
    grupo.add(p.caixilho);

    p.grelha = new THREE.Group();
    p.grelha.add(new THREE.Mesh(
      new THREE.BoxGeometry(larg, 0.08, prof),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
    ));
    const matBarra = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const geoBarra = new THREE.CylinderGeometry(0.025, 0.025, prof - 0.15, 8);
    for (let bx = -0.8; bx <= 0.81; bx += 0.2) {
      const barra = new THREE.Mesh(geoBarra, matBarra);
      barra.rotation.x = Math.PI / 2;
      barra.position.set(bx, 0.02, 0);
      p.grelha.add(barra);
    }
    p.grelha.position.y = 0.16;
    grupo.add(p.grelha);

    p.suporte = new THREE.Group();
    p.suporte.add(new THREE.Mesh(
      new THREE.BoxGeometry(larg - 0.2, 0.06, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
    ));
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
    placa.position.y = -0.05;
    p.suporte.add(placa);
    const geoTransdutor = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 16);
    const matTransdutor = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    for (const tx of [-0.18, 0.18]) {
      const t = new THREE.Mesh(geoTransdutor, matTransdutor);
      t.position.set(tx, -0.15, 0);
      p.suporte.add(t);
    }
    p.suporte.position.y = 0.25;
    grupo.add(p.suporte);

    p.posicoes = { base: p.base.position.y, caixilho: p.caixilho.position.y, grelha: p.grelha.position.y, suporte: p.suporte.position.y };

    grupo.position.set(x, 0.35, -5.2);
    this.scene.add(grupo);
    return p;
  }

  // ---------------- API pública ----------------

  /** @param {{ status: string, bueiro1Nivel: number|null, bueiro2Nivel: number|null, laminaRuaCm: number }} maquete */
  atualizar(maquete) {
    const ativo = maquete && maquete.status !== 'indisponivel';
    this.metaB1 = ativo ? maquete.bueiro1Nivel ?? 0 : 0;
    this.metaB2 = ativo ? maquete.bueiro2Nivel ?? 0 : 0;
    this.metaLamina = ativo ? maquete.laminaRuaCm ?? 0 : 0;
  }

  /** @param {number} fator 0 (montado) a 1 (explodido) */
  definirExplosao(fator) {
    this.alvoExplosao = Math.max(0, Math.min(1, fator));
  }

  /** @param {'todos'|'bueiro_1'|'bueiro_2'} alvo */
  focar(alvo) {
    const cfg = CAMERAS[alvo] ?? CAMERAS.todos;
    this.animacaoCamera = {
      deCamera: this.camera.position.clone(),
      deAlvo: this.controls.target.clone(),
      paraCamera: new THREE.Vector3(...cfg.pos),
      paraAlvo: new THREE.Vector3(...cfg.alvo),
      progresso: 0
    };
  }

  redimensionar() {
    const largura = this.container.clientWidth;
    const altura = this.container.clientHeight;
    if (!largura || !altura) return;
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(largura, altura);
  }

  descartar() {
    this.descartado = true;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => m.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------- Animação ----------------

  _explodir(p, f) {
    p.grelha.position.y = p.posicoes.grelha + f * 3.5;
    p.suporte.position.y = p.posicoes.suporte + f * 2.2;
    p.caixilho.position.y = p.posicoes.caixilho + f * 1.2;
    p.base.position.y = p.posicoes.base - f * 1.5;
  }

  _agua(p, atual, meta) {
    const novo = atual + (meta - atual) * 0.08;
    const altura = Math.max(0.01, Math.min(1, novo / 100)) * ALTURA_BUEIRO;
    p.agua.scale.y = altura;
    p.agua.position.y = -ALTURA_BUEIRO + altura / 2;
    p.agua.material.color.setHex(novo >= 80 ? 0xf43f5e : novo >= 50 ? 0xfbbf24 : 0x00d4e5);
    return novo;
  }

  _quadro() {
    if (this.descartado) return;

    this.fatorExplosao += (this.alvoExplosao - this.fatorExplosao) * 0.1;
    this._explodir(this.partesB1, this.fatorExplosao);
    this._explodir(this.partesB2, this.fatorExplosao);

    this.nivelB1 = this._agua(this.partesB1, this.nivelB1, this.metaB1);
    this.nivelB2 = this._agua(this.partesB2, this.nivelB2, this.metaB2);

    this.lamina += (this.metaLamina - this.lamina) * 0.06;
    const maior = Math.max(this.nivelB1, this.nivelB2);
    const opacidadePoca = maior >= 50 ? Math.min(0.85, (maior - 50) / 40) : 0;
    this.pocas.forEach((poca) => { poca.material.opacity = opacidadePoca; });

    if (this.lamina > 0.1 || maior > 80) {
      const frac = Math.min(1, this.lamina / 25); // 25 cm = cota máxima de transbordo
      this.aguaRua.material.opacity = Math.min(0.88, 0.35 + frac * 0.5);
      this.aguaRua.position.y = 0.015 + frac * 0.25;
    } else {
      this.aguaRua.material.opacity = 0;
      this.aguaRua.position.y = 0.015;
    }

    const anim = this.animacaoCamera;
    if (anim) {
      anim.progresso = Math.min(1, anim.progresso + 0.06);
      this.camera.position.lerpVectors(anim.deCamera, anim.paraCamera, anim.progresso);
      this.controls.target.lerpVectors(anim.deAlvo, anim.paraAlvo, anim.progresso);
      if (anim.progresso >= 1) this.animacaoCamera = null;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

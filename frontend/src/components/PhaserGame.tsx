import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Phaser from "phaser";
import type { MovementData } from "../api";

export interface PhaserGameHandle {
  seekTo: (step: number) => void;
  focusPersona?: (name: string) => void;
}

interface Props {
  mode: "simulate" | "demo";
  simCode: string;
  step: number;
  personaInitPos: Record<string, [number, number]>;
  allMovement?: Record<string, any>;
  playSpeed?: number;
  isPlaying?: boolean;
  onTimeUpdate?: (time: string) => void;
  onPersonaUpdate?: (name: string, data: any) => void;
  onStepChange?: (step: number) => void;
  onWaitingForMovement?: (step: number | null) => void;
  sendEnvironment?: (step: number, env: Record<string, { maze: string; x: number; y: number }>) => Promise<void>;
  fetchMovement?: (step: number) => Promise<MovementData>;
}

const TILE = 32;
const SPEED = 32;
const CAMERA_MIN_ZOOM = 0.18;
const CAMERA_MAX_ZOOM = 1.4;
const CAMERA_PADDING = 520;
const MIN_FOCUS_WIDTH = 980;
const MIN_FOCUS_HEIGHT = 640;
const AGENT_COLORS = ["#f7b267", "#70c1b3", "#b388eb", "#f25f5c", "#9bc53d"];

interface CameraApi {
  focus: () => void;
  overview: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface PersonaBubble {
  container: Phaser.GameObjects.Container;
  update: (initials: string, pronunciatio?: string) => void;
  setPosition: (x: number, y: number) => void;
  destroy: () => void;
}

function createPersonaBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  badgeColorHex: number,
): PersonaBubble {
  const container = scene.add.container(x, y).setDepth(4);
  const bgGraphics = scene.add.graphics();
  const badgeGraphics = scene.add.graphics();

  const badgeText = scene.add.text(0, 0, "", {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: "12px",
    fontStyle: "bold",
    color: "#ffffff",
  }).setOrigin(0.5, 0.5);

  const emojiText = scene.add.text(0, 0, "", {
    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    fontSize: "16px",
    color: "#0f172a",
  }).setOrigin(0.5, 0.5);

  container.add([bgGraphics, badgeGraphics, badgeText, emojiText]);

  const update = (initials: string, pronunciatio?: string) => {
    const cleanEmoji = (pronunciatio || "").trim();
    badgeText.setText(initials);
    emojiText.setText(cleanEmoji);

    const badgeW = Math.max(20, badgeText.width + 8);
    const badgeH = 18;
    const hasEmoji = Boolean(cleanEmoji);
    const emojiW = hasEmoji ? Math.max(18, emojiText.width) : 0;
    const emojiH = hasEmoji ? Math.max(18, emojiText.height) : 0;

    const padX = 6;
    const spacing = hasEmoji ? 5 : 0;
    const innerW = badgeW + spacing + emojiW;
    const bubbleW = Math.max(32, innerW + padX * 2);
    const bubbleH = Math.max(26, Math.max(badgeH, emojiH) + 6);
    const radius = 8;
    const tailH = 5;
    const tailW = 8;

    const leftX = -bubbleW / 2;
    const topY = -bubbleH - tailH;
    const bottomY = -tailH;

    bgGraphics.clear();
    badgeGraphics.clear();

    // 1. Soft ambient shadow
    bgGraphics.fillStyle(0x0f172a, 0.14);
    bgGraphics.fillRoundedRect(leftX, topY + 2, bubbleW, bubbleH, radius);

    // 2. Main balloon background
    bgGraphics.fillStyle(0xffffff, 0.98);
    bgGraphics.fillRoundedRect(leftX, topY, bubbleW, bubbleH, radius);

    // 3. Pointer tail triangle pointing down to (0, 0)
    bgGraphics.fillTriangle(-tailW / 2, bottomY, tailW / 2, bottomY, 0, 0);

    // 4. Subtle clean outline
    bgGraphics.lineStyle(1.5, 0xe2e8f0, 1.0);
    bgGraphics.strokeRoundedRect(leftX, topY, bubbleW, bubbleH, radius);
    bgGraphics.strokeTriangle(-tailW / 2, bottomY, tailW / 2, bottomY, 0, 0);

    // 5. Seamless fill over the tail-to-rect seam
    bgGraphics.fillStyle(0xffffff, 1.0);
    bgGraphics.fillRect(-tailW / 2 + 1, bottomY - 1.5, tailW - 2, 2.5);

    // 6. Colored initial badge pill
    const badgeX = leftX + padX;
    const badgeY = topY + (bubbleH - badgeH) / 2;
    badgeGraphics.fillStyle(badgeColorHex, 1.0);
    badgeGraphics.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 4);

    // 7. Center badge text
    badgeText.setPosition(badgeX + badgeW / 2, badgeY + badgeH / 2);

    // 8. Position emoji text
    if (hasEmoji) {
      const emojiCenterX = badgeX + badgeW + spacing + emojiW / 2;
      const emojiCenterY = topY + bubbleH / 2;
      emojiText.setPosition(emojiCenterX, emojiCenterY);
      emojiText.setVisible(true);
    } else {
      emojiText.setVisible(false);
    }
  };

  const setPosition = (newX: number, newY: number) => {
    container.setPosition(newX, newY);
  };

  const destroy = () => {
    container.destroy(true);
  };

  return {
    container,
    update,
    setPosition,
    destroy,
  };
}

const PhaserGame = forwardRef<PhaserGameHandle, Props>(function PhaserGame(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const cameraApiRef = useRef<CameraApi | null>(null);
  const sceneApiRef = useRef<{
    seekTo: (targetStep: number) => void;
    focusPersona: (personaName: string) => void;
  } | null>(null);
  const playbackRef = useRef({ isPlaying: props.isPlaying ?? true });
  const speedRef = useRef(props.playSpeed ?? 2);

  useEffect(() => {
    playbackRef.current.isPlaying = props.isPlaying ?? true;
  }, [props.isPlaying]);

  useEffect(() => {
    speedRef.current = props.playSpeed ?? 2;
  }, [props.playSpeed]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (targetStep: number) => {
        sceneApiRef.current?.seekTo(targetStep);
      },
      focusPersona: (personaName: string) => {
        sceneApiRef.current?.focusPersona(personaName);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const {
      mode, personaInitPos,
      allMovement, playSpeed = 2,
      onTimeUpdate, onPersonaUpdate, onStepChange, onWaitingForMovement,
      sendEnvironment, fetchMovement,
    } = props;

    let step = props.step;
    let phase: "process" | "update" | "execute" | "idle" = mode === "simulate" ? "update" : "execute";
    let timer = 0;
    const timerMax = mode === "simulate" ? 12 : 0;
    const demoSteps = allMovement
      ? Object.keys(allMovement).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
      : [];
    if (mode === "demo" && demoSteps.length > 0 && !allMovement?.[String(step)]) {
      step = demoSteps[0];
    }
    let executeMovement: any = allMovement ? allMovement[String(step)] : null;
    const moveSpeed = mode === "demo" ? playSpeed : SPEED;
    let executeCountMax = Math.max(1, Math.round(TILE / (moveSpeed || 2)));
    let executeCount = executeCountMax;
    const movementTarget: Record<string, [number, number]> = {};
    const preDir: Record<string, string> = {};

    const personaSprites: Record<string, Phaser.GameObjects.Sprite> = {};
    const personaBubbles: Record<string, PersonaBubble> = {};
    const personaMarkers: Record<string, Phaser.GameObjects.Ellipse> = {};
    let userAdjustedCamera = false;
    let focusPersonas: (duration?: number) => void = () => {};
    let applyStepData: (stepData: any) => boolean = () => false;

    const getInitials = (name: string) => {
      const rgx = /(\p{L}{1})\p{L}+/gu;
      const initials = [...name.matchAll(rgx)];
      return ((initials.shift()?.[1] || "") + (initials.pop()?.[1] || "")).toUpperCase();
    };

    const tileToStandingPoint = (tile: [number, number]) => ({
      x: tile[0] * TILE + TILE / 2,
      y: tile[1] * TILE + TILE - 2,
    });

    const syncPersonaOverlay = (name: string) => {
      const sprite = personaSprites[name];
      const bubble = personaBubbles[name];
      const marker = personaMarkers[name];
      if (!sprite || !bubble || !marker) return;

      marker.setPosition(sprite.x, sprite.y - 2);
      bubble.setPosition(sprite.x, sprite.y - 56);
    };

    const clampZoom = (zoom: number) =>
      Phaser.Math.Clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);

    const getPersonaBounds = () => {
      const sprites = Object.values(personaSprites);
      if (sprites.length > 0) {
        const xs = sprites.map((s) => s.x);
        const ys = sprites.map((s) => s.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: Math.max(maxX - minX + CAMERA_PADDING, MIN_FOCUS_WIDTH),
          height: Math.max(maxY - minY + CAMERA_PADDING, MIN_FOCUS_HEIGHT),
        };
      }

      const positions = Object.values(personaInitPos);
      if (!positions.length) {
        return { centerX: 800, centerY: 288, width: MIN_FOCUS_WIDTH, height: MIN_FOCUS_HEIGHT };
      }

      const xs = positions.map((pos) => pos[0] * TILE + TILE / 2);
      const ys = positions.map((pos) => pos[1] * TILE + TILE - 2);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        width: Math.max(maxX - minX + CAMERA_PADDING, MIN_FOCUS_WIDTH),
        height: Math.max(maxY - minY + CAMERA_PADDING, MIN_FOCUS_HEIGHT),
      };
    };

    function preload(this: Phaser.Scene) {
      const isExpanded = props.simCode.includes("expanded") || (props as any).maze === "the_ville_expanded";
      const assetBase = isExpanded
        ? "/static/assets/the_ville_expanded"
        : "/static/assets/the_ville";
      const mapJsonUrl = isExpanded
        ? `${assetBase}/visuals/the_ville_expanded.json`
        : `${assetBase}/visuals/the_ville_jan7.json`;

      this.load.image("blocks_1", `${assetBase}/visuals/map_assets/blocks/blocks_1.png`);
      this.load.image("blocks_2", `${assetBase}/visuals/map_assets/blocks/blocks_2.png`);
      this.load.image("blocks_3", `${assetBase}/visuals/map_assets/blocks/blocks_3.png`);
      this.load.image("walls", `${assetBase}/visuals/map_assets/v1/Room_Builder_32x32.png`);
      this.load.image("interiors_pt1", `${assetBase}/visuals/map_assets/v1/interiors_pt1.png`);
      this.load.image("interiors_pt2", `${assetBase}/visuals/map_assets/v1/interiors_pt2.png`);
      this.load.image("interiors_pt3", `${assetBase}/visuals/map_assets/v1/interiors_pt3.png`);
      this.load.image("interiors_pt4", `${assetBase}/visuals/map_assets/v1/interiors_pt4.png`);
      this.load.image("interiors_pt5", `${assetBase}/visuals/map_assets/v1/interiors_pt5.png`);
      this.load.image("CuteRPG_Field_B", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png`);
      this.load.image("CuteRPG_Field_C", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png`);
      this.load.image("CuteRPG_Harbor_C", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png`);
      this.load.image("CuteRPG_Village_B", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png`);
      this.load.image("CuteRPG_Forest_B", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png`);
      this.load.image("CuteRPG_Desert_C", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png`);
      this.load.image("CuteRPG_Mountains_B", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png`);
      this.load.image("CuteRPG_Desert_B", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png`);
      this.load.image("CuteRPG_Forest_C", `${assetBase}/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png`);
      this.load.tilemapTiledJSON("map", mapJsonUrl);
      this.load.atlas("atlas", "/static/img/atlas/atlas.png", "/static/img/atlas/atlas.json");
    }

    function create(this: Phaser.Scene) {
      const map = this.make.tilemap({ key: "map" });
      const collisions = map.addTilesetImage("blocks", "blocks_1")!;
      const walls = map.addTilesetImage("Room_Builder_32x32", "walls")!;
      const ip1 = map.addTilesetImage("interiors_pt1", "interiors_pt1")!;
      const ip2 = map.addTilesetImage("interiors_pt2", "interiors_pt2")!;
      const ip3 = map.addTilesetImage("interiors_pt3", "interiors_pt3")!;
      const ip4 = map.addTilesetImage("interiors_pt4", "interiors_pt4")!;
      const ip5 = map.addTilesetImage("interiors_pt5", "interiors_pt5")!;
      const fB = map.addTilesetImage("CuteRPG_Field_B", "CuteRPG_Field_B")!;
      const fC = map.addTilesetImage("CuteRPG_Field_C", "CuteRPG_Field_C")!;
      const hC = map.addTilesetImage("CuteRPG_Harbor_C", "CuteRPG_Harbor_C")!;
      const vB = map.addTilesetImage("CuteRPG_Village_B", "CuteRPG_Village_B")!;
      const foB = map.addTilesetImage("CuteRPG_Forest_B", "CuteRPG_Forest_B")!;
      const dC = map.addTilesetImage("CuteRPG_Desert_C", "CuteRPG_Desert_C")!;
      const mB = map.addTilesetImage("CuteRPG_Mountains_B", "CuteRPG_Mountains_B")!;
      const dB = map.addTilesetImage("CuteRPG_Desert_B", "CuteRPG_Desert_B")!;
      const foC = map.addTilesetImage("CuteRPG_Forest_C", "CuteRPG_Forest_C")!;

      const ts: Phaser.Tilemaps.Tileset[] = [fB, fC, hC, vB, foB, dC, mB, dB, foC, ip1, ip2, ip3, ip4, ip5, walls];

      const createLayer = (name: string, tilesets: Phaser.Tilemaps.Tileset[]) => {
        const matched = map.layers.find((l) => l.name.trim() === name.trim());
        return map.createLayer(matched ? matched.name : name, tilesets, 0, 0);
      };

      createLayer("Bottom Ground", ts);
      createLayer("Exterior Ground", ts);
      createLayer("Exterior Decoration L1", ts);
      createLayer("Exterior Decoration L2", ts);
      createLayer("Interior Ground", ts);
      createLayer("Wall", [fC, walls]);
      createLayer("Interior Furniture L1", ts);
      createLayer("Interior Furniture L2", ts);
      const fg1 = createLayer("Foreground L1", ts);
      const fg2 = createLayer("Foreground L2", ts);
      fg1?.setDepth(2);
      fg2?.setDepth(2);

      const collLayer = map.createLayer("Collisions", collisions, 0, 0);
      collLayer?.setCollisionByProperty({ collide: true });
      collLayer?.setDepth(-1);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, map.widthInPixels!, map.heightInPixels!);
      const cursors = this.input.keyboard!.createCursorKeys();
      userAdjustedCamera = false;

      const zoomForRect = (width: number, height: number) =>
        clampZoom(Math.min(cam.width / width, cam.height / height));

      focusPersonas = (duration = 0) => {
        const bounds = getPersonaBounds();
        const nextZoom = zoomForRect(bounds.width, bounds.height);
        if (duration > 0) {
          cam.zoomTo(nextZoom, duration);
          cam.pan(bounds.centerX, bounds.centerY, duration);
        } else {
          cam.setZoom(nextZoom);
          cam.centerOn(bounds.centerX, bounds.centerY);
        }
      };

      const showOverview = (duration = 0) => {
        const nextZoom = zoomForRect(map.widthInPixels!, map.heightInPixels!);
        const centerX = map.widthInPixels! / 2;
        const centerY = map.heightInPixels! / 2;
        if (duration > 0) {
          cam.zoomTo(nextZoom, duration);
          cam.pan(centerX, centerY, duration);
        } else {
          cam.setZoom(nextZoom);
          cam.centerOn(centerX, centerY);
        }
      };

      focusPersonas();

      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let cameraStartX = 0;
      let cameraStartY = 0;

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        userAdjustedCamera = true;
        isDragging = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        cameraStartX = cam.scrollX;
        cameraStartY = cam.scrollY;
      });

      this.input.on("pointerup", () => { isDragging = false; });
      this.input.on("pointerout", () => { isDragging = false; });
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (!isDragging) return;
        cam.scrollX = cameraStartX - (pointer.x - dragStartX) / cam.zoom;
        cam.scrollY = cameraStartY - (pointer.y - dragStartY) / cam.zoom;
      });

      this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number, _deltaZ: number, event: WheelEvent) => {
        event?.preventDefault();
        userAdjustedCamera = true;
        const nextZoom = clampZoom(cam.zoom + (deltaY > 0 ? -0.08 : 0.08));
        cam.zoomTo(nextZoom, 90);
      });

      (this as any)._cursors = cursors;

      for (const [index, name] of Object.keys(personaInitPos).entries()) {
        const pos = personaInitPos[name];
        const { x: sx, y: sy } = tileToStandingPoint(pos);
        const markerColor = Phaser.Display.Color.HexStringToColor(AGENT_COLORS[index % AGENT_COLORS.length]).color;
        personaMarkers[name] = this.add.ellipse(sx, sy - 2, 34, 16, markerColor, 0.78)
          .setStrokeStyle(3, 0xffffff, 0.95)
          .setDepth(2.8);
        const sprite = this.add.sprite(sx, sy, "atlas", "misa-front")
          .setOrigin(0.5, 1.0)
          .setScale(1.28)
          .setDepth(3);
        personaSprites[name] = sprite;
        const bubble = createPersonaBubble(this, sx, sy - 56, markerColor);
        bubble.update(getInitials(name));
        personaBubbles[name] = bubble;
        movementTarget[name] = [sx, sy];
      }

      const anims = this.anims;
      anims.create({ key: "misa-left-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-left-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-right-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-right-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-front-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-front-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-back-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-back-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });

      applyStepData = (stepData: any) => {
        if (!stepData) return false;

        if (stepData.meta?.curr_time) {
          onTimeUpdate?.(stepData.meta.curr_time);
        }

        let anyNeedsMove = false;
        const currentNames = Object.keys(personaSprites);
        if (stepData.persona) {
          for (const name of currentNames) {
            const pd = stepData.persona[name] ?? stepData.persona[name.replace(/_/g, " ")];
            if (!pd || !pd.movement) continue;
            const target = tileToStandingPoint(pd.movement);
            movementTarget[name] = [target.x, target.y];
            const ini = getInitials(name);
            personaBubbles[name]?.update(ini, pd.pronunciatio);
            onPersonaUpdate?.(name, pd);

            const s = personaSprites[name];
            if (s && (Math.abs(s.x - target.x) > 1 || Math.abs(s.y - target.y) > 1)) {
              anyNeedsMove = true;
            }
          }
        }
        return anyNeedsMove;
      };

      if (executeMovement) {
        applyStepData(executeMovement);
      }

      cameraApiRef.current = {
        focus: () => {
          userAdjustedCamera = false;
          focusPersonas(180);
        },
        overview: () => {
          userAdjustedCamera = true;
          showOverview(220);
        },
        zoomIn: () => {
          userAdjustedCamera = true;
          cam.zoomTo(clampZoom(cam.zoom + 0.12), 120);
        },
        zoomOut: () => {
          userAdjustedCamera = true;
          cam.zoomTo(clampZoom(cam.zoom - 0.12), 120);
        },
      };

      sceneApiRef.current = {
        seekTo: (targetStep: number) => {
          const targetMovement = allMovement?.[String(targetStep)];
          if (!targetMovement) return;

          step = targetStep;
          executeMovement = targetMovement;
          applyStepData(executeMovement);

          const currentNames = Object.keys(personaSprites);
          for (const name of currentNames) {
            const tgt = movementTarget[name];
            const s = personaSprites[name];
            if (tgt && s) {
              s.setPosition(tgt[0], tgt[1]);
              s.anims.stop();
              const pdDir = preDir[name] || "d";
              s.setTexture("atlas", pdDir === "l" ? "misa-left" : pdDir === "r" ? "misa-right" : pdDir === "u" ? "misa-back" : "misa-front");
              syncPersonaOverlay(name);
            }
          }
          executeCount = 0;

          if (!userAdjustedCamera) {
            focusPersonas(180);
          }

          if (mode === "demo") {
            const hasNext = demoSteps.some((candidate) => candidate > targetStep);
            phase = hasNext ? "execute" : "idle";
          }
        },
        focusPersona: (personaName: string) => {
          const sprite = personaSprites[personaName] ?? personaSprites[personaName.replace(/_/g, " ")];
          if (sprite) {
            userAdjustedCamera = false;
            cam.pan(sprite.x, sprite.y, 250);
          }
        },
      };

      this.scale.on(Phaser.Scale.Events.RESIZE, () => {
        cam.setBounds(0, 0, map.widthInPixels!, map.heightInPixels!);
        if (!userAdjustedCamera) focusPersonas();
      });
    }

    function update(this: Phaser.Scene) {
      const cursors = (this as any)._cursors as Phaser.Types.Input.Keyboard.CursorKeys;
      const cam = this.cameras.main;
      const camSpeed = 9 / cam.zoom;
      if (cursors.left.isDown) cam.scrollX -= camSpeed;
      if (cursors.right.isDown) cam.scrollX += camSpeed;
      if (cursors.up.isDown) cam.scrollY -= camSpeed;
      if (cursors.down.isDown) cam.scrollY += camSpeed;

      if (mode === "demo" && !playbackRef.current.isPlaying) return;

      const names = Object.keys(personaSprites);
      const currentSpeed = mode === "demo" ? Math.max(0.25, speedRef.current || 2) : SPEED;
      const moveSpeed = currentSpeed;

      if (phase === "process") {
        const env: Record<string, { maze: string; x: number; y: number }> = {};
        for (const n of names) {
          const s = personaSprites[n];
          env[n] = {
            maze: "the_ville",
            x: Math.round((s.x - TILE / 2) / TILE),
            y: Math.round((s.y - (TILE - 2)) / TILE),
          };
        }
        sendEnvironment?.(step, env).then(() => { phase = "update"; });
      } else if (phase === "update") {
        if (timer <= 0) {
          fetchMovement?.(step).then((data) => {
            if (data["<step>"] === step) {
              executeMovement = data;
              applyStepData(executeMovement);
              executeCountMax = Math.max(1, Math.round(TILE / currentSpeed));
              executeCount = executeCountMax;
              phase = "execute";
              onWaitingForMovement?.(null);
            } else {
              onWaitingForMovement?.(step);
            }
          });
          timer = timerMax;
        }
        timer--;
      } else if (phase === "execute") {
        if (executeCount > 0) {
          let anyStillMoving = false;
          for (const name of names) {
            const s = personaSprites[name];
            const tgt = movementTarget[name];
            if (!tgt || !s) continue;

            const dx = tgt[0] - s.x;
            const dy = tgt[1] - s.y;
            let dir = "";

            if (Math.abs(dx) <= moveSpeed) {
              s.x = tgt[0];
            } else {
              s.x += Math.sign(dx) * moveSpeed;
              dir = dx > 0 ? "r" : "l";
            }

            if (Math.abs(dy) <= moveSpeed) {
              s.y = tgt[1];
            } else {
              s.y += Math.sign(dy) * moveSpeed;
              if (!dir) dir = dy > 0 ? "d" : "u";
            }

            syncPersonaOverlay(name);

            if (s.x !== tgt[0] || s.y !== tgt[1]) {
              anyStillMoving = true;
            }

            if (dir) preDir[name] = dir;
            if (dir === "l") s.anims.play("misa-left-walk", true);
            else if (dir === "r") s.anims.play("misa-right-walk", true);
            else if (dir === "u") s.anims.play("misa-back-walk", true);
            else if (dir === "d") s.anims.play("misa-front-walk", true);
            else {
              s.anims.stop();
              const pd = preDir[name] || "d";
              s.setTexture("atlas", pd === "l" ? "misa-left" : pd === "r" ? "misa-right" : pd === "u" ? "misa-back" : "misa-front");
            }
          }

          if (!anyStillMoving) {
            executeCount = 0;
          } else {
            executeCount--;
          }
        } else {
          // Snap all to exact target and stop animations
          for (const name of names) {
            const tgt = movementTarget[name];
            const s = personaSprites[name];
            if (tgt && s) {
              s.setPosition(tgt[0], tgt[1]);
              s.anims.stop();
              const pd = preDir[name] || "d";
              s.setTexture("atlas", pd === "l" ? "misa-left" : pd === "r" ? "misa-right" : pd === "u" ? "misa-back" : "misa-front");
              syncPersonaOverlay(name);
            }
          }

          if (mode === "demo") {
            const nextStep = demoSteps.find((candidate) => candidate > step);
            const nextMovement = nextStep === undefined ? null : allMovement?.[String(nextStep)];
            if (nextStep !== undefined && nextMovement) {
              step = nextStep;
              onStepChange?.(step);
              executeMovement = nextMovement;
              const needsMove = applyStepData(executeMovement);
              executeCountMax = needsMove
                ? Math.max(1, Math.round(TILE / currentSpeed))
                : Math.max(2, Math.round(10 / currentSpeed));
              executeCount = executeCountMax;
              if (!userAdjustedCamera) {
                focusPersonas(180);
              }
            } else {
              phase = "idle";
              executeCount = 0;
            }
          } else {
            step++;
            onStepChange?.(step);
            phase = "process";
            executeCount = executeCountMax + 1;
            onWaitingForMovement?.(null);
          }
        }
      } else if (phase === "idle" && mode === "demo") {
        let nextStep = demoSteps.find((candidate) => candidate > step);
        let nextMovement = nextStep === undefined ? null : allMovement?.[String(nextStep)];
        if (nextStep === undefined && demoSteps.length > 0) {
          nextStep = demoSteps[0];
          nextMovement = nextStep === undefined ? null : allMovement?.[String(nextStep)];
        }
        if (nextStep !== undefined && nextMovement) {
          step = nextStep;
          onStepChange?.(step);
          executeMovement = nextMovement;
          const needsMove = applyStepData(executeMovement);
          executeCountMax = needsMove
            ? Math.max(1, Math.round(TILE / currentSpeed))
            : Math.max(2, Math.round(10 / currentSpeed));
          executeCount = executeCountMax;
          phase = "execute";
          if (!userAdjustedCamera) {
            focusPersonas(180);
          }
        }
      }
    }

    const rect = containerRef.current.getBoundingClientRect();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: Math.max(320, Math.floor(rect.width)),
      height: Math.max(420, Math.floor(rect.height)),
      parent: containerRef.current,
      pixelArt: true,
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
      scene: { preload, create, update },
      backgroundColor: "#0f1410",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    return () => {
      sceneApiRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <section className="map-stage">
      <div className="map-toolbar">
        <button type="button" onClick={() => cameraApiRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">
          -
        </button>
        <button type="button" onClick={() => cameraApiRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button type="button" onClick={() => cameraApiRef.current?.overview()} title="Show the whole map">
          Fit
        </button>
        <button type="button" onClick={() => cameraApiRef.current?.focus()} title="Focus villagers">
          Villagers
        </button>
      </div>
      <div ref={containerRef} className="map-container" />
    </section>
  );
});

export default PhaserGame;

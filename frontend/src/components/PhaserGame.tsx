import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { MovementData } from "../api";

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

export default function PhaserGame(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const cameraApiRef = useRef<CameraApi | null>(null);
  const playbackRef = useRef({ isPlaying: props.isPlaying ?? true });

  useEffect(() => {
    playbackRef.current.isPlaying = props.isPlaying ?? true;
  }, [props.isPlaying]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const {
      mode, personaInitPos,
      allMovement, playSpeed = 2,
      onTimeUpdate, onPersonaUpdate, onStepChange,
      sendEnvironment, fetchMovement,
    } = props;

    let step = props.step;
    let phase: "process" | "update" | "execute" | "idle" = mode === "simulate" ? "update" : "execute";
    let timer = 0;
    const timerMax = mode === "simulate" ? 12 : 0;
    let executeMovement: any = allMovement ? allMovement[String(props.step)] : null;
    const demoSteps = allMovement
      ? Object.keys(allMovement).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
      : [];
    const moveSpeed = mode === "demo" ? playSpeed : SPEED;
    let executeCountMax = TILE / moveSpeed;
    let executeCount = executeCountMax;
    const movementTarget: Record<string, [number, number]> = {};
    const preDir: Record<string, string> = {};

    const personaSprites: Record<string, Phaser.Types.Physics.Arcade.SpriteWithDynamicBody> = {};
    const personaSleepSprites: Record<string, Phaser.GameObjects.Sprite> = {};
    const personaLabels: Record<string, Phaser.GameObjects.Text> = {};
    const personaMarkers: Record<string, Phaser.GameObjects.Ellipse> = {};
    const personaSleeping: Record<string, boolean> = {};
    let isBedTile = (_x: number, _y: number) => false;

    const getInitials = (name: string) => {
      const rgx = /(\p{L}{1})\p{L}+/gu;
      const initials = [...name.matchAll(rgx)];
      return ((initials.shift()?.[1] || "") + (initials.pop()?.[1] || "")).toUpperCase();
    };

    const tileToBody = (tile: [number, number]) => [tile[0] * TILE, tile[1] * TILE] as [number, number];
    const tileToStandingPoint = (tile: [number, number]) => ({
      x: tile[0] * TILE + TILE / 2,
      y: tile[1] * TILE + TILE,
    });
    const tileToSleepPoint = (tile: [number, number], data?: any) => {
      const description = String(data?.description || "");
      const centeredBedOffset = description.includes(":bed")
        ? (isBedTile(tile[0] - 1, tile[1]) ? -TILE / 2 : isBedTile(tile[0] + 1, tile[1]) ? TILE / 2 : 0)
        : 0;
      return {
        x: tile[0] * TILE + TILE / 2 + centeredBedOffset,
        y: tile[1] * TILE + TILE / 2 + 4,
      };
    };

    const syncPersonaOverlay = (name: string) => {
      const sprite = personaSprites[name];
      const sleepSprite = personaSleepSprites[name];
      const label = personaLabels[name];
      const marker = personaMarkers[name];
      if (!sprite || !label || !marker) return;

      if (personaSleeping[name]) {
        const visual = sleepSprite || sprite;
        label.x = visual.x - 28;
        label.y = visual.y - 40;
        marker.x = visual.x;
        marker.y = visual.y + 6;
      } else {
        label.x = sprite.body.x - 6;
        label.y = sprite.body.y - 74;
        marker.x = sprite.body.x + TILE / 2;
        marker.y = sprite.body.y + TILE - 8;
      }
    };

    const applyPersonaPose = (name: string, data: any) => {
      const sprite = personaSprites[name];
      const sleepSprite = personaSleepSprites[name];
      const marker = personaMarkers[name];
      if (!sprite || !sleepSprite || !marker) return;

      const description = String(data?.description || "").toLowerCase();
      const sleepingOnBed = description.includes("sleeping") && description.includes(":bed");
      personaSleeping[name] = sleepingOnBed;

      if (sleepingOnBed) {
        const tile = (data?.movement || [
          Math.round(sprite.body.x / TILE),
          Math.round(sprite.body.y / TILE),
        ]) as [number, number];
        const sleepPoint = tileToSleepPoint(tile, data);
        sprite.anims.stop();
        sprite.setVisible(false);
        sleepSprite
          .setVisible(true)
          .setTexture("atlas", "misa-right")
          .setAngle(90)
          .setScale(1.05)
          .setDepth(3.5)
          .setPosition(sleepPoint.x, sleepPoint.y);
        marker.setDisplaySize(50, 20).setAlpha(0.22).setDepth(3.1);
      } else {
        sleepSprite.setVisible(false);
        sprite.setVisible(true).setAngle(0).setScale(1.28).setDepth(3);
        marker.setDisplaySize(34, 18).setAlpha(0.78).setDepth(2.8);
      }

      syncPersonaOverlay(name);
    };

    const clampZoom = (zoom: number) =>
      Phaser.Math.Clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);

    const getPersonaBounds = () => {
      const positions = Object.values(personaInitPos);
      if (!positions.length) {
        return { centerX: 800, centerY: 288, width: MIN_FOCUS_WIDTH, height: MIN_FOCUS_HEIGHT };
      }

      const xs = positions.map((pos) => pos[0] * TILE + TILE / 2);
      const ys = positions.map((pos) => pos[1] * TILE + TILE);
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
      this.load.image("blocks_1", "/static/assets/the_ville/visuals/map_assets/blocks/blocks_1.png");
      this.load.image("blocks_2", "/static/assets/the_ville/visuals/map_assets/blocks/blocks_2.png");
      this.load.image("blocks_3", "/static/assets/the_ville/visuals/map_assets/blocks/blocks_3.png");
      this.load.image("walls", "/static/assets/the_ville/visuals/map_assets/v1/Room_Builder_32x32.png");
      this.load.image("interiors_pt1", "/static/assets/the_ville/visuals/map_assets/v1/interiors_pt1.png");
      this.load.image("interiors_pt2", "/static/assets/the_ville/visuals/map_assets/v1/interiors_pt2.png");
      this.load.image("interiors_pt3", "/static/assets/the_ville/visuals/map_assets/v1/interiors_pt3.png");
      this.load.image("interiors_pt4", "/static/assets/the_ville/visuals/map_assets/v1/interiors_pt4.png");
      this.load.image("interiors_pt5", "/static/assets/the_ville/visuals/map_assets/v1/interiors_pt5.png");
      this.load.image("CuteRPG_Field_B", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png");
      this.load.image("CuteRPG_Field_C", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png");
      this.load.image("CuteRPG_Harbor_C", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png");
      this.load.image("CuteRPG_Village_B", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png");
      this.load.image("CuteRPG_Forest_B", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png");
      this.load.image("CuteRPG_Desert_C", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png");
      this.load.image("CuteRPG_Mountains_B", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png");
      this.load.image("CuteRPG_Desert_B", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png");
      this.load.image("CuteRPG_Forest_C", "/static/assets/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png");
      this.load.tilemapTiledJSON("map", "/static/assets/the_ville/visuals/the_ville_jan7.json");
      this.load.atlas("atlas", "/static/img/atlas/atlas.png", "/static/img/atlas/atlas.json");
      this.load.text("game_object_maze", "/static/assets/the_ville/matrix/maze/game_object_maze.csv");
      this.load.text("game_object_blocks", "/static/assets/the_ville/matrix/special_blocks/game_object_blocks.csv");
    }

    function create(this: Phaser.Scene) {
      const map = this.make.tilemap({ key: "map" });
      const objectMaze = String(this.cache.text.get("game_object_maze") || "")
        .split(",")
        .map((cell) => cell.trim());
      const bedIds = new Set(
        String(this.cache.text.get("game_object_blocks") || "")
          .split(/\r?\n/)
          .map((line) => line.split(",").map((cell) => cell.trim()))
          .filter((row) => row[0] && row[row.length - 1] === "bed")
          .map((row) => row[0])
      );
      isBedTile = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        return bedIds.has(objectMaze[y * map.width + x]);
      };
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

      map.createLayer("Bottom Ground", ts, 0, 0);
      map.createLayer("Exterior Ground", ts, 0, 0);
      map.createLayer("Exterior Decoration L1", ts, 0, 0);
      map.createLayer("Exterior Decoration L2", ts, 0, 0);
      map.createLayer("Interior Ground", ts, 0, 0);
      map.createLayer("Wall", [fC, walls], 0, 0);
      map.createLayer("Interior Furniture L1", ts, 0, 0);
      map.createLayer("Interior Furniture L2", ts, 0, 0);
      const fg1 = map.createLayer("Foreground L1", ts, 0, 0);
      const fg2 = map.createLayer("Foreground L2", ts, 0, 0);
      fg1?.setDepth(2);
      fg2?.setDepth(2);

      const collLayer = map.createLayer("Collisions", collisions, 0, 0);
      collLayer?.setCollisionByProperty({ collide: true });
      collLayer?.setDepth(-1);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, map.widthInPixels!, map.heightInPixels!);
      const cursors = this.input.keyboard!.createCursorKeys();
      let userAdjustedCamera = false;

      const zoomForRect = (width: number, height: number) =>
        clampZoom(Math.min(cam.width / width, cam.height / height));

      const focusPersonas = (duration = 0) => {
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
        personaMarkers[name] = this.add.ellipse(sx, sy - 8, 34, 18, markerColor, 0.78)
          .setStrokeStyle(4, 0xffffff, 0.95)
          .setDepth(2.8);
        const sprite = this.physics.add.sprite(sx, sy, "atlas", "misa-front")
          .setSize(30, 40).setOffset(0, 32).setScale(1.28).setDepth(3);
        personaSprites[name] = sprite;
        personaSleepSprites[name] = this.add.sprite(sx, sy, "atlas", "misa-right")
          .setVisible(false)
          .setDepth(3.5);
        personaLabels[name] = this.add.text(sx - 6, sy - 74, "", {
          font: "32px monospace",
          color: "#101712",
          padding: { x: 10, y: 8 },
          backgroundColor: "rgba(255,255,255,0.96)",
        }).setDepth(4).setShadow(0, 2, "#ffffff", 2, true, true);
        personaLabels[name].setText(getInitials(name));
      }

      const anims = this.anims;
      anims.create({ key: "misa-left-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-left-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-right-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-right-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-front-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-front-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });
      anims.create({ key: "misa-back-walk", frames: anims.generateFrameNames("atlas", { prefix: "misa-back-walk.", start: 0, end: 3, zeroPad: 3 }), frameRate: 4, repeat: -1 });

      cameraApiRef.current = {
        focus: () => {
          userAdjustedCamera = true;
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

      if (phase === "process") {
        const env: Record<string, { maze: string; x: number; y: number }> = {};
        for (const n of names) {
          env[n] = { maze: "the_ville", x: Math.ceil(personaSprites[n].body.position.x / TILE), y: Math.ceil(personaSprites[n].body.position.y / TILE) };
        }
        sendEnvironment?.(step, env).then(() => { phase = "update"; });
      } else if (phase === "update") {
        if (timer <= 0) {
          fetchMovement?.(step).then((data) => {
            if (data["<step>"] === step) {
              executeMovement = data;
              executeCount = executeCountMax;
              phase = "execute";
            }
          });
          timer = timerMax;
        }
        timer--;
      } else if (phase === "execute") {
        if (executeMovement?.meta?.curr_time) {
          onTimeUpdate?.(executeMovement.meta.curr_time);
        }

        if (executeCount === executeCountMax && executeMovement?.persona) {
          for (const name of names) {
            const pd = executeMovement.persona[name] ?? executeMovement.persona[name.replace(/_/g, " ")];
            if (!pd) continue;
            movementTarget[name] = tileToBody(pd.movement);
            const ini = getInitials(name);
            const isSleeping = String(pd.description || "").toLowerCase().includes("sleeping") && String(pd.description || "").includes(":bed");
            personaLabels[name].setText(isSleeping ? `${ini} zzz` : ini + ": " + (pd.pronunciatio || ""));
            applyPersonaPose(name, pd);
            onPersonaUpdate?.(name, pd);
          }
        }

        if (executeCount > 0) {
          for (const name of names) {
            const s = personaSprites[name];
            const tgt = movementTarget[name];
            if (!tgt) continue;
            let dir = "";
            if (s.body.x < tgt[0]) { s.body.x += moveSpeed; dir = "r"; }
            else if (s.body.x > tgt[0]) { s.body.x -= moveSpeed; dir = "l"; }
            else if (s.body.y < tgt[1]) { s.body.y += moveSpeed; dir = "d"; }
            else if (s.body.y > tgt[1]) { s.body.y -= moveSpeed; dir = "u"; }

            syncPersonaOverlay(name);

            if (personaSleeping[name]) {
              s.anims.stop();
              continue;
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
        } else {
          for (const name of names) {
            const tgt = movementTarget[name];
            if (tgt) {
              personaSprites[name].body.x = tgt[0];
              personaSprites[name].body.y = tgt[1];
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
              executeCount = executeCountMax;
            } else {
              phase = "idle";
              executeCount = 0;
            }
          } else {
            step++;
            onStepChange?.(step);
            phase = "process";
            executeCount = executeCountMax + 1;
          }
        }

        executeCount--;
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
        <button type="button" onClick={() => cameraApiRef.current?.focus()} title="Center active personas">
          Agents
        </button>
      </div>
      <div ref={containerRef} className="map-container" />
    </section>
  );
}

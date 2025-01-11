// Rivershell v2 by Kye - 2006-2013

import {
  DynamicCheckPointEvent,
  DynamicCheckpoint,
  DynamicObject,
  GameMode,
  GameText,
  InvalidEnum,
  Player,
  PlayerEvent,
  PlayerStateEnum,
  Vehicle,
  VehicleEvent,
} from "@infernus/core";
import {
  ALLOW_RESPAWN_AFTER_N_SECONDS,
  CAPS_TO_WIN,
  OBJECTIVE_COLOR,
  OBJECTIVE_VEHICLE_BLUE,
  OBJECTIVE_VEHICLE_GREEN,
  SPECTATE_MODE_NONE,
  SPECTATE_MODE_PLAYER,
  SPECTATE_MODE_VEHICLE,
  SPECTATE_STATE_FIXED,
  SPECTATE_STATE_NONE,
  SPECTATE_STATE_PLAYER,
  TEAM_BLUE,
  TEAM_BLUE_COLOR,
  TEAM_GREEN,
  TEAM_GREEN_COLOR,
  objects,
  playerClasses,
  removeBuildings,
  vehicles,
} from "./constants";

// Global stuff and defines for our gamemode.

const gTeam = new Map<Player, number>(); // Tracks the team assignment for each player

interface IRiverShellPVar {
  lastDeathTick: number;
  lastKillerId: number;
  lastResupply: number;
  buildingsRemoved: number;
  spectateMode: number;
  spectateState: number;
  checkPoint: DynamicCheckpoint | null;
}

const pVar = new Map<Player, IRiverShellPVar>();

let gObjectiveReached: number; // Stops the winner logic reentering itself.
let gObjectiveGreenPlayer: number; // Tracks which green player has the vehicle.
let gObjectiveBluePlayer: number; // Tracks which blue player has the vehicle.

// number of times the vehicle has been captured by each team
let gGreenTimesCapped: number;
let gBlueTimesCapped: number;

GameMode.onInit(() => {
  gObjectiveReached = 0;
  gObjectiveGreenPlayer = -1;
  gObjectiveBluePlayer = -1;
  gGreenTimesCapped = 0;
  gBlueTimesCapped = 0;

  GameMode.setGameModeText("Rivershell");
  GameMode.showPlayerMarkers(0);
  GameMode.showNameTags(true);
  GameMode.setWorldTime(17);
  GameMode.setWeather(11);
  GameMode.usePlayerPedAnims();
  GameMode.enableVehicleFriendlyFire();
  GameMode.setNameTagDrawDistance(110.0);
  GameMode.disableInteriorEnterExits();

  playerClasses.forEach((pClass) => {
    const [modelId, spawnX, spawnY, spawnZ, zAngle] = pClass;
    GameMode.addPlayerClass(
      modelId,
      spawnX,
      spawnY,
      spawnZ,
      zAngle,
      31,
      100,
      29,
      200,
      34,
      10
    );
  });
  vehicles.forEach((veh) => {
    const [modelId, x, y, z, zAngle, color1, color2] = veh;
    new Vehicle({
      modelId,
      x,
      y,
      z,
      zAngle,
      color: [color1, color2],
      respawnDelay: 100,
    }).create();
  });
  objects.forEach((obj) => {
    const [modelId, x, y, z, rx, ry, rz] = obj;
    createMapObject(modelId, x, y, z, rx, ry, rz);
  });

  console.log("\n----------------------------------");
  console.log("  Rivershell by Kye 2006-2013\n");
  console.log("----------------------------------\n");
});

function setPlayerToTeamColor(player: Player) {
  const pTeam = gTeam.get(player);
  if (pTeam === TEAM_GREEN) {
    player.setColor(TEAM_GREEN_COLOR); // green
  } else if (pTeam === TEAM_BLUE) {
    player.setColor(TEAM_BLUE_COLOR); // blue
  }
}

function setupPlayerForClassSelection(player: Player) {
  // Set the player's orientation when they're selecting a class.
  player.setPos(1984.4445, 157.9501, 55.9384);
  player.setCameraPos(1984.4445, 160.9501, 55.9384);
  player.setCameraLookAt(1984.4445, 157.9501, 55.9384);
  player.setFacingAngle(0.0);
}

function setPlayerTeamFromClass(player: Player, classId: number) {
  // Set their team number based on the class they selected.
  if (classId === 0 || classId === 1) {
    player.setTeam(TEAM_GREEN);
    gTeam.set(player, TEAM_GREEN);
  } else if (classId === 2 || classId === 3) {
    player.setTeam(TEAM_BLUE);
    gTeam.set(player, TEAM_BLUE);
  }
}

function exitTheGameMode() {
  playSoundForAll(1186, 0.0, 0.0, 0.0); // Stops the music
  // console.log("Exiting Game Mode");
  GameMode.sendRconCommand("gmx");
}

PlayerEvent.onStateChange(({ player, newState, next }) => {
  if (player.isNpc()) return next();

  const pVar_ = pVar.get(player)!;

  if (newState === PlayerStateEnum.DRIVER) {
    const vehicle = player.getVehicle()!;

    if (
      gTeam.get(player) === TEAM_GREEN &&
      vehicle.id === OBJECTIVE_VEHICLE_GREEN
    ) {
      // It's the objective vehicle
      player.setColor(OBJECTIVE_COLOR);
      new GameText(
        "~w~Take the ~y~boat ~w~back to the ~r~spawn!",
        3000,
        5
      ).forPlayer(player);

      if (pVar_.checkPoint) {
        pVar_.checkPoint.destroy();
        pVar_.checkPoint = null;
      }
      const cp = new DynamicCheckpoint({
        x: 2135.7368,
        y: -179.8811,
        z: -0.5323,
        size: 10.0,
        playerId: player.id,
      }).create();
      pVar_.checkPoint = cp;
      gObjectiveGreenPlayer = player.id;
    }

    if (
      gTeam.get(player) === TEAM_BLUE &&
      vehicle.id === OBJECTIVE_VEHICLE_BLUE
    ) {
      // It's the objective vehicle
      player.setColor(OBJECTIVE_COLOR);
      new GameText(
        "~w~Take the ~y~boat ~w~back to the ~r~spawn!",
        3000,
        5
      ).forPlayer(player);

      if (pVar_.checkPoint) {
        pVar_.checkPoint.destroy();
        pVar_.checkPoint = null;
      }
      const cp = new DynamicCheckpoint({
        x: 2329.4226,
        y: 532.7426,
        z: 0.5862,
        size: 10.0,
        playerId: player.id,
      }).create();
      pVar_.checkPoint = cp;
      gObjectiveBluePlayer = player.id;
    }
  } else if (newState === PlayerStateEnum.ONFOOT) {
    if (player.id === gObjectiveGreenPlayer) {
      gObjectiveGreenPlayer = -1;
      setPlayerToTeamColor(player);
      if (pVar_.checkPoint) {
        pVar_.checkPoint.destroy();
      }
    }

    if (player.id === gObjectiveBluePlayer) {
      gObjectiveBluePlayer = -1;
      setPlayerToTeamColor(player);
      if (pVar_.checkPoint) {
        pVar_.checkPoint.destroy();
      }
    }
  }

  pVar.set(player, pVar_);
  return next();
});

PlayerEvent.onConnect(({ player, next }) => {
  if (player.isNpc()) return next();
  pVar.set(player, {
    lastDeathTick: 0,
    lastKillerId: -1,
    buildingsRemoved: 0,
    lastResupply: 0,
    spectateMode: SPECTATE_STATE_NONE,
    spectateState: SPECTATE_MODE_NONE,
    checkPoint: null,
  });
  player.setColor(0x888888ff);
  new GameText("~r~SA-MP: ~w~Rivershell", 2000, 3).forPlayer(player);
  removeNeededBuildingsForPlayer(player);
  return next();
});

PlayerEvent.onDisconnect(({ player, next }) => {
  if (player.isNpc()) return next();
  if (pVar.has(player)) {
    pVar.delete(player);
  }
  if (gTeam.has(player)) {
    gTeam.delete(player);
  }
  return next();
});

PlayerEvent.onRequestClass(({ player, classId, next }) => {
  if (player.isNpc()) return next();
  setupPlayerForClassSelection(player);
  setPlayerTeamFromClass(player, classId);

  if (classId === 0 || classId === 1) {
    new GameText("~g~GREEN ~w~TEAM", 1000, 5).forPlayer(player);
  } else if (classId === 2 || classId === 3) {
    new GameText("~b~BLUE ~w~TEAM", 1000, 5).forPlayer(player);
  }

  return next();
});

PlayerEvent.onSpawn(({ player, next }) => {
  if (player.isNpc()) return next();
  // Wait a bit before allowing them to respawn. Switch to spectate mode.
  const pVar_ = pVar.get(player)!;
  if (
    pVar_.lastDeathTick !== 0 &&
    Date.now() - pVar_.lastDeathTick < ALLOW_RESPAWN_AFTER_N_SECONDS * 1000
  ) {
    player.sendClientMessage(0xffaaeeee, "Waiting to respawn....");
    player.toggleSpectating(true);

    // If the last killer id is valid, we should try setting it now to avoid any camera lag switching to spectate.
    const lastKiller = Player.getInstance(pVar_.lastKillerId);
    if (!lastKiller) return next();

    const lastKillerState = lastKiller.getState();

    if (
      lastKillerState === PlayerStateEnum.ONFOOT ||
      lastKillerState === PlayerStateEnum.DRIVER ||
      lastKillerState === PlayerStateEnum.PASSENGER
    ) {
      spectatePlayer(player, lastKiller);
      pVar_.spectateState = SPECTATE_STATE_PLAYER;
      pVar.set(player, pVar_);
    }

    return next();
  }

  setPlayerToTeamColor(player);

  if (gTeam.get(player) === TEAM_GREEN) {
    new GameText(
      "Defend the ~g~GREEN ~w~team's ~y~Reefer~n~~w~Capture the ~b~BLUE ~w~team's ~y~Reefer",
      6000,
      5
    ).forPlayer(player);
  } else if (gTeam.get(player) === TEAM_BLUE) {
    new GameText(
      "Defend the ~b~BLUE ~w~team's ~y~Reefer~n~~w~Capture the ~g~GREEN ~w~team's ~y~Reefer",
      6000,
      5
    ).forPlayer(player);
  }

  player.setHealth(100.0);
  player.setArmour(100.0);
  player.setWorldBounds(2500.0, 1850.0, 631.2963, -454.9898);

  pVar_.spectateState = SPECTATE_STATE_NONE;
  pVar_.spectateMode = SPECTATE_MODE_NONE;
  pVar.set(player, pVar_);
  return next();
});

DynamicCheckPointEvent.onPlayerEnter(({ player, cp, next }) => {
  const pVeh = player.getVehicle();

  if (!pVeh || gObjectiveReached) return next();

  const pVar_ = pVar.get(player)!;
  if (!pVar_.checkPoint || pVar_.checkPoint !== cp) return next();

  pVar_.checkPoint.destroy();
  pVar_.checkPoint = null;

  if (pVeh.id === OBJECTIVE_VEHICLE_GREEN && gTeam.get(player) === TEAM_GREEN) {
    // Green OBJECTIVE REACHED.
    gGreenTimesCapped++;
    player.setScore(player.getScore() + 5);

    if (gGreenTimesCapped == CAPS_TO_WIN) {
      new GameText("~g~GREEN ~w~team wins!", 3000, 5).forAll();
      gObjectiveReached = 1;
      playSoundForAll(1185, 0.0, 0.0, 0.0);
      setTimeout(() => {
        // Set up a timer to exit this mode.
        exitTheGameMode();
      }, 6000);
    } else {
      new GameText("~g~GREEN ~w~team captured the ~y~boat!", 3000, 5).forAll();
      pVeh.setRespawn();
    }
    return next();
  } else if (
    pVeh.id === OBJECTIVE_VEHICLE_BLUE &&
    gTeam.get(player) === TEAM_BLUE
  ) {
    // Blue OBJECTIVE REACHED.
    gBlueTimesCapped++;
    player.setScore(player.getScore() + 5);

    if (gBlueTimesCapped == CAPS_TO_WIN) {
      new GameText("~b~BLUE ~w~team wins!", 3000, 5).forAll();
      gObjectiveReached = 1;
      playSoundForAll(1185, 0.0, 0.0, 0.0);
      setTimeout(() => {
        // Set up a timer to exit this mode.
        exitTheGameMode();
      }, 6000);
    } else {
      new GameText("~b~BLUE ~w~team captured the ~y~boat!", 3000, 5).forAll();
      pVeh.setRespawn();
    }
    return next();
  }

  return next();
});

PlayerEvent.onDeath(({ player, killer, reason, next }) => {
  if (killer === InvalidEnum.PLAYER_ID) {
    player.sendDeathMessage(InvalidEnum.PLAYER_ID, reason);
  } else {
    if (gTeam.get(killer) !== gTeam.get(player)) {
      // Valid kill
      player.sendDeathMessage(killer, reason);
      killer.setScore(killer.getScore() + 1);
    } else {
      // Team kill
      player.sendDeathMessage(killer, reason);
    }
  }

  const pVar_ = pVar.get(player)!;
  pVar_.lastDeathTick = Date.now();
  pVar_.lastKillerId = typeof killer === "number" ? killer : killer.id;
  pVar.set(player, pVar_);
  return next();
});

VehicleEvent.onStreamIn(({ next, vehicle, forPlayer }) => {
  // As the vehicle streams in, player team dependant params are applied. They can't be
  // applied to vehicles that don't exist in the player's world.
  if (vehicle.id === OBJECTIVE_VEHICLE_BLUE) {
    if (gTeam.get(forPlayer) === TEAM_GREEN) {
      Vehicle.getInstance(vehicle.id)!.setParamsForPlayer(
        forPlayer,
        true,
        true
      ); // objective; locked
    } else if (gTeam.get(forPlayer) === TEAM_BLUE) {
      Vehicle.getInstance(vehicle.id)!.setParamsForPlayer(
        forPlayer,
        true,
        false
      ); // objective; unlocked
    }
  } else if (vehicle.id === OBJECTIVE_VEHICLE_GREEN) {
    if (gTeam.get(forPlayer) === TEAM_BLUE) {
      Vehicle.getInstance(vehicle.id)!.setParamsForPlayer(
        forPlayer,
        true,
        true
      ); // objective; locked
    } else if (gTeam.get(forPlayer) === TEAM_GREEN) {
      Vehicle.getInstance(vehicle.id)!.setParamsForPlayer(
        forPlayer,
        true,
        false
      ); // objective; unlocked
    }
  }
  return next();
});

PlayerEvent.onUpdate(({ player, next }) => {
  if (player.isNpc()) return next();

  const pVar_ = pVar.get(player)!;

  if (player.getState() === PlayerStateEnum.SPECTATING) {
    if (pVar_.lastDeathTick === 0) {
      player.toggleSpectating(false);
      return next();
    }
    // Allow respawn after an arbitrary time has passed
    if (
      Date.now() - pVar_.lastDeathTick >
      ALLOW_RESPAWN_AFTER_N_SECONDS * 1000
    ) {
      player.toggleSpectating(false);
      return next();
    }
    handleSpectating(player);
    return next();
  }

  // Check the resupply huts
  if (player.getState() === PlayerStateEnum.ONFOOT) {
    if (
      player.isInRangeOfPoint(2.5, 2140.83, -235.13, 7.13) ||
      player.isInRangeOfPoint(2.5, 2318.73, 590.96, 6.75)
    ) {
      doResupply(player);
    }
  }
  return next();
});

function playSoundForAll(soundId: number, x: number, y: number, z: number) {
  Player.getInstances().forEach((p) => {
    p.playSound(soundId, x, y, z);
  });
}

function createMapObject(
  modelId: number,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
) {
  const obj = new DynamicObject({
    modelId,
    x,
    y,
    z,
    rx,
    ry,
    rz,
    drawDistance: 500,
  });
  obj.create();
  return obj;
}

function removeNeededBuildingsForPlayer(player: Player) {
  const pVar_ = pVar.get(player)!;
  if (pVar_.buildingsRemoved === 0) {
    removeBuildings.forEach((building) => {
      const [modelId, fX, fY, fZ, fRadius] = building;
      player.removeBuilding(modelId, fX, fY, fZ, fRadius);
    });
    pVar_.buildingsRemoved = 1;
  }
  pVar.set(player, pVar_);
}

function spectatePlayer(player: Player, specPlayer: Player) {
  const specState = specPlayer.getState();
  const pVar_ = pVar.get(player)!;
  if (specState === PlayerStateEnum.ONFOOT) {
    if (pVar_.spectateMode !== SPECTATE_MODE_PLAYER) {
      player.spectatePlayer(specPlayer);
      pVar_.spectateMode = SPECTATE_MODE_PLAYER;
    }
  } else if (
    specState === PlayerStateEnum.DRIVER ||
    specState === PlayerStateEnum.PASSENGER
  ) {
    if (pVar_.spectateMode !== SPECTATE_MODE_VEHICLE) {
      player.spectateVehicle(specPlayer.getVehicle()!);
      pVar_.spectateMode = SPECTATE_MODE_VEHICLE;
    }
  }
  pVar.set(player, pVar_);
}

function spectateFixedPosition(player: Player) {
  if (gTeam.get(player) === TEAM_GREEN) {
    player.setCameraPos(2221.582, -273.9985, 61.7806);
    player.setCameraLookAt(2220.9978, -273.1861, 61.4606);
  } else {
    player.setCameraPos(2274.8467, 591.3257, 30.1311);
    player.setCameraLookAt(2275.0503, 590.3463, 29.946);
  }
}

function handleSpectating(player: Player) {
  const pVar_ = pVar.get(player)!;
  const lastKiller = Player.getInstance(pVar_.lastKillerId);
  if (!lastKiller) return;
  const lastKillerState = lastKiller.getState();
  // Make sure the killer player is still active in the world
  if (
    lastKillerState === PlayerStateEnum.ONFOOT ||
    lastKillerState === PlayerStateEnum.DRIVER ||
    lastKillerState === PlayerStateEnum.PASSENGER
  ) {
    spectatePlayer(player, lastKiller);
    pVar_.spectateState = SPECTATE_STATE_PLAYER;
  } else {
    // Else switch to the fixed position camera
    if (pVar_.spectateState !== SPECTATE_STATE_FIXED) {
      spectateFixedPosition(player);
      pVar_.spectateState = SPECTATE_STATE_FIXED;
    }
  }
  pVar.set(player, pVar_);
}

function doResupply(player: Player) {
  const pVar_ = pVar.get(player)!;
  if (pVar_.lastResupply === 0 || Date.now() - pVar_.lastResupply > 30000) {
    pVar_.lastResupply = Date.now();
    player.resetWeapons();
    player.giveWeapon(31, 100);
    player.giveWeapon(29, 200);
    player.giveWeapon(34, 10);
    player.setHealth(100.0);
    player.setArmour(100.0);
    new GameText("Resupplied", 2000, 5).forPlayer(player);
    player.playSound(1150, 0.0, 0.0, 0.0);
  }
  pVar.set(player, pVar_);
}

// priority: 800

/**
 * Represents a template event. Object name should be added to the ftbEvents object in the main script.
 * @property {string} name - The name of the event. Used for identification.
 * @property {string} displayName - The display name of the event. Used for display purposes.
 * @property {string} description - The description of the event. Not used at the moment
 * @property {number} chance - The chance of the event occurring. 0.0 - 1.0
 * @property {string|null} stage - The stage of the event. Stage needed before this Event can happen
 * @property {string|null} disableStage - The stage needed to be able to disable this event
 *
 * @property {number} size - The size of the event area / mob needed spawning area.
 * @property {number} minDistance - The minimum distance for the event.
 * @property {number} maxDistance - The maximum distance for the event.
 * @property {string[]} checkBlocks - The blocks to check for the event. (Example minecraft:chest for the Mimic Event)
 * @property {boolean} requireBlockBelow - Indicates if a block below is required for the event.
 *
 * @property {Function} execute - The function to execute when the event occurs.
 */
const event_phantom = {
  name: "ftb:phantom",
  displayName: "Phantom Bomber Event",
  description: "A random Phantom spawns, trying to drop an Anvil on the player",
  chance: 0.1,
  stage: null,
  disableStage: null,

  size: -1,
  minDistance: 1,
  maxDistance: 24,

  checkBlocks: ["minecraft:air"],
  requireBlockBelow: false,

  /**
   * Executes the event.
   * In here you can do almost everything you want.
   *
   * @param {Event} event - The event object. limited use when triggering the event with the force command
   * @param {Player} player - The player object.
   * @param {Location} location - The location object.
   */
  execute(event, player, location) {
    let level = player.getLevel();
    if (!level.isNight()) return;
    let server = level.getServer();
    let distance = 32

    let angle = Math.random() * Math.PI * 2;
    let minDist = 8;
    let maxDist = 16;
    let dist = minDist + Math.random() * (maxDist - minDist);
    let random = {
      x: player.x + Math.cos(angle) * dist,
      y: player.y + 32,
      z: player.z + Math.sin(angle) * dist
    };
    let phantom = level.createEntity("minecraft:phantom");


    phantom.setPos(random.x, random.y, random.z);
    phantom.potionEffects.add("minecraft:fire_resistance", 1000000, 0, false, false); //make sure the phantom doesn't burn in the sun
    phantom.setGlowing(true);
    phantom.spawn();
    phantom.setAggressive(true);
    phantom.setTarget(player);
    player.sendSystemMessage(Text.translate("ftb_event_system.event.phantom.spawned"));



    server.scheduleInTicks(20, (_) => {
      player.persistentData.timer = 10; //lower their event timer instead of a full reset
    });

    server.scheduleInTicks(20 * Math.floor(Math.random()*5+2), (_) =>{
        let result = summonDistanceBasedAnvil(phantom, player, {
            baseVelocity: 0.4, 
            distanceMultiplier: 0.025, 
            maxVelocity: 1.0,
            minVelocity: 0.3 
        });
        server.runCommandSilent(`/execute in ${level.dimension} run summon falling_block ${phantom.x} ${phantom.y} ${phantom.z} {BlockState:{Name:"minecraft:anvil"},Time:1,Motion:[${result.motion.vx.toFixed(3)},${result.motion.vy.toFixed(3)},${result.motion.vz.toFixed(3)}]}`);
        server.scheduleInTicks(20 * 10, (_) => {
            if (phantom.isAlive()) {
                phantom.discard(); // remove the phantom after 10 seconds
            }
        })
    })

  },
};


function summonDistanceBasedAnvil(phantom, player, options) {
    const velocityData = calculateUpwardVelocity(phantom, player, options);
    
    // Calculate horizontal velocity components
    const dx = player.x - phantom.x;
    const dz = player.z - phantom.z;
    
    const flightTime = options.flightTime || Math.max(30, velocityData.horizontalDistance * 1.5);
    
    const vx = dx / flightTime;
    const vz = dz / flightTime;
    const vy = velocityData.upwardVelocity;
    
    const command = `/summon falling_block ${phantom.x} ${phantom.y} ${phantom.z} {BlockState:{Name:"minecraft:anvil"},Time:1,Motion:[${vx.toFixed(3)},${vy.toFixed(3)},${vz.toFixed(3)}]}`;
    return {
        command: command,
        velocityData: velocityData,
        motion: {vx:vx, vy:vy, vz:vz}
    };
}

function calculateUpwardVelocity(phantom, player, options) {
    const dx = player.x - phantom.x;
    const dz = player.z - phantom.z;
    const dy = player.y - phantom.y; 
    
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const totalDistance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const baseUpwardVelocity = options.baseVelocity || 0.3;
    const distanceMultiplier = options.distanceMultiplier || 0.02;
    const maxUpwardVelocity = options.maxVelocity || 1.2;
    const minUpwardVelocity = options.minVelocity || 0.4;
    

    let upwardVelocity = baseUpwardVelocity + (horizontalDistance * distanceMultiplier);
    upwardVelocity = Math.max(minUpwardVelocity, Math.min(maxUpwardVelocity, upwardVelocity));
    
    return {
        upwardVelocity: upwardVelocity,
        horizontalDistance: horizontalDistance,
        totalDistance: totalDistance3D,
        verticalDrop: Math.abs(dy)
    };
}

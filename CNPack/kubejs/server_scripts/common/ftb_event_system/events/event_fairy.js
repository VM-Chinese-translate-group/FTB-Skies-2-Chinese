// priority: 800

const fairyAction = 
{
    name: "buff",
    displayName: "Buff",
    description: "Gives the player a random buff",
    execute(player) {
        player.heal(8); // Heal 4 hearts

        const buffs = [
            { effect: "minecraft:speed", duration: 18000, amplifier: 1 }, // Speed II for 30 seconds
            { effect: "minecraft:strength", duration: 18000, amplifier: 1 }, // Strength II for 30 seconds
            { effect: "minecraft:regeneration", duration: 18000, amplifier: 1 } // Regeneration II for 30 seconds
        ];
        const randomBuff = buffs[Math.floor(Math.random() * buffs.length)];
        player.potionEffects.add(randomBuff.effect, randomBuff.duration, randomBuff.amplifier, true, false);
        player.tell(Text.translate("ftb.event.fairy_buff", [randomBuff.effect, randomBuff.duration / 20]));
    }
}



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
const event_fairy = {
  name: "ftb:fairy",
  displayName: "Fairy Event",
  description: "A random Allay (Fairy) spawns, Healing you or giving you a random buff",
  chance: 0.1,
  stage: null,
  disableStage: null,

  size: 1,
  minDistance: 4,
  maxDistance: 8,

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
    let server = level.getServer();

    let fairy = level.createEntity("minecraft:allay");
    fairy.setGlowing(true);
    fairy.setPos(location.pos.x, location.pos.y + 1, location.pos.z);
    fairy.setInvulnerable(true);
    fairy.setCustomName(`Fairy`);


    fairy.persistentData["trade"] = {
      isTrading: 0,
      spawnTime: new Date().getTime(),
      buy: "minecraft:bedrock" // unobtainable item so u can't trade
    };

    fairy.spawn();
    console.log(fairy);

    server.scheduleInTicks(20, (_) => {
      player.persistentData.timer = 10; //lower their event timer instead of a full reset
    });

    [10, 20, 30, 40].forEach(seconds => {

        server.scheduleInTicks(20 * seconds, _ => {
            if(!fairy.isAlive()) return; // check if fairy is still alive
            fairy.getNavigation().moveTo(player, 1.5);
        });
    });

    [15, 25, 35, 45].forEach(seconds => {
        server.scheduleInTicks(20 * seconds, _ => {
            if(!fairy.isAlive()) return; // check if fairy is still alive
            if(distanceTo({x: fairy.x, y: fairy.y, z: fairy.z}, {x: player.x, y: player.y, z: player.z}) < 5){
                target.persistentData["trade"].isTrading = 1;
                target.setDancing(true);
                fairyAction.execute(player);
                server.scheduleInTicks(20, _ => {
                    target.discard(); // remove the fairy after it has done its action    
                });
                player.persistentData.timer = 10; //lower their event timer instead of a full reset
            }
        });
    });
  },
};
ItemEvents.entityInteracted(event => {
    const {player, target, level, server, hand} = event;
    if(hand !== "MAIN_HAND") return; // only trigger on main hand interactio
    if(target.type !== "minecraft:allay" && target.getCustomName() != "Fairy") return;
    if(target.persistentData["trade"] && target.persistentData["trade"].isTrading > 0) return; 
    target.persistentData["trade"].isTrading = 1;
    target.setDancing(true);
    fairyAction.execute(player);
    server.scheduleInTicks(20, _ => {
        target.discard(); // remove the fairy after it has done its action    
    });
    player.persistentData.timer = 10; //lower their event timer instead of a full reset

    
})

const distanceTo = (pos1, pos2) => {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
};


var debug = false;
const checks = {
    player: {
        getRandomPlayer: function(players){
            if (players.length === 0) {
                if (debug) console.log("No players found for events");
                return;
            }
            var chosenPlayer = players[Math.floor(Math.random() * players.length)];
            if (debug) console.log("Chose player for event " + chosenPlayer.username);
            return chosenPlayer;
        },
        isCreativeOrSpectator: function(player) {
            if (player.isCreative() || player.isSpectator()) {
                if (debug) console.log("Player is creative or spectator, returning");
                return true;
            }
            return false;
        },
        hasTimer: function(player) {
            if (player.persistentData.timer) return true;
            let Statistics = player.level.server.persistentData.Statistics;

            if (debug) console.log("Player has no timer, returning");
            Statistics.failure['No Timer'] = Statistics.failure['No Timer'] ? Statistics.failure['No Timer'].getAsInt() + 1 : 1;
            return false;
        },
        isAlive: function(player) {
            if (player.alive) return true;
            let Statistics = player.level.server.persistentData.Statistics;
            if (debug) console.log("Player is dead, returning");
            Statistics.failure['Player Dead'] = Statistics.failure['Player Dead'] ? Statistics.failure['Player Dead'].getAsInt() + 1 : 1;
            return false;
        },
        getDisabledEvents: function(player) {
            if (!player.persistentData.disabledEvents || player.persistentData.disabledEvents.length <= 0) return [];

            let disabledEvents = [];
            for (let i = 0; i < player.persistentData.disabledEvents.length; i++) {
                disabledEvents.push(player.persistentData.disabledEvents[i].getAsString());
            }
            return disabledEvents;
        },
        isOnCooldown: function(player, timeCooldown) {
            if (player.persistentData.timer >= timeCooldown) return false;
            let Statistics = player.level.server.persistentData.Statistics;

            if (debug) console.log("Player is on cooldown, returning");
            Statistics.failure['On Cooldown'] = Statistics.failure['On Cooldown'] ? Statistics.failure['On Cooldown'].getAsInt() + 1 : 1;
            return true;
        },
        hasStage: function(event, player){
            if (!event.stage || player.stages.has(event.stage)) return true;
            let Statistics = player.level.server.persistentData.Statistics;

            if (debug) console.log("Player does not have required stage for event, returning");
            player.persistentData.timer = timeCooldown; //reset their event timer since no event was able to trigger
            Statistics.failure['Missing Stage'] = Statistics.failure['Missing Stage'] ? Statistics.failure['Missing Stage'].getAsInt() + 1 : 1;
            return false;
        }
    },
    event: {
        inBiome: function(event, player){
            let Statistics = player.level.server.persistentData.Statistics;

            if (!event.requiredBiomes || event.requiredBiomes.length <= 0) return true;

            let biomeHolder = player.level.minecraftLevel.getBiome(player.getBlock().getPos());
            let foundBiome = event.requiredBiomes.find((e) => biomeHolder.is(e));

            if (!foundBiome) {
                if (debug) console.log("Required biome not found, returning");
                Statistics.failure['Required Biome'] = Statistics.failure['Required Biome'] ? Statistics.failure['Required Biome'].getAsInt() + 1 : 1;
                return false;
            }
            return true;
        },
        filterEvents: function(events, disabledEvents) {
            //Filter event based on their chance, disabled events
            var filteredEvents = events.filter((e) => Math.random() <= e.chance && !Array.from(disabledEvents).includes(e.name));

            // If no event return 
            if (filteredEvents.length === 0) {
                if (debug) console.log("No events found after filtering, returning");
                //Statistics.failure['No Event'] = //Statistics.failure['No Event'] ? //Statistics.failure['No Event'].getAsInt() + 1 : 1;
                return null;
            }
            return filteredEvents;
        },
        getRandomEvent: function(events) {
            if (events.length === 0) {
                if (debug) console.log("No events found, returning");
                //Statistics.failure['No Event'] = //Statistics.failure['No Event'] ? //Statistics.failure['No Event'].getAsInt() + 1 : 1;
                return null;
            }
            var chosenEvent = events[Math.floor(Math.random() * events.length)];
            if (debug) console.log("Chose event " + chosenEvent.name);
            return chosenEvent;
        },
        rollChance: function(chance) {
            var ran = Math.random();
            if (debug) console.log("Rolled chance: " + ran + " for chance: " + chance);      
            return ran <= chance;
        },
        findSpawnLocation: function(event, player, maxAttempts) {
            let Statistics = player.level.server.persistentData.Statistics;
            if (debug) console.log("Finding spawn location for event: " + event.name);
            if( event.size < 0 || !event.minDistance || !event.maxDistance) return null; // No valid event size or distance

            let tries = 0;
            let spawnFound;
            let playerPos = player.getBlock().getPos();

            while (tries < maxAttempts && !spawnFound) {
                let randomLoc = new Ku.Level(player.getLevel()).getRandomLocation(
                    playerPos,
                    event.minDistance,
                    event.maxDistance
                );
                if (debug && !spawnFound) console.log("Checking spawn location for event: " + event.name);

                let spawnCheck = checkSpawnLocation(
                    player.getLevel(),
                    randomLoc,
                    event.size,
                    event.checkBlocks,
                    event.requireBlockBelow
                );
                if (spawnCheck.okay) {
                    spawnFound = { pos: randomLoc, locationInfo: spawnCheck };
                    
                    if (debug) console.log("Spawn found for event: " + event.name + " at " + randomLoc.toString());
                    return spawnFound; // Valid spawn found
                } else {
                    tries++;
                }
            }
            if (debug && !spawnFound) {
                console.log("Spawn not found for event");
                Statistics.failure['Spawn not found'] = Statistics.failure['Spawn not found'] ? Statistics.failure['Spawn not found'].getAsInt() + 1 : 1;
                return null; // No valid spawn found
            }
            
            return spawnFound; 
        }
    }
}


const checkSpawnLocation = (level, pos, size, checkBlocks, requireBlockBelow) => {
  let blocks = new Ku.Level(level).seekCollectionOfBlocks(
    pos,
    size,
    (pos) => checkBlocks.includes(level.getBlock(pos).blockState.block.id),
    requireBlockBelow ? (pos) => Ku.Utils.notNullOrEmpty(level.getBlock(pos)) : null
  );
  return {
    okay: blocks.length > 0,
    blocks: Ku.Streams.mapToBlock(level, blocks),
  };
};

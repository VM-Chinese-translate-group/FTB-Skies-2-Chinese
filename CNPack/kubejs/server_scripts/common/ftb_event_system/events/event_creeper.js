// priority: 800

const event_creeper = {
    name: "ftb:creeper",
    displayName: "Creeper",
    description: "",
    chance: 0.1,
    stage: null,
    disableStage: null,

    size: -1,
    minDistance: 1,
    maxDistance: 24,

    checkBlocks: ["minecraft:air"],
    requireBlockBelow: false,

    execute(event, player, location, name) {
        let level = player.getLevel();
        let server = level.server;
        let creepers = []

        level.server.scheduleInTicks(60, (_) => { 
            for (let { x, z } of creeperPositions) {
                let creeper = level.createEntity("minecraft:creeper");
                if(name) {
                    creeper.setCustomName(name)
                    creeper.setCustomNameVisible(true)
                }
                creeper.setPos(player.x + x, player.y, player.z + z);
                creeper.spawn()
                let nbt = creeper.nbt
                nbt.Fuse = 6000; //increase fuse; just in case
                nbt.ExplosionRadius = 0; //disable explosion
                creeper.nbt = nbt;
                creepers.push(creeper);
            }
        })



        level.server.scheduleInTicks(65, (_) => {
            for (let creeper of creepers) {
                creeper.ignite();
            }
        });
        level.server.scheduleInTicks(94, (_) => {
            for (let creeper of creepers) {
                creeper.block.popItemFromFace(Item.of("minecraft:gunpowder", Math.floor(Math.random() * 2 + 1)), "up");
                creeper.discard();
            }
        });
        player.persistentData.timer = 11000; //lower their event timer instead of a full reset

    }
}

const creeperPositions = [
    { x: -1.5, z: -1.5 },
    { x: -2, z: 0 },
    { x: -1.5, z: 1.5 },
    { x: 0, z: -2 },
    { x: 0, z: 2 },
    { x: 1.5, z: -1.5 },
    { x: 1.5, z: 1.5 },
    { x: 2, z: 0 },
]
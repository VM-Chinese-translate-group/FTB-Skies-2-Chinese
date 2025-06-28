// priority: 800
const event_frog = {
  name: "ftb:frogs",
  displayName: "Frog and Squids",
  description: "Toggles the Frog and Squids Event. Frogs and Squids will spawn in water.",
  chance: 0.3,
  minDistance: 1,
  maxDistance: 15,
  size: 0,
  checkBlocks: ["minecraft:water"],
  requireBlockBelow: false,
  itemDespawnTime: 400,
  stage: null,
  disableStage: null,


  execute(event, player, location, name) {
    const level = player.getLevel();
    let creature;
    if (Math.random() < 0.50) {
      creature = "minecraft:frog";
      player.tell(["Ribbit."]);
    } else {
      creature = Math.random() < 0.90 ? "minecraft:squid" : "minecraft:glow_squid";
      player.tell(["*SPLASH*"]);
    }

    const entity = level.createEntity(creature);
    if(name) {
      entity.setCustomName(name)
      entity.setCustomNameVisible(true)
    }
    entity.setPosition(location.pos.x + 0.5, location.pos.y + 0.5, location.pos.z + 0.5);

    entity.spawn();
  },
};

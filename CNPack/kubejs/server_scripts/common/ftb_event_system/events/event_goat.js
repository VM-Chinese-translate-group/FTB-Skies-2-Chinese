// priority: 800
const Goat = Java.loadClass("net.minecraft.world.entity.animal.goat.Goat");
const GoatAI = Java.loadClass("net.minecraft.world.entity.animal.goat.GoatAi");

const event_goat = {
  name: "ftb:goat",
  displayName: "Goat",
  description: "Toggles the Goat Event. Spawns a random Quantum Goat near you",
  chance: 0.25,
  size: -1,
  checkBlocks: ["minecraft:air"],
  requireBlockBelow: true,
  itemDespawnTime: 400,
  stage: null,
  disableStage: "seen_goat",
  lootTable: {
    goatloot: [
      { entry: "rftoolsbase:dimensionalshard", weight: 10 },
      { entry: "relics:infinity_ham", weight: 1 },
      { entry: "ars_nouveau:greater_experience_gem", weight: 5 },
      { entry: "mysticalagradditions:nether_star_shard", weight: 3 },
      { entry: "minecraft:iron_ingot", weight: 15 },
      { entry: "minecraft:obsidian", weight: 10 },
      { entry: "minecraft:copper_ingot", weight: 15 },
      { entry: "minecraft:gold_ingot", weight: 8 },
      { entry: "minecraft:ender_pearl", weight: 4 },
      { entry: "silentgear:emerald_shard", weight: 10 },
    ],
  },

  execute(event, player, location, name) {
    const level = player.getLevel();
    let entity = level.createEntity("minecraft:goat");
    console.log("Warning Player" + player.id + " that a goat is near");
    player.sendSystemMessage(
      { translate: "ftb_event_system.event.goat.warning", color: "red" },
      true
    );

    level.server.scheduleInTicks(140, () => {
      let goat = Goat(entity);
      goat.x = player.x;
      goat.y = player.y;
      goat.z = player.z;
      console.log(goat);
      if (name) {
        goat.setCustomName(name);
      } else {
        goat.setCustomName("Quantum Goat");
      }
      goat.setCustomNameVisible(true);
      goat.setScreamingGoat(true);
      goat.potionEffects.add("minecraft:invisibility", 10, 1, true, false);

      goat.spawn();

      let goatAi = new GoatAI();
      goatAi.updateActivity(goat);

      for (let i = 0; i < 80; i++) {
        goat.aiStep();
      }
      level.server.scheduleInTicks(120, () => {
        var itemEntity = level.createEntity("item");
        itemEntity.item = Ku.Lists.getEntryBasedOnWeight(
          this.lootTable.goatloot
        );
        itemEntity.setPosition(goat.x, goat.y, goat.z);
        itemEntity.age = 6000 - this.itemDespawnTime;
        itemEntity.glowing = true;
        itemEntity.spawn();
        goat.discard();
      });
    });
  },
};

EntityEvents.afterHurt((event) => {
  const { source, entity } = event;
  if (!entity || !source) return;
  const actualSource = source.getActual();
  if (!actualSource) return;

  if (entity.isPlayer() && actualSource.type == "minecraft:goat") {
    if (!entity.stages.has("seen_goat")) {
      entity.stages.add("seen_goat");
      entity.level.server.scheduleInTicks(40, () => {
        entity.sendSystemMessage(
          {
            translate: ftb_event_system.event.goat.disablestage,
            color: "green",
          },
          true
        );
      });
    }
  } else if (actualSource.isPlayer() && entity.type == "minecraft:goat") {
    if (!actualSource.stages.has("seen_goat")) {
      actualSource.stages.add("seen_goat");
      entity.level.server.scheduleInTicks(40, () => {
        actualSource.sendSystemMessage(
          {
            translate: ftb_event_system.event.goat.disablestage,
            color: "green",
          },
          true
        );
      });
    }
  }
});

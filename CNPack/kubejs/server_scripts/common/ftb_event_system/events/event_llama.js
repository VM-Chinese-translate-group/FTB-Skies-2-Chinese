// priority: 800

const event_llama = {
  name: "ftb:llama",
  displayName: "Llama",
  description: "Toggles the Llamapalooza Event. Spawns a random Loot Lama near you, Leash it before it runs away!",
  chance: 0.25,
  checkBlocks: ["minecraft:air"],
  requireBlockBelow: true,
  itemDespawnTime: 400,
  stage: null,
  minDistance: 2,
  maxDistance: 15,
  size: 0,
  commandSuggestions: [
    {"lootTable": "llamapalooza:resources/general"},
    {"lootTable": "llamapalooza:resources/ores"}
  ],
  
  execute(event, player, location, name, options) {
    const level = player.getLevel();
    const server = level.getServer();
    // console.log('Warning Player' + player.id + ' that a goat is near');
    player.sendSystemMessage({ text: "⚠ " + 'You hear some rustling nearby as if some creature is approaching...', color: "red" }, true);
    // player.sendSystemMessage(Text.translate("kubejs.events.rustling").red(), true);

    level.server.scheduleInTicks(140, () => {
      let llama = level.createEntity("llamapalooza:loot_llama");
      player.sendSystemMessage({ text: 'Its a Loot Lama! Leash it before it runs away!', color: "green" }, true);
      llama.setLootTable(options?.lootTable ?? "ftb:llama_food")
      llama.x = location.pos.x;
      llama.y = location.pos.y;
      llama.z = location.pos.z;
      llama.setCustomName(Text.of(`Loot Lama - Food`))
      llama.setCustomNameVisible(false);
      if(name) {
        llama.setCustomName(name)
        llama.setCustomNameVisible(true);
      }
      
      llama.spawn();
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${llama.x} ${
          llama.y -1
        } ${
          llama.z
        } run summon firework_rocket ~ ~1 ~ {LifeTime:15,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:star,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583],fade_colors:[I;16351261,16701501]}]}}}}`
      );

      level.server.scheduleInTicks(20*15, () => {
        if( llama.isLeashed()) {
          player.sendSystemMessage({ text: "✓ " + 'You have successfully leashed the Loot Lama!', color: "green" }, true);
          return;
        }

        level.spawnParticles("minecraft:smoke", true, llama.x, llama.y+0.5, llama.z, 0.25, 0.5, 0.25, 25, 0.01);
        player.sendSystemMessage({ text: "⚠ " + 'The Loot Lama has escaped!', color: "red" }, true);
        llama.discard();
      });
    });
  },
};





// priority: 1

const $MagicCoinsApi = Java.loadClass(
  "net.sirgrantd.magic_coins.api.MagicCoinsApi"
);

const tierRequirement = 4;
const layers = [
  "ftb:pyramid_top",
  "ftb:pyra_mid_upper",
  "ftb:pyra_mid_lower",
  "ftb:pyramid_base",
];
const catalystItem = "minecraft:nether_star";
const rewardItem = "ftb:creative_ascension"; // Define the specific reward item here
const gamestageRequired = "completed_pyramid";

PlayerEvents.loggedIn((event) => {
  $MagicCoinsApi.setIsCoinsLostOnDeath(event.player, true);
});

BlockEvents.rightClicked("minecraft:beacon", function (event) {
  const { player, hand, item, level, block, server } = event;

  if (hand != "MAIN_HAND") event.cancel();

  // Check if the player meets requirements
  if (!player.stages.has(gamestageRequired))
    return player.tell(Component.translate("kubejs.pyramid.gamestage"));
  if (item.id !== catalystItem) return;
  if (block.getEntityData().Levels < tierRequirement) {
    return player.tell(
      Component.translate("kubejs.pyramid.below_tier", [
        `${tierRequirement.toString()}`,
        `${block.getEntityData().Levels.toString()}`,
      ])
    );
  }

  // Validate each layer of the pyramid
  for (let i = 0; i < layers.length; i++) {
    let layerSize = 1 + i; // Increase pyramid size by layer
    let yOffset = -i - 1; // Calculate the vertical offset for each layer

    for (let x = -layerSize; x <= layerSize; x++) {
      for (let z = -layerSize; z <= layerSize; z++) {
        let currentBlock = level.getBlock(
          block.x + x,
          block.y + yOffset,
          block.z + z
        );

        if (currentBlock.id !== layers[i]) {
          return player.tell(
            Component.translate("kubejs.pyramid.wrong_layer", [
              `${i + 1}`,
              Text.green(
                Component.translate(Item.of(layers[i]).getDescriptionId())
              ),
              Text.red(
                Component.translate(currentBlock.item.getDescriptionId())
              ),
            ])
          );
        }
      }
    }
  }

  player.sendSystemMessage(
    { translate: "kubejs.pyramid.success", color: "green" },
    true
  );
  let soundCommand = `execute as ${player.name.string} run playsound ars_nouveau:ea_channel ambient ${player.name.string} ~ ~ ~ 0.5 2 0.5`;
  server.runCommandSilent(soundCommand);

  let iterations = 10;

  // Fireworks for first time completion
  if (!player.stages.has("received_pyramid_reward")) {
    iterations = 40;
    player.stages.add("received_pyramid_reward");
    server.scheduleInTicks(170, (_) => {
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${block.x} ${
          block.y + 1
        } ${
          block.z
        } run summon firework_rocket ~ ~1 ~ {LifeTime:20,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:creeper,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583]}]}}}}`
      );
    });
    server.scheduleInTicks(180, (_) => {
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${block.x + 3} ${
          block.y - 1
        } ${
          block.z + 3
        } run summon firework_rocket ~ ~1 ~ {LifeTime:15,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:star,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583],fade_colors:[I;16351261,16701501]}]}}}}`
      );
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${block.x + 3} ${
          block.y - 1
        } ${
          block.z - 3
        } run summon firework_rocket ~ ~1 ~ {LifeTime:15,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:star,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583],fade_colors:[I;16351261,16701501]}]}}}}`
      );
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${block.x - 3} ${
          block.y - 1
        } ${
          block.z + 3
        } run summon firework_rocket ~ ~1 ~ {LifeTime:15,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:star,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583],fade_colors:[I;16351261,16701501]}]}}}}`
      );
      server.runCommandSilent(
        `execute in ${player.level.dimension} positioned ${block.x - 3} ${
          block.y - 1
        } ${
          block.z - 3
        } run summon firework_rocket ~ ~1 ~ {LifeTime:15,FireworksItem:{id:firework_rocket,components:{fireworks:{flight_duration:1.5,explosions:[{shape:star,has_twinkle:1b,has_trail:1b,colors:[I;11546150,8439583],fade_colors:[I;16351261,16701501]}]}}}}`
      );
    });
  }

  // Particle effects for the pyramid
  for (let i = 0; i < iterations; i++) {
    let red = Math.random() * 0.5 + 0.5;
    let green = Math.random() * 0.5 + 0.5;
    let blue = Math.random() * 0.5 + 0.5;
    server.scheduleInTicks(i * 5, (_) =>
      server.runCommandSilent(
        `execute at ${
          player.username
        } run particle minecraft:entity_effect{color:[${red},${green},${blue},1.0]} ${
          block.x + 0.5
        } ${block.y + 1} ${block.z + 0.5} 0 0 0 0.5 100 force`
      )
    );
  }

  // Spawn the reward item
  server.scheduleInTicks(iterations * 5, (_) => {
    if (item.count < 1) {
      return player.sendSystemMessage(
        { translate: "kubejs.pyramid.no_catalyst", color: "red" },
        true
      );
    }
    server.runCommandSilent(
      `execute at ${player.username} run summon item ${block.x} ${
        block.y + 1
      } ${
        block.z
      } {Item:{id:"${rewardItem}",Count:1b},NoGravity:1b, Glowing:1b, Motion:[0d,0.02d]}`
    );
    if (!player.isCreative()) item.count--; // Consume catalyst if player is not in Creative mode
  });

  event.cancel(); // Prevent beacon GUI from opening
});

// Map to track player cooldowns
const infinityCooldowns = {};

// Blacklist entries - partial matches (e.g., blocks anything with "sgjourney:")

PlayerEvents.tick((event) => {
  const player = event.player;
  const currentTime = player.level.getTime();

  if (!player || !player.isAlive()) {
    //console.warn("Player is not valid or not alive.");
    return; // Exit if player is not valid or not alive
  }

  if (currentTime % 20 !== 0) {
    //console.warn( "Skipping tick event, not every 20 ticks. Current Gametime = " + currentTime );
    return;
  }

  const dimension = player.level.dimension;

  // Skip if dimension matches any blacklist pattern
  const dim = String(player.level.dimension);
  if (dim.includes("ftbteambases:") && dim.includes("private_for_")) {
    // match confirmed
  } else {
    //console.warn(`Skipping player in dimension: ${dimension}`);
    return;
  }

  // Skip if player has the 'no_infinity' stage
  if (player.stages.has("no_infinity")) {
    //console.warn("Player has 'no_infinity' stage, skipping.");
    return; // Exit if player has the 'no_infinity' stage
  }

  // Check Y level
  if (player.blockY >= -32) {
    //console.warn("Player Y level is above -32, skipping." + "Player is at block:" + player.blockY);
    return; // Exit if player Y level is above -64
  }

  const uuid = player.uuid;

  // Check cooldown
  if (infinityCooldowns[uuid] && currentTime < infinityCooldowns[uuid]) {
    //console.warn(`Player ${player.name} is still on cooldown.`);
    return; // Exit if player is still on cooldown
  }

  // Set cooldown (5 seconds = 100 ticks)
  infinityCooldowns[uuid] = currentTime + 100;

  // Give item
  //console.log("Giving Grains of Infinity to player:", player.name);
  player.give(Item.of("enderio:grains_of_infinity"));
});

/*
 * Easter Egg
 */

const easterEgg = {
  armor: [
    `minecraft:leather_boots[dyed_color={rgb:15961002},custom_name='"and witty and bright!"']`,
    `minecraft:leather_leggings[dyed_color={rgb:15961002},custom_name='"I feel pretty"']`,
    `minecraft:leather_chestplate[dyed_color={rgb:15961002},custom_name='"Oh, so pretty"']`,
    `minecraft:leather_helmet[dyed_color={rgb:15961002},custom_name='"I feel pretty"']`,
  ],
  flower: `minecraft:pink_tulip[custom_name='"All you need is Wuv!"']`,
  sword: `minecraft:diamond_sword`,
  reward: Item.of(`minecraft:pink_tulip
        [
            enchantments={levels:{"minecraft:sharpness":15, "minecraft:knockback":5}}, 
            custom_name='"Pretty Pink Princess!"'
        ]`),
};

PlayerEvents.tick((event) => {
  const { player, server } = event;
  let players = server.getPlayers();

  if (players.length == 1) return;

  if (Math.floor(Math.random() * 800) !== 0) return;
  if (player.persistentData.isPretty) return;
  if (!player.inventory.hasAnyOf(Item.of(easterEgg.sword))) return;

  if (!player.isSprinting()) return;
  if (player.getMainHandItem() != Item.of(easterEgg.flower)) return;
  if (player.getArmorSlots().length != easterEgg.armor.length) return;

  let armor = player.getArmorSlots();
  for (let i = 0; i < armor.length; i++) {
    if (armor[i] != Item.of(easterEgg.armor[i])) {
      return;
    }
  }
  player.persistentData.isPretty = true;
  player.give(easterEgg.reward);
  server.tell(
    Text.translate("kubejs.easter_egg.pretty_princess", [
      player.getDisplayName(),
    ])
  );
});

let $PostActionTypes = Java.loadClass(
  "snownee.lychee.util.action.PostActionTypes"
);
let thunderChance = 100;
PlayerEvents.tick((event) => {
  const { player, level, server } = event;
  if (server.getTickCount() % 20 !== 0) return;
  if (!level.isThundering()) return;
  if (
    player.getMainHandItem().id != "minecraft:lightning_rod" &&
    player.getOffHandItem().id != "minecraft:lightning_rod"
  )
    return;

  let chance = Math.floor(Math.random() * 100);

  if (chance < thunderChance) {
    let thunder = level.createEntity("minecraft:lightning_bolt");
    thunder.setPos(player.x, player.y, player.z);
    thunder.spawn();

    let recipes = level
      .getRecipeManager()
      .byType("lychee:lightning_channeling");
    let inventory = player.getInventory();

    recipes.forEach((recipe) => {
      let input = recipe
        .value()
        .ingredientCollection()
        .ingredients()[0]
        .getItems()[0];
      if (inventory.hasAnyOf(input)) {
        let actions = recipe.value().postActions();
        if (actions.length === 0) return;

        let slot = inventory.findSlotMatchingItem(input);
        let item = inventory.getItem(slot);
        let iterations = 1;
        item.shrink(input.getCount() * iterations);

        for (let i = 0; i < iterations; i++) {
          actions.forEach((action) => {
            if (action.type() === $PostActionTypes.DROP_ITEM) {
              let outputs = action.getOutputItems();
              outputs.forEach((output) => {
                player.give(output);
                // player.sendSystemMessage(Text.translate("kubejs.recipes.lightning_output", [Text.of(Item.of(input).displayName), Text.of(Item.of(output).displayName)]), true);;
              });
            }
          });
        }
      }
    });
  }
});

const $Vec3 = Java.loadClass("net.minecraft.world.phys.Vec3");

EntityEvents.afterHurt("minecraft:player", (event) => {
  const { player, level, server, source, damage } = event;

  switch (source.getType().toString()) {
    case "static_electric":
      if (Math.random() < 0.3) {
        let lightning = level.createEntity("minecraft:lightning_bolt");
        lightning.moveTo($Vec3.atBottomCenterOf(player.blockPosition()));
        // lightning.setVisualOnly(true);
        lightning.spawn();
        console.log("Lightning spawned due to static electric damage");
      }
      break;
  }
});

PlayerEvents.inventoryChanged((event) => {
  const { player, item, level } = event;

  if (
    level.dimension == "minecraft:the_nether" &&
    (item.id == "ftb:eye_of_legend")
  ) {
    swapItem(player, item.id.toString(), "ftb:eye_of_legend_nether");
  }  else if (
    level.dimension != "minecraft:the_nether" &&
    level.dimension != "minecraft:the_end" &&
    (item.id == "ftb:eye_of_legend_nether")
  ) {
    swapItem(player, item.id.toString(), "ftb:eye_of_legend");
  }
});
function swapItem(player, oldItem, newItem) {
  const inventory = player.inventory;
  for (let i = 0; i < inventory.containerSize; i++) {
    if (inventory.getItem(i) === oldItem) {
      inventory.setItem(i, newItem);
    }
  }
  player.sendInventoryUpdate();
}
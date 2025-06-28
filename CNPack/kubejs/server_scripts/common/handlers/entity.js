const $LivingEntity = Java.loadClass("net.minecraft.world.entity.LivingEntity");

// Cancel breaking and placing blocks in the overworld unless in creative mode
function cancelBlockActionsInOverworld(event) {
    const { level, player } = event;
    if (level.dimension === "minecraft:overworld" && (!player || !player.isCreative())) {
      event.cancel();
    }
  }

//Cancel placing blocks in overworld unless in creative
BlockEvents.placed((event) => {
  const { level, player, block } = event;
  if (level.dimension == "minecraft:overworld") {
    if (!player) event.cancel();
    if (!player.isCreative()) event.cancel();
  }
});


BlockEvents.placed("minecraft:end_portal_frame", (event) => {
  const { level, player, block } = event;
  //console.log("calling block placement event");
  if (level.dimension == "minecraft:the_nether") {
    if (!player.isCreative()) {
      player.tell("You can't place that in this dimension");
      block.set("minecraft:air");
      block.popItem("minecraft:end_portal_frame");
    }
  }
});

const allowedEntities = [
    "create:gantry_contraption", // explicitly whitelist known contraption types
    // add other entity types to whitelist here as needed
];

EntityEvents.spawned((event) => {
    const { entity } = event;
    if (entity.type == "minecraft:player") return;
    if (!(entity instanceof $LivingEntity)) return;

    const dimension = entity.level.dimension;
    if (dimension == "minecraft:overworld") {
        const typeId = entity.type.toString(); // Example: "minecraft:skeleton"



        if (!allowedEntities.includes(typeId)) {
            event.cancel();
        }
    }
});

const $LycheeContext = Java.loadClass("snownee.lychee.util.context.LycheeContext");
let $LycheeContextKey = Java.loadClass("snownee.lychee.util.context.LycheeContextKey");
const $LycheeRecipeTypes = Java.loadClass("snownee.lychee.RecipeTypes");
let $ItemEntity = Java.loadClass("net.minecraft.world.entity.item.ItemEntity");


EntityEvents.spawned(["minecraft:lightning_bolt", "ars_nouveau:an_lightning"], (event) => {
const { entity, level, server } = event;
let lightningBolt = entity;

let genericItem = level.createEntity("minecraft:item")
let items = level.getEntities(genericItem, AABB.of(entity.x - 1, entity.y - 1, entity.z - 1, entity.x + 1, entity.y + 1, entity.z + 1));
genericItem.discard(); // Clean up the generic item entity

if (items.length === 0) return;
items = items.stream().filter(it => it instanceof $ItemEntity)

let ctx = new $LycheeContext()
ctx.put($LycheeContextKey.LEVEL, level);

let lootParams = ctx.initLootParams($LycheeRecipeTypes.LIGHTNING_CHANNELING)
lootParams.set(LootContextParams.ORIGIN, lightningBolt.position());
lootParams.set(LootContextParams.THIS_ENTITY, lightningBolt);

$LycheeRecipeTypes.LIGHTNING_CHANNELING.process(items, ctx);
});


EntityEvents.spawned("minecraft:eye_of_ender", (event) => {
  const { entity, server } = event;
  if (entity.getItem().id != "ftb:eye_of_legend" && entity.getItem().id != "ftb:eye_of_legend_nether") return;
  let dimension = entity.level.dimension;
  server.scheduleInTicks(4 * 20, (_) => {
    const { x, y, z } = entity;
    entity.kill();
    let command = `execute in ${dimension} run particle minecraft:reverse_portal ${Math.floor(x)} ${Math.floor(
      y
    )} ${Math.floor(z)} 0 0 0 0.8 50 force`;
    server.runCommandSilent(command);
  });
});


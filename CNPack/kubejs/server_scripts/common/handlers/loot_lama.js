const llamaLootTables = {
    "iron": {
        "food_item": "minecraft:iron_ingot",
        "loot_table": "geore:blocks/iron_cluster",
        "chance": 0.5
    },
    "gold": {
        "food_item": "minecraft:gold_ingot",
        "loot_table": "geore:blocks/gold_cluster",
        "chance": 0.5
    },
    "copper": {
        "food_item": "minecraft:copper_ingot",
        "loot_table": "geore:blocks/copper_cluster",
        "chance": 0.5
    },
    "diamond": {
        "food_item": "minecraft:diamond",
        "loot_table": "geore:blocks/diamond_cluster",
        "chance": 0.5
    },
    "emerald": {
        "food_item": "minecraft:emerald",
        "loot_table": "geore:blocks/emerald_cluster",
        "chance": 0.5
    },
    "lapis": {
        "food_item": "minecraft:lapis_lazuli",
        "loot_table": "geore:blocks/lapis_cluster",
        "chance": 0.5
    },
    "redstone": {
        "food_item": "minecraft:redstone",
        "loot_table": "geore:blocks/redstone_cluster",
        "chance": 0.5
    },
    "coal": {
        "food_item": "minecraft:coal",
        "loot_table": "geore:blocks/coal_cluster",
        "chance": 0.5
    },
    "quartz": {
        "food_item": "minecraft:quartz",
        "loot_table": "geore:blocks/quartz_cluster",
        "chance": 0.5
    },
    "amethyst": {
        "food_item": "minecraft:amethyst_shard",
        "loot_table": "geore:blocks/amethyst_cluster",
        "chance": 0.5
    },
    "slime": {
        "food_item": "minecraft:slime_block",
        "loot_table": "minecraft:entities/slime",
        "chance": 0.5
    },
    "glowstone": {
        "food_item": "minecraft:glowstone_dust",
        "loot_table": "minecraft:blocks/glowstone",
        "chance": 0.5
    },
    "food": {
        "food_item": "minecraft:golden_apple",
        "loot_table": "ftb:llama_food",
        "chance": 1
    }
}

ItemEvents.entityInteracted(Object.values(llamaLootTables).map(entry => entry.food_item), event => {
    const {item, player, target, level, server} = event;
    if (target.type != "llamapalooza:loot_llama") return;

    const loottable = Object.values(llamaLootTables).find(entry => entry.food_item === item.id);
    if (!loottable) return;

    if (target.getLootID().toString() === loottable.loot_table) event.cancel();
    const chance = Math.random();
    if (chance < loottable.chance) {
        target.setLootTable(loottable.loot_table);
        level.spawnParticles("minecraft:heart", true, target.x, target.y+1, target.z, 0.5, 0.5, 0.5, 10, 0.5);
        player.sendSystemMessage(Text.translate("kubejs.loot_llama.success", [Text.translate(Item.of(item.id).descriptionId)]).green(), true);
        let key = Object.keys(llamaLootTables).find(key => llamaLootTables[key].food_item === item.id);
        let capKey = key.charAt(0).toUpperCase() + key.slice(1);
        target.setCustomName(Text.of("Loot Lama - " + capKey));

    }else{
        level.spawnParticles("minecraft:smoke", true, target.x, target.y+1, target.z, 0.4, 0.75, 0.4, 25, 0.01);
        player.sendSystemMessage(Text.translate("kubejs.loot_llama.fail", [Text.translate(Item.of(item.id).descriptionId)]).red(), true);


    }
})
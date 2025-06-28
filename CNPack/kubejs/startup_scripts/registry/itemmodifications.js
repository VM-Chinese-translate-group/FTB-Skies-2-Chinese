// priority: 999

const maxStackSizeItems = [
  "minecraft:egg",
  "minecraft:snowball",
  "minecraft:ender_pearl",
  "minecraft:experience_bottle",
  "minecraft:fire_charge",
];

ItemEvents.modification((event) => {
  event.modify("geore:coal_shard", (item) => (item.burnTime = 0));
  maxStackSizeItems.forEach((stackItem) => {
    event.modify(stackItem, (item) => {
      item.maxStackSize = 64;
    });
  });
});

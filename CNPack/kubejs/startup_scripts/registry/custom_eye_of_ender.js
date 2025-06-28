const $EyeofEnder = Java.loadClass("net.minecraft.world.entity.projectile.EyeOfEnder");
const $Registry = Java.loadClass("net.minecraft.core.registries.Registries");
const $TagKey = Java.loadClass("net.minecraft.tags.TagKey");


NativeEvents.onEvent("net.neoforged.neoforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent", event => {
        let dim = event.getTo()
    let player = event.getEntity()
    switch (dim) {
        case 'minecraft:the_nether':
            swapItem(player, 'ftb:eye_of_legend', 'ftb:eye_of_legend_nether')
            swapItem(player, 'ftb:eye_of_legend_end', 'ftb:eye_of_legend_nether')
            break;
        case 'minecraft:the_end':
            swapItem(player, 'ftb:eye_of_legend', 'ftb:eye_of_legend_end')
            swapItem(player, 'ftb:eye_of_legend_nether', 'ftb:eye_of_legend_end')
            break;
        default:
            swapItem(player, 'ftb:eye_of_legend_nether', 'ftb:eye_of_legend')
            swapItem(player, 'ftb:eye_of_legend_end', 'ftb:eye_of_legend')
    }
})

function swapItem(player, oldItem, newItem) {
  const inventory = player.inventory;
  for (let i = 0; i < inventory.containerSize; i++) {
    if (inventory.getItem(i) === oldItem) {
      inventory.setItem(i, newItem);
    }
  }
  player.sendInventoryUpdate();
}



const eyes = [
    {"id": "ftb:eye_of_legend", "displayName": "Eye of Legend", "structureTag": "ftb:legendlocator"},
    {"id": "ftb:eye_of_legend_nether", "displayName": "Nether Eye of Legend", "structureTag": "ftb:legendlocator"},
]

StartupEvents.registry('item', event => {

    eyes.forEach(eye => {
        event.create(eye.id).displayName(eye.displayName).unstackable()
        .use((level, player, interactionHand) => global.useEye(level, player, interactionHand, eye))
   
})

})

global.useEye = (level, player, interactionHand, eye) => {
            let item = player.getHeldItem(interactionHand)
            player.startUsingItem(interactionHand)
            if (!level.isClientSide()) {
                let structureTag = $TagKey.create($Registry.STRUCTURE, eye.structureTag)
                let foundPos = level.findNearestMapStructure(structureTag, player.blockPosition(), 100, false)
                if (foundPos) {
                    console.log(`Spawning Eye of Ender at ${player.blockPosition()} towards structure at ${foundPos}`)
                    let eye = new $EyeofEnder(level, player.getX(), player.getY(0.5), player.getZ())
                    eye.setItem(item)
                    eye.signalTo(foundPos)
                    eye.spawn()
                    return true
                }
            } else {
                player.swing(interactionHand)
                player.addItemCooldown(Item.of(eye.id), 10*20)
            }
            return false
        }
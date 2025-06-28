let advanced_coke_oven

MIMachineEvents.registerRecipeTypes(event => {
    advanced_coke_oven = event.register('advanced_coke_oven')
        .withItemInputs()
        .withFluidInputs()
        .withFluidOutputs()
        .withItemOutputs()
})

MIMachineEvents.registerMachines(event => {

    const bricks = event.memberOfBlock('minecraft:bricks')
    const fire = event.memberOfBlock('occultism:spirit_fire')
    const iron_bars = event.memberOfBlock('minecraft:iron_bars')
    const coke_bricks = event.memberOfBlock('immersiveengineering:cokebrick')
    const hatchBlock = event.hatchOf('item_input', 'item_output', 'energy_input', 'fluid_output')

    const multiblock_shape = event.layeredShape('bricks_casing', [
        ['CBC', 'HEH', 'CBC'],
        ['BBB', 'EFE', 'BIB'],
        ['CBC', 'H#H', 'CBC'],
    ])
        .key('C', coke_bricks, event.noHatch())
        .key('B', bricks, event.noHatch())
        .key('F', fire, event.noHatch())
        .key('I', iron_bars, event.noHatch())
        .key('H', coke_bricks, hatchBlock)
        .key('E', bricks, hatchBlock)
        .build()

    event.simpleElectricCraftingMultiBlock(
        'Advanced Coke Oven', /* Translated Name */
        'advanced_coke_oven', /* Internal Name */
        advanced_coke_oven, /* Recipe Name */
        multiblock_shape, /* Multiblock Shape */
        /* JEI DISPLAY CONFIGURATION */
        // JEI progress bar
        event.progressBar(77, 33, "arrow"),
        // JEI item inputs, item outputs, fluid inputs, fluid outputs
        itemInputs => itemInputs.addSlots(56, 35, 1, 2), itemOutputs => itemOutputs.addSlot(102, 35),
        fluidInputs => fluidInputs.addSlot(36, 35), fluidOutputs => fluidOutputs.addSlot(122, 35),
        /* MODEL CONFIGUATION */
        // casing of the controller, overlay folder, front overlay?, top overlay?, side overlay?
        'bricks_casing', 'multiblockd', true, false, false
    )
})
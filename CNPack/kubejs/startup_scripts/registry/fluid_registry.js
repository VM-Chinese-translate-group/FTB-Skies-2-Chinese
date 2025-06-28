// const $KubeFluidType = Java.loadClass("dev.latvian.mods.kubejs.fluid.FluidTypeBuilder")
StartupEvents.registry("fluid", (event) => {

    event.create('ftb:molten_kivi')
    .displayName("Molten Kivi")        
    .stillTexture("ftb:fluid/kivi_still")          
    .flowingTexture("ftb:fluid/kivi_flow")          
    .tint(0x0d0e0f)

});
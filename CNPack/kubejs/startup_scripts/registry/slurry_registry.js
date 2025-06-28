// priority: 9999

const $Slurry = Java.loadClass("mekanism.api.chemical.Chemical");
const $SlurryBuilder = Java.loadClass("mekanism.api.chemical.ChemicalBuilder");

StartupEvents.registry("mekanism:chemical", (event) => {
	global.slurrys.forEach(([ore, dirtyColor, cleanColor]) => {
		event.createCustom(
			`${global.registry_prefix}:dirty_${ore}`,
			() =>
				new $Slurry(
					$SlurryBuilder.dirtySlurry().tint(dirtyColor).ore(`kubejs:ore/${ore}`)
				)
		);
		event.createCustom(
			`${global.registry_prefix}:clean_${ore}`,
			() =>
				new $Slurry(
					$SlurryBuilder.cleanSlurry().tint(cleanColor).ore(`kubejs:ore/${ore}`)
				)
		);
	});
});

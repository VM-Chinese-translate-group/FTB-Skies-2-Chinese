// priority: 1002

Platform.mods.kubejs.name = "FTB Skies 2";
Platform.getInfo("ftb").name = "FTB Skies 2";

StartupEvents.registry("item", (event) => {
	const items = [
		{ id: "ender_apple", name: "Ender Apple" },
		{ id: "ultimate_singularity", name: "Ultimate Singularity" },
		{
			id: "music_disc",
			name: "FTB Evolution - Block vs Block",
			isDisc: true,
			sound: "ftb:blockvblock"
		},
		{ id: "skill_reset_magic", name: "Magic Skill Reset Sigil" },
		{ id: "skill_reset_melee", name: "Melee Skill Reset Sigil" },
		{ id: "skill_reset_ranged", name: "Ranged Skill Reset Sigil" },
		{ id: "skill_reset_athletics", name: "Atheletics Skill Reset Sigil" },
		{ id: "skill_reset_mining", name: "Mining Skill Reset Sigil" },
		{ id: "skill_reset_defense", name: "Defense Skill Reset Sigil" },
		{ id: "elemental_arcanite", name: "Elemental Arcanite" },
		{
			id: "incomplete_elemental_arcanite",
			name: "Incomplete Elemental Arcanite"
		},
		{
			id: "incomplete_evolutionary_matter",
			name: "Incomplete Evolutionary Matter"
		},
		{ id: "primal_essence", name: "Primal Essence" },
		{ id: "omega_dragon_egg", name: "Omega Dragon Egg" },
		{ id: "evolutionary_matter", name: "Evolutionary Matter" },
		{ id: "bio_neural_circuit", name: "Bio-Neural Circuit" },
		{ id: "evolutionary_arcanum", name: "Evolutionary Arcanum" },
		{ id: "mekanized_super_computer", name: "Mekanized Super Computer" },
		{ id: "ender_transmitter", name: "Ender Transmitter" },
		{ id: "creative_ascension", name: "Creative Ascension" },
		{ id: "dissolved_potential", name: "Dissolved Potential" },
		{ id: "realized_transcendence", name: "Realized Transcendence" },
		{ id: "ethereal_essence", name: "Ethereal Essence" },

		{
			id: "infinitely_compressed_circuit_board",
			name: "Infinitely Compressed Circuit Board"
		},
		{ id: "time_prism", name: "Time Prism" },
		{ id: "prismatic_xychorium", name: "Prismatic Xychorium" },
		{ id: "dimensional_memory_fragment", name: "Dimensional Memory Fragment" },
		{ id: "supercritical_mass", name: "Supercritical Mass" },
		{ id: "kelp_goo", name: "Kelp Resin" },
		{ id: "firestick", name: "Firestick" }
	];

	items.forEach((item) => {
		const createdItem = event
			.create(`ftb:${item.id}`)
			.displayName(item.name)
			.rarity("epic");
		if (item.isDisc) {
			createdItem.jukeboxPlayable(item.sound, true);
		}
	});
});

StartupEvents.modifyCreativeTab("kubejs:tab", (event) => {
	event.displayName = "Feed The Beast";
});

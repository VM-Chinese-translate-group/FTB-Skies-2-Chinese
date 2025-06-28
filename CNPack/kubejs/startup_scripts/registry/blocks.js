// priority: 1003

StartupEvents.registry("block", (e) => {
	const defaultHardness = 1;
	const defaultRequiresTool = false;

	const blocks = [
		{
			name: "ftb:pyramid_base",
			displayName: "FTB Pyramid Base",
			hardness: 2,
			requiresTool: true,
			tags: ["mineable/axe", "mineable/pickaxe"]
		},
		{
			name: "ftb:pyra_mid_lower",
			displayName: "FTB Pyramid Mid Lower",
			hardness: 2,
			requiresTool: true,
			tags: ["mineable/axe", "mineable/pickaxe"]
		},
		{
			name: "ftb:pyra_mid_upper",
			displayName: "FTB Pyramid Mid Upper",
			hardness: 2,
			requiresTool: true,
			tags: ["mineable/axe", "mineable/pickaxe"]
		},
		{
			name: "ftb:pyramid_top",
			displayName: "FTB Pyramid Top",
			hardness: 2,
			requiresTool: true,
			tags: ["mineable/axe", "mineable/pickaxe"]
		},
		{
			name: "ftb:faux_amethyst_block",
			displayName: "Block of Amethyst (Faux)",
			hardness: 0.4,
			soundType: SoundType.AMETHYST
		},
		{
			name: "ftb:andesite_amalgam_block",
			displayName: "Block of Andesite Amalgam",
			hardness: 5,
			requiresTool: true,
			tags: ["mineable/pickaxe"]
		},
		{
			name: "ftb:calcified_prospertity_stone",
			displayName: "Block of Calcified Prospertity",
			hardness: 2,
			requiresTool: true,
			tags: ["mineable/pickaxe"]
		},
		{
			name: "ftb:void_crystal_catalyst",
			displayName: "Void Crystal Catalyst",
			hardness: 5,
			requiresTool: true,
			tags: ["mineable/pickaxe"]
		},
		{
			name: "ftb:crushed_kivi",
			displayName: "Crushed Kivi",
			hardness: 5,
			requiresTool: true,
			tags: ["mineable/pickaxe"]
		},		
	];

	blocks.forEach((block) => {
		let b = e.create(block.name)
			.displayName(block.displayName)
			.hardness(block.hardness !== undefined ? block.hardness : defaultHardness);

		if (block.requiresTool !== undefined ? block.requiresTool : defaultRequiresTool) b.requiresTool(true);
		if (block.tags && Array.isArray(block.tags)) {
			block.tags.forEach(tag => b.tagBlock(tag));
		}
		if (block.soundType) b.soundType(block.soundType);
	});
});

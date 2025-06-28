RecipeViewerEvents.removeCategories((event) => {
  const removeCategories = [
    "create:automatic_shapeless",
    "create:automatic_shaped",
    "create:automatic_packaging",
    "create:automatic_packing",
  ];

  removeCategories.forEach((catid) => {
    // console.log('Removing category id for: ' + catid)
    event.remove(catid);
  });
});

const itemInfoPairs = [
  {
    items: ["ae2:sky_dust"],
    langKey: "ftb.iteminfo.sky_dust",
  },
  {
    items: ["minecraft:nether_star"],
    langKey: "ftb.iteminfo.nether_star",
  },
  {
    items: ["enderio:grains_of_infinity"],
    langKey: "ftb.iteminfo.grains_of_infinity",
  },
  {
    items: ["supplementaries:ash"],
    langKey: "ftb.iteminfo.supplementaries.ash",
  },

];

RecipeViewerEvents.addEntries('item', event => {
	event.add('supplementaries:ash');
})

RecipeViewerEvents.addInformation("item", (event) => {
  itemInfoPairs.forEach((pair) => {
    const translatedText = Text.translate(pair.langKey);
    event.add(pair.items, [translatedText]);
  });

  // Add a summary info entry under the void catalyst itself
  const catalystInfo = [Text.translate("ftb.geode_catalyst.intro")];

  for (const entry of global.get("dyeToGeode")) {
    let geodeItem = entry.geode;
    let dyeItem = entry.dye;
    let dyeName = dyeItem.replace("minecraft:", "").replace("_dye", "");

    event.add([geodeItem], [Text.translate(`ftb.geode_info.${dyeName}`)]);

    catalystInfo.push(Text.translate(`ftb.geode_catalyst.line.${dyeName}`));
  }
  event.add(["ftb:void_crystal_catalyst"], catalystInfo);
});

RecipeViewerEvents.removeEntries("item", (event) => {
  event.remove(/.*camo_application.*/);
});
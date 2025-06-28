StartupEvents.registry('item', event => {
  const meshTypes = [
    { id: 'cloth', name: 'Mechanical Cloth Mesh' },
    { id: 'iron', name: 'Mechanical Iron Mesh' },
    { id: 'gold', name: 'Mechanical Gold Mesh' },
    { id: 'diamond', name: 'Mechanical Diamond Mesh' },
    { id: 'blazing', name: 'Mechanical Blazing Mesh' }
  ];

  for (const mesh of meshTypes) {
    event.create(`ftb:${mesh.id}_mesh`, 'createsifter:mesh')
      .displayName(mesh.name)
      .parentModel('createsifter:block/meshes/mesh')
      .texture('mesh', `ftb:item/${mesh.id}_mesh`)
      .maxDamage(1000);
  }
});

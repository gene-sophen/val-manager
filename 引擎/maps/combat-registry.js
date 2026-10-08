// Explicit imports keep Node and browser using exactly the same frozen map data.
const {GameMap}=require('../gamemap');
const entries={
 haven:{data:require('./haven-combat-v6.json'),geometry:require('./haven-geometry-v6.json')},
 split:{data:require('./split-combat-v6.json'),geometry:require('./split-geometry-v6.json')},
 sunset:{data:require('./sunset-combat-v6.json'),geometry:require('./sunset-geometry-v6.json')},
 breeze:{data:require('./breeze-combat-v6.json'),geometry:require('./breeze-geometry-v6.json')},
 lotus:{data:require('./lotus-combat-v6.json'),geometry:require('./lotus-geometry-v6.json')},
 fracture:{data:require('./fracture-combat-v6.json'),geometry:require('./fracture-geometry-v6.json')},
 abyss:{data:require('./abyss-combat-v6.json'),geometry:require('./abyss-geometry-v6.json')},
 summit:{data:require('./summit-combat-v6.json'),geometry:require('./summit-geometry-v6.json')},
};
const maps={};function get(id){if(!entries[id])throw Error('未知战斗地图：'+id);return maps[id]??=new GameMap(entries[id].data,entries[id].geometry);}
function byLayout(version){const item=Object.values(entries).find(e=>e.data.layoutVersion===version);return item?.data||null;}
module.exports={entries,get,byLayout,ids:Object.keys(entries)};

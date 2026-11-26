// M187: the load screen's fruit pictures, drawn from the game's own item icons (sprites/items.ts ITEM_ICONS + palettes):
// prints each fruit's 32x32 indices + palette as JSON; scripts/m187-fruit-icons.py paints them x4 (nearest) to
// public/open/load/fruit-<id>.png.   npx tsx scripts/m187-fruit-icons.mts | python3 scripts/m187-fruit-icons.py
import { ITEM_ICONS, paletteForItem } from '../src/app/shimmer/sprites/items'
import { LOAD_FRUIT } from '../src/app/shimmer/open/shared/load-fruit'
console.log(JSON.stringify(Object.fromEntries(LOAD_FRUIT.map(id => [id, { px: [...ITEM_ICONS[id].frames[0]], pal: paletteForItem(id) }]))))

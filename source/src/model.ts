import { armorSlots, classNames, energyNames, SLOTS, weaponSlots, type Catalog, type Hash, type SlotKey } from './data';

export const storedCells = 9;

export type Cell = 'equipped' | number;

export interface ItemState
{
  hash: Hash;
  plugs: Record<number, Hash>;
}

export interface SlotState
{
  equipped: ItemState | null;
  stored: (ItemState | null)[];
}

export interface Character
{
  classType: number;
  raceType: number;
  genderType: number;
  emblem: Hash;
  gear: Record<SlotKey, SlotState>;
}

export interface Loadout
{
  name: string;
  clan: string;
  clanTag: string;
  characters: Character[];
}

export const clanTagMax = 4;
export const cleanClanTag = (v: string) => v.replace(/[^\p{L}\p{N}]/gu, '').slice(0, clanTagMax);

export const characterCount = 3;

export const emptySlot = (): SlotState => ({ equipped: null, stored: Array(storedCells).fill(null) });

export function emptyGear(): Record<SlotKey, SlotState>
{
  return Object.fromEntries(SLOTS.map((s) => [s.key, emptySlot()])) as Record<SlotKey, SlotState>;
}

export function newCharacter(catalog: Catalog, classType: number): Character
{
  const gear = emptyGear();
  for (const [slot, hash] of Object.entries(catalog.defaultGear(classType)) as [SlotKey, Hash][])
  {
    gear[slot].equipped = newItem(catalog, hash);
  }
  return { classType, raceType: 0, genderType: 0, emblem: catalog.defaultEmblem(classType), gear };
}

export function newLoadout(catalog: Catalog): Loadout
{
  return { name: '', clan: '', clanTag: '', characters: [0, 1, 2].map((c) => newCharacter(catalog, c)) };
}

export const cellItem = (slot: SlotState, cell: Cell) => (cell === 'equipped' ? slot.equipped : slot.stored[cell] ?? null);

export function newItem(catalog: Catalog, hash: Hash): ItemState
{
  const plugs: Record<number, Hash> = {};
  for (const s of catalog.item(hash)?.sockets ?? []) plugs[s.index] = s.def;
  return masterworked(catalog, { hash, plugs });
}

const best = (hashes: Hash[], score: (h: Hash) => number): Hash | undefined =>
  hashes.reduce<Hash | undefined>((top, h) => (top === undefined || score(h) > score(top) ? h : top), undefined);

export function masterworked(catalog: Catalog, state: ItemState): ItemState
{
  const def = catalog.item(state.hash);
  if (!def) return state;
  let plugs = state.plugs;
  for (const s of def.sockets ?? [])
  {
    const pool = catalog.pool(s);
    const current = state.plugs[s.index];
    let top: Hash | undefined;
    if (s.kind === 'energy')
    {
      const type = catalog.energyOf(current)?.type;
      top = best(pool.filter((h) => catalog.energyOf(h)?.type === type), (h) => catalog.energyOf(h)!.capacity);
    }
    else if (s.kind === 'armorMasterwork' || s.kind === 'masterwork')
    {
      const tiers = pool.filter((h) => catalog.plug(h)?.stat);
      if (tiers.length && (catalog.plug(current)?.stat || s.kind === 'armorMasterwork'))
      {
        const stat = catalog.plug(current)?.stat?.[0] ?? catalog.plug(tiers[0])!.stat![0];
        top = best(tiers.filter((h) => catalog.plug(h)!.stat![0] === stat), (h) => catalog.plug(h)!.stat![1]);
      }
      else if (s.kind === 'armorMasterwork')
      {
        top = pool.find((h) => catalog.plug(h)?.name === 'Masterwork Armor');
      }
    }
    if (top !== undefined && top !== current) plugs = { ...plugs, [s.index]: top };
  }
  return plugs === state.plugs ? state : { ...state, plugs };
}

export function changeVersion(catalog: Catalog, from: ItemState, hash: Hash): ItemState
{
  const next = newItem(catalog, hash);
  for (const s of catalog.item(hash)?.sockets ?? [])
  {
    const old = from.plugs[s.index];
    if (old !== undefined && catalog.pool(s).includes(old)) next.plugs[s.index] = old;
  }
  return masterworked(catalog, next);
}

export type Action =
  | { type: 'replace'; loadout: Loadout }
  | { type: 'guardian'; name?: string; clan?: string; clanTag?: string }
  | { type: 'identity'; character: number; raceType?: number; genderType?: number }
  | { type: 'emblem'; character: number; emblem: Hash }
  | { type: 'item'; character: number; slot: SlotKey; cell: Cell; item: ItemState | null }
  | { type: 'equip'; character: number; slot: SlotKey; cell: number }
  | { type: 'character'; character: number; value: Character };

export function reduce(state: Loadout, action: Action): Loadout
{
  const withCharacter = (index: number, change: (c: Character) => Character): Loadout => ({
    ...state,
    characters: state.characters.map((c, i) => (i === index ? change(c) : c)),
  });
  const withSlot = (index: number, slot: SlotKey, change: (s: SlotState) => SlotState) =>
    withCharacter(index, (c) => ({ ...c, gear: { ...c.gear, [slot]: change(c.gear[slot]) } }));

  switch (action.type)
  {
    case 'replace':
      return action.loadout;
    case 'guardian':
      return {
        ...state,
        name: action.name ?? state.name,
        clan: action.clan ?? state.clan,
        clanTag: action.clanTag !== undefined ? cleanClanTag(action.clanTag) : state.clanTag,
      };
    case 'identity':
      return withCharacter(action.character, (c) => ({
        ...c,
        raceType: action.raceType ?? c.raceType,
        genderType: action.genderType ?? c.genderType,
      }));
    case 'emblem':
      return withCharacter(action.character, (c) => ({ ...c, emblem: action.emblem }));
    case 'item':
      return withSlot(action.character, action.slot, (s) =>
        action.cell === 'equipped'
          ? { ...s, equipped: action.item }
          : { ...s, stored: s.stored.map((x, i) => (i === action.cell ? action.item : x)) },
      );
    case 'equip':
      return withSlot(action.character, action.slot, (s) => ({
        equipped: s.stored[action.cell],
        stored: s.stored.map((x, i) => (i === action.cell ? s.equipped : x)),
      }));
    case 'character':
      return withCharacter(action.character, () => action.value);
  }
}

export interface Problem
{
  slot?: SlotKey;
  cell?: Cell;
  message: string;
}

export interface EnergyUse
{
  type: number;
  capacity: number;
  used: number;
}

export function energyUse(catalog: Catalog, item: ItemState): EnergyUse | undefined
{
  const def = catalog.item(item.hash);
  const socket = def?.sockets?.find((s) => s.kind === 'energy');
  if (!socket) return undefined;
  const energy = catalog.energyOf(item.plugs[socket.index]);
  if (!energy) return undefined;
  let used = 0;
  for (const s of def!.sockets!)
  {
    if (s.kind !== 'mod') continue;
    used += catalog.plug(item.plugs[s.index])?.cost?.[0] ?? 0;
  }
  return { ...energy, used };
}

export function itemProblems(catalog: Catalog, item: ItemState, classType: number): string[]
{
  const def = catalog.item(item.hash);
  if (!def) return [`Unknown item ${item.hash}`];
  const out: string[] = [];
  if (def.classType !== undefined && def.classType !== 3 && def.classType !== classType)
  {
    out.push(`${classNames[def.classType]} armor on a ${classNames[classType]}`);
  }
  const energy = energyUse(catalog, item);
  if (energy)
  {
    if (energy.used > energy.capacity) out.push(`Mods cost ${energy.used} energy, armor holds ${energy.capacity}`);
    for (const s of def.sockets ?? [])
    {
      if (s.kind !== 'mod') continue;
      const cost = catalog.plug(item.plugs[s.index])?.cost;
      if (cost && cost[1] !== 0 && cost[1] !== energy.type)
      {
        out.push(`${catalog.plug(item.plugs[s.index])!.name} needs ${energyNames[cost[1]]} armor`);
      }
    }
  }
  return out;
}

export function characterProblems(catalog: Catalog, c: Character): Problem[]
{
  const out: Problem[] = [];
  for (const slot of SLOTS)
  {
    const s = c.gear[slot.key];
    const cells: [Cell, ItemState | null][] = [['equipped', s.equipped], ...s.stored.map((x, i) => [i, x] as [Cell, ItemState | null])];
    for (const [cell, item] of cells)
    {
      if (!item) continue;
      for (const message of itemProblems(catalog, item, c.classType)) out.push({ slot: slot.key, cell, message });
    }
  }
  const exotics = (slots: typeof SLOTS, label: string) =>
  {
    const equipped = slots.filter((s) =>
    {
      const item = c.gear[s.key].equipped;
      return item && catalog.item(item.hash)?.tier === 6;
    });
    if (equipped.length > 1)
    {
      out.push({ message: `Only one exotic ${label} can be equipped (${equipped.map((s) => s.label).join(', ')})` });
    }
  };
  exotics(weaponSlots, 'weapon');
  exotics(armorSlots, 'armor piece');
  return out;
}

export function topTiers(catalog: Catalog, pool: Hash[]): Hash[]
{
  const top = new Map<Hash, Hash>();
  for (const h of pool)
  {
    const stat = catalog.plug(h)?.stat;
    if (!stat) continue;
    const seen = top.get(stat[0]);
    if (seen === undefined || stat[1] > catalog.plug(seen)!.stat![1]) top.set(stat[0], h);
  }
  return [...top.values()];
}

export type Hash = number;

export type SlotKey = 'kinetic' | 'energy' | 'power' | 'helmet' | 'arms' | 'chest' | 'legs' | 'class';
export type ItemSlot = SlotKey | 'emblem';

export type SocketKind =
  | 'intrinsic'
  | 'perk'
  | 'mod'
  | 'masterwork'
  | 'armorMasterwork'
  | 'energy'
  | 'shader'
  | 'ornament'
  | 'tracker'
  | 'cosmetic'
  | 'other';

export interface SocketDef
{
  index: number;
  kind: SocketKind;
  def: Hash;
  pool: number;
  random?: 1;
}

export interface ItemDef
{
  name: string;
  slot: ItemSlot;
  tier: number;
  type?: string;
  icon?: string;
  source?: string;
  unique?: string;
  sockets?: SocketDef[];
  random?: 1;
  y1?: 1;
  damage?: number;
  ammo?: number;
  classType?: number;
  armor2?: 1;
  season?: string;
  nameplate?: string;
  color?: [number, number, number];
}

export interface PlugDef
{
  name: string;
  icon?: string;
  type?: string;
  category: string;
  description?: string;
  cost?: [number, number];
  capacity?: [number, number];
  stat?: [Hash, number];
  exotic?: 1;
}

export interface Named
{
  hash: Hash;
  type: number;
  name: string;
}

export interface Data
{
  meta: {
    season: number;
    seasonName: string;
    manifestVersion: string;
    manifestSource: string;
    iconSource: string;
    generated: string;
  };
  classes: Named[];
  races: (Named & { gendered?: Record<string, string> })[];
  genders: Named[];
  energyTypes: (Named & { icon?: string })[];
  damageTypes: (Named & { icon?: string })[];
  ammoTypes: (Named & { icon?: string })[];
  defaultEmblems: Hash[];
  defaultGear: Record<SlotKey, Hash>[];
  stats: Record<string, string>;
  items: Record<string, ItemDef>;
  plugs: Record<string, PlugDef>;
  pools: Hash[][];
}

export interface SlotMeta
{
  key: SlotKey;
  label: string;
  bucket: Hash;
  equipSlot: number;
  weapon: boolean;
}

export const SLOTS: SlotMeta[] = [
  { key: 'kinetic', label: 'Kinetic', bucket: 1498876634, equipSlot: 0, weapon: true },
  { key: 'energy', label: 'Energy', bucket: 2465295065, equipSlot: 1, weapon: true },
  { key: 'power', label: 'Power', bucket: 953998645, equipSlot: 2, weapon: true },
  { key: 'helmet', label: 'Helmet', bucket: 3448274439, equipSlot: 3, weapon: false },
  { key: 'arms', label: 'Gauntlets', bucket: 3551918588, equipSlot: 4, weapon: false },
  { key: 'chest', label: 'Chest Armor', bucket: 14239492, equipSlot: 5, weapon: false },
  { key: 'legs', label: 'Leg Armor', bucket: 20886954, equipSlot: 6, weapon: false },
  { key: 'class', label: 'Class Item', bucket: 1585787867, equipSlot: 7, weapon: false },
];
export const weaponSlots = SLOTS.filter((s) => s.weapon);
export const armorSlots = SLOTS.filter((s) => !s.weapon);
export const emblemBucket = 4274335291;
export const emblemEquipSlot = 13;
export const slotMeta = (key: SlotKey) => SLOTS.find((s) => s.key === key)!;

export const tierNames: Record<number, string> = { 2: 'Common', 3: 'Uncommon', 4: 'Rare', 5: 'Legendary', 6: 'Exotic' };
export const damageNames: Record<number, string> = { 1: 'Kinetic', 2: 'Arc', 3: 'Solar', 4: 'Void' };
export const energyNames: Record<number, string> = { 0: 'Any', 1: 'Arc', 2: 'Solar', 3: 'Void' };
export const ammoNames: Record<number, string> = { 1: 'Primary', 2: 'Special', 3: 'Heavy' };
export const classNames: Record<number, string> = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };

export const icon = (path?: string) => (path ? `${import.meta.env.BASE_URL}${path}` : undefined);

export async function loadData(): Promise<Data>
{
  const res = await fetch(`${import.meta.env.BASE_URL}resources.json`);
  if (!res.ok) throw new Error(`Could not load item data (${res.status})`);
  return res.json();
}

export class Catalog
{
  readonly data: Data;
  readonly bySlot = new Map<ItemSlot, Hash[]>();
  readonly versions = new Map<Hash, Hash[]>();

  constructor(data: Data)
  {
    this.data = data;
    const groups = new Map<string, Hash[]>();
    for (const [key, item] of Object.entries(data.items))
    {
      const hash = Number(key);
      if (!this.bySlot.has(item.slot)) this.bySlot.set(item.slot, []);
      this.bySlot.get(item.slot)!.push(hash);
      const g = `${item.slot}|${item.classType ?? 3}|${item.name}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(hash);
    }
    for (const list of this.bySlot.values())
    {
      list.sort((a, b) =>
      {
        const x = data.items[a];
        const y = data.items[b];
        return y.tier - x.tier || x.name.localeCompare(y.name);
      });
    }
    for (const list of groups.values())
    {
      list.sort((a, b) => versionScore(data.items[b]) - versionScore(data.items[a]) || a - b);
      for (const h of list) this.versions.set(h, list);
    }
  }

  defaultEmblem(classType: number): Hash
  {
    return this.data.defaultEmblems[classType];
  }

  defaultGear(classType: number): Record<SlotKey, Hash>
  {
    return this.data.defaultGear[classType];
  }

  item(hash: Hash): ItemDef | undefined
  {
    return this.data.items[hash];
  }

  plug(hash: Hash): PlugDef | undefined
  {
    return this.data.plugs[hash];
  }

  pool(socket: SocketDef): Hash[]
  {
    return this.data.pools[socket.pool] ?? [];
  }

  groupsFor(slot: ItemSlot): Hash[]
  {
    return (this.bySlot.get(slot) ?? []).filter((h) => this.versions.get(h)?.[0] === h);
  }

  versionLabel(hash: Hash): string
  {
    const item = this.data.items[hash];
    if (!item) return String(hash);
    const parts: string[] = [];
    if (item.slot !== 'emblem' && !SLOTS.find((s) => s.key === item.slot)?.weapon)
    {
      if (!item.armor2) parts.push('A1');
      if (item.season) parts.push(`${item.season} mod slot`);
    }
    if (item.slot === 'kinetic' || item.slot === 'energy' || item.slot === 'power')
    {
      if (item.y1) parts.push('Y1');
      parts.push(item.random ? 'Random rolls' : 'Fixed roll');
    }
    parts.push(`#${hash}`);
    return parts.join(' · ');
  }

  damageOf(hash: Hash, plugs?: Record<number, Hash>): number | undefined
  {
    const item = this.data.items[hash];
    if (!item || item.damage === undefined) return undefined;
    for (const s of item.sockets ?? [])
    {
      const plug = plugs ? this.data.plugs[plugs[s.index]] : undefined;
      if (plug?.category.startsWith('v300.weapon.damage_type'))
      {
        const m = /^(Arc|Solar|Void) Damage Mod$/.exec(plug.name);
        if (m) return { Arc: 2, Solar: 3, Void: 4 }[m[1]];
      }
    }
    return item.damage;
  }

  energyOf(hash: Hash): { type: number; capacity: number } | undefined
  {
    const cap = this.data.plugs[hash]?.capacity;
    return cap ? { capacity: cap[0], type: cap[1] } : undefined;
  }
}

function versionScore(item: ItemDef): number
{
  let score = 0;
  if (item.armor2) score += 8;
  if (item.random) score += 4;
  if (!item.y1) score += 2;
  if (item.source) score += 2;
  if (item.sockets?.length) score += 1;
  if (item.icon) score += 0.5;
  return score;
}

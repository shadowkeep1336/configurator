import { classNames, emblemBucket, emblemEquipSlot, SLOTS, type Catalog, type Hash, type SlotKey } from './data';
import { characterCount, storedCells, cleanClanTag, emptyGear, masterworked, newCharacter, newItem, type Character, type ItemState, type Loadout } from './model';

export const FORMAT = 'shadowkeep-configurator';
export const VERSION = 2;

interface ExportSocket
{
  index: number;
  kind: string;
  plugHash: Hash;
  name: string;
}

interface ExportItem
{
  hash: Hash;
  name: string;
  sockets: ExportSocket[];
}

interface Ref
{
  type: number;
  hash: Hash;
  name: string;
}

export interface ExportFile
{
  format: typeof FORMAT;
  version: number;
  season: number;
  manifest: string;
  exported: string;
  guardian: { name: string; clan: string; clanTag: string };
  characters: {
    class: Ref;
    race: Ref;
    gender: Ref;
    emblem: { hash: Hash; name: string; bucket: Hash; equipSlot: number };
    gear: Record<SlotKey, { bucket: Hash; equipSlot: number; equipped: ExportItem | null; stored: ExportItem[] }>;
  }[];
}

export function exportLoadout(catalog: Catalog, loadout: Loadout): ExportFile
{
  const { data } = catalog;
  const ref = (list: { hash: Hash; type: number; name: string }[], type: number): Ref =>
  {
    const x = list.find((r) => r.type === type)!;
    return { type: x.type, hash: x.hash, name: x.name };
  };
  const item = (state: ItemState): ExportItem =>
  {
    const def = catalog.item(state.hash);
    return {
      hash: state.hash,
      name: def?.name ?? '',
      sockets: (def?.sockets ?? []).map((s) => ({
        index: s.index,
        kind: s.kind,
        plugHash: state.plugs[s.index] ?? s.def,
        name: catalog.plug(state.plugs[s.index] ?? s.def)?.name ?? '',
      })),
    };
  };
  return {
    format: FORMAT,
    version: VERSION,
    season: data.meta.season,
    manifest: data.meta.manifestVersion,
    exported: new Date().toISOString(),
    guardian: { name: loadout.name, clan: loadout.clan, clanTag: loadout.clanTag },
    characters: loadout.characters.map((c) => ({
      class: ref(data.classes, c.classType),
      race: ref(data.races, c.raceType),
      gender: ref(data.genders, c.genderType),
      emblem: { hash: c.emblem, name: catalog.item(c.emblem)?.name ?? '', bucket: emblemBucket, equipSlot: emblemEquipSlot },
      gear: Object.fromEntries(
        SLOTS.map((s) => [
          s.key,
          {
            bucket: s.bucket,
            equipSlot: s.equipSlot,
            equipped: c.gear[s.key].equipped ? item(c.gear[s.key].equipped!) : null,
            stored: c.gear[s.key].stored.filter((x): x is ItemState => !!x).map(item),
          },
        ]),
      ) as ExportFile['characters'][number]['gear'],
    })),
  };
}

export function downloadJson(file: ExportFile)
{
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = file.guardian.name.trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'guardian';
  a.href = url;
  a.download = `${slug}.shadowkeep.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult
{
  loadout: Loadout;
  warnings: string[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown, max = 64): string => (typeof v === 'string' ? v.slice(0, max) : '');

export function importLoadout(catalog: Catalog, text: string): ImportResult
{
  let raw: unknown;
  try
  {
    raw = JSON.parse(text);
  }
  catch (e)
  {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const root = obj(raw);
  if (!root) throw new Error('Expected a JSON object');
  if (root.format !== FORMAT) throw new Error(`Not a ${FORMAT} file (format is ${JSON.stringify(root.format)})`);
  const warnings: string[] = [];
  const version = num(root.version);
  if (version !== 1 && version !== VERSION) warnings.push(`File version ${String(root.version)}, expected ${VERSION}`);
  if (root.manifest !== catalog.data.meta.manifestVersion)
  {
    warnings.push(`File was made for manifest ${String(root.manifest)}, data is ${catalog.data.meta.manifestVersion}`);
  }

  const guardian = obj(root.guardian) ?? {};
  const loadout: Loadout = {
    name: str(guardian.name),
    clan: str(guardian.clan),
    clanTag: cleanClanTag(str(guardian.clanTag)),
    characters: Array.from({ length: characterCount }, (_, i) => newCharacter(catalog, i)),
  };

  const list = Array.isArray(root.characters) ? root.characters : [];
  const taken = new Set<number>();
  list.forEach((entry, i) =>
  {
    const src = obj(entry);
    if (!src)
    {
      warnings.push(`Character ${i + 1}: not an object, skipped`);
      return;
    }
    const cls = obj(src.class);
    const classType =
      catalog.data.classes.find((c) => c.type === num(cls?.type) || c.hash === num(cls?.hash))?.type ?? (i < characterCount ? i : undefined);
    if (classType === undefined)
    {
      warnings.push(`Character ${i + 1}: unknown class, skipped`);
      return;
    }
    if (taken.has(classType))
    {
      warnings.push(`Character ${i + 1}: a second ${classNames[classType]}, skipped`);
      return;
    }
    taken.add(classType);
    loadout.characters[classType] = importCharacter(catalog, src, classType, warnings);
  });
  return { loadout, warnings };
}

function importCharacter(catalog: Catalog, src: Json, classType: number, warnings: string[]): Character
{
  const { data } = catalog;
  const who = classNames[classType];
  const enumOf = (field: string, list: { type: number; hash: Hash }[]) =>
  {
    const r = obj(src[field]);
    const hit = list.find((x) => x.type === num(r?.type)) ?? list.find((x) => x.hash === num(r?.hash));
    if (!hit) warnings.push(`${who}: unknown ${field}, using default`);
    return hit?.type ?? 0;
  };
  const c: Character = {
    classType,
    raceType: enumOf('race', data.races),
    genderType: enumOf('gender', data.genders),
    emblem: catalog.defaultEmblem(classType),
    gear: emptyGear(),
  };

  const emblem = obj(src.emblem);
  if (emblem)
  {
    const hash = num(emblem.hash);
    if (hash !== undefined && catalog.item(hash)?.slot === 'emblem') c.emblem = hash;
    else warnings.push(`${who}: emblem ${String(emblem.hash)} is not a Season 11 emblem, using the default`);
  }

  const gear = obj(src.gear) ?? {};
  for (const slot of SLOTS)
  {
    const s = obj(gear[slot.key]);
    if (!s) continue;
    const where = `${who} ${slot.label}`;
    const equipped = obj(s.equipped);
    if (equipped) c.gear[slot.key].equipped = importItem(catalog, equipped, slot.key, classType, `${where} (equipped)`, warnings);
    const stored = Array.isArray(s.stored) ? s.stored : s.stored ? [s.stored] : [];
    if (stored.length > storedCells) warnings.push(`${where}: only ${storedCells} stored items fit, the rest were dropped`);
    let cell = 0;
    for (const entry of stored.slice(0, storedCells))
    {
      const item = obj(entry);
      if (!item) continue;
      const state = importItem(catalog, item, slot.key, classType, `${where} (stored)`, warnings);
      if (state) c.gear[slot.key].stored[cell++] = state;
    }
  }
  return c;
}

function importItem(
  catalog: Catalog,
  src: Json,
  slot: SlotKey,
  classType: number,
  where: string,
  warnings: string[],
): ItemState | null
{
  const hash = num(src.hash);
  const def = hash === undefined ? undefined : catalog.item(hash);
  if (hash === undefined || !def)
  {
    warnings.push(`${where}: item ${String(src.hash)} is not in Season 11 data, dropped`);
    return null;
  }
  if (def.slot !== slot)
  {
    warnings.push(`${where}: ${def.name} belongs in ${def.slot}, dropped`);
    return null;
  }
  if (def.classType !== undefined && def.classType !== 3 && def.classType !== classType)
  {
    warnings.push(`${where}: ${def.name} is ${classNames[def.classType]} armor, dropped`);
    return null;
  }
  const state = newItem(catalog, hash);
  const sockets = Array.isArray(src.sockets) ? (src.sockets.map(obj).filter(Boolean) as Json[]) : [];
  for (const s of sockets)
  {
    const index = num(s.index);
    const plug = num(s.plugHash);
    const socket = def.sockets?.find((x) => x.index === index);
    if (!socket || plug === undefined)
    {
      warnings.push(`${where}: ${def.name} has no socket ${String(s.index)}, ignored`);
      continue;
    }
    if (!catalog.pool(socket).includes(plug))
    {
      warnings.push(`${where}: ${def.name} socket ${index} cannot hold plug ${plug}, kept default`);
      continue;
    }
    state.plugs[socket.index] = plug;
  }
  return masterworked(catalog, state);
}

import { useMemo, useState, type Dispatch } from 'react';
import {
  ammoNames,
  damageNames,
  tierNames,
  type Catalog,
  type Hash,
  type SlotMeta,
  type SocketDef,
  type SocketKind,
} from '../data';
import { storedCells, cellItem, changeVersion, itemProblems, newItem, topTiers, type Action, type Cell, type Character, type ItemState } from '../model';
import { AmmoGlyph, DamageGlyph, EnergyGlyph } from './Glyphs';
import { EnergyBox, PerkColumns, PlugBox } from './Sockets';
import { ItemIcon } from './Tile';

interface Props
{
  catalog: Catalog;
  slot: SlotMeta;
  character: Character;
  index: number;
  cell: Cell;
  setCell: (c: Cell) => void;
  dispatch: Dispatch<Action>;
}

export function SlotPanel({ catalog, slot, character, index, cell, setCell, dispatch }: Props)
{
  const gear = character.gear[slot.key];
  const state = cellItem(gear, cell);
  const set = (item: ItemState | null) => dispatch({ type: 'item', character: index, slot: slot.key, cell, item });

  return (
    <section className="slot-panel" id={`slot-${slot.key}`}>
      <h2 className="slot-title">{slot.label}</h2>
      <div className="slot-top">
        <div className="cells">
          <div className="stored-grid">
            {Array.from({ length: storedCells }, (_, i) => (
              <CellButton key={i} catalog={catalog} item={gear.stored[i]} active={cell === i} label={`Stored ${i + 1}`} onClick={() => setCell(i)} />
            ))}
          </div>
          <CellButton catalog={catalog} item={gear.equipped} active={cell === 'equipped'} label="Equipped" onClick={() => setCell('equipped')} big />
        </div>
        <Search
          catalog={catalog}
          slot={slot}
          classType={character.classType}
          current={state?.hash}
          onPick={(hash) => set(newItem(catalog, hash))}
        />
      </div>
      {state && (
        <ItemBody
          key={`${cell}`}
          catalog={catalog}
          slot={slot}
          state={state}
          classType={character.classType}
          onChange={set}
          onEquip={typeof cell === 'number' ? () =>
          {
            dispatch({ type: 'equip', character: index, slot: slot.key, cell });
            setCell('equipped');
          } : undefined}
        />
      )}
    </section>
  );
}

function CellButton({
  catalog,
  item,
  active,
  label,
  onClick,
  big,
}: {
  catalog: Catalog;
  item: ItemState | null;
  active: boolean;
  label: string;
  onClick: () => void;
  big?: boolean;
})
{
  const name = item ? catalog.item(item.hash)?.name : undefined;
  return (
    <button
      className={`cell ${big ? 'big' : ''} ${active ? 'active' : ''} ${item ? '' : 'empty'}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={name ? `${label}: ${name}` : `${label}, empty`}
    >
      {item ? (
        <ItemIcon catalog={catalog} hash={item.hash} state={item} size={big ? 'var(--cell-big)' : 'var(--cell-small)'} />
      ) : (
        <span className="plus">+</span>
      )}
    </button>
  );
}

function Search({
  catalog,
  slot,
  classType,
  current,
  onPick,
}: {
  catalog: Catalog;
  slot: SlotMeta;
  classType: number;
  current?: Hash;
  onPick: (hash: Hash) => void;
})
{
  const [query, setQuery] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [hover, setHover] = useState<Hash | null>(null);

  const groups = useMemo(
    () =>
      catalog.groupsFor(slot.key).filter((h) =>
      {
        const item = catalog.item(h)!;
        if (slot.weapon) return legacy || !item.y1;
        return (item.classType === classType || item.classType === 3) && (legacy || item.armor2);
      }),
    [catalog, slot, classType, legacy],
  );
  const shown = useMemo(() =>
  {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return groups;
    return groups.filter((h) =>
    {
      const hay = searchText(catalog, h);
      return words.every((w) => hay.includes(w));
    });
  }, [catalog, groups, query]);
  const currentGroup = current !== undefined ? catalog.versions.get(current)?.[0] : undefined;
  const hovered = hover !== null ? catalog.item(hover) : undefined;

  return (
    <div className="search-panel">
      <div className="search-row">
        <input
          className="search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="check small">
          <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} />
          {slot.weapon ? 'Y1' : 'A1'}
        </label>
      </div>
      <div className="results" onMouseLeave={() => setHover(null)}>
        {shown.map((h) => (
          <button
            key={h}
            className={`result ${h === currentGroup ? 'on' : ''}`}
            onClick={() => onPick(h)}
            onMouseEnter={() => setHover(h)}
            onFocus={() => setHover(h)}
            aria-label={catalog.item(h)!.name}
          >
            <ItemIcon catalog={catalog} hash={h} size={44} />
          </button>
        ))}
        {shown.length === 0 && <p className="muted small">Nothing matches “{query}”.</p>}
      </div>
      <div className="result-line small">{hovered && <strong>{hovered.name}</strong>}</div>
    </div>
  );
}

const searchCache = new WeakMap<Catalog, Map<Hash, string>>();
function searchText(catalog: Catalog, hash: Hash): string
{
  let cache = searchCache.get(catalog);
  if (!cache) searchCache.set(catalog, (cache = new Map()));
  let text = cache.get(hash);
  if (text === undefined)
  {
    const item = catalog.item(hash)!;
    text = [
      item.name,
      item.type,
      tierNames[item.tier],
      item.damage !== undefined ? damageNames[item.damage] : '',
      item.ammo ? ammoNames[item.ammo] : '',
      item.source,
      item.season,
      item.y1 ? 'y1' : '',
      item.classType !== undefined && !item.armor2 ? 'a1' : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    cache.set(hash, text);
  }
  return text;
}

const bottomKinds: SocketKind[] = ['shader', 'ornament', 'tracker', 'mod', 'masterwork', 'armorMasterwork', 'cosmetic', 'other'];

function ItemBody({
  catalog,
  slot,
  state,
  classType,
  onChange,
  onEquip,
}: {
  catalog: Catalog;
  slot: SlotMeta;
  state: ItemState;
  classType: number;
  onChange: (s: ItemState | null) => void;
  onEquip?: () => void;
})
{
  const def = catalog.item(state.hash)!;
  const sockets = def.sockets ?? [];
  const versions = catalog.versions.get(state.hash) ?? [state.hash];
  const problems = itemProblems(catalog, state, classType);
  const setPlug = (index: number, plug: Hash) => onChange({ ...state, plugs: { ...state.plugs, [index]: plug } });

  const fixedIntrinsics = sockets.filter((s) => s.kind === 'intrinsic' && catalog.pool(s).length === 1);
  const columns = sockets.filter((s) => s.kind === 'perk' || (s.kind === 'intrinsic' && !fixedIntrinsics.includes(s)));
  const energy = sockets.find((s) => s.kind === 'energy');
  const armorMods = slot.weapon ? [] : sockets.filter((s) => s.kind === 'mod');
  const hasTiers = (s: SocketDef) => catalog.pool(s).some((h) => catalog.plug(h)?.stat);
  const bottom = sockets
    .filter((s) => bottomKinds.includes(s.kind) && !armorMods.includes(s) && !(s.kind === 'armorMasterwork' && !hasTiers(s)))
    .sort((a, b) => bottomKinds.indexOf(a.kind) - bottomKinds.indexOf(b.kind));
  const damage = catalog.damageOf(state.hash, state.plugs);
  const armorEnergy = energy ? catalog.energyOf(state.plugs[energy.index])?.type : undefined;

  const statName = (h: Hash) => catalog.data.stats[catalog.plug(h)?.stat?.[0] ?? 0] ?? catalog.plug(h)?.name ?? '';
  const box = (s: SocketDef) =>
    (s.kind === 'masterwork' || s.kind === 'armorMasterwork') && hasTiers(s) ? (
      <PlugBox
        key={s.index}
        catalog={catalog}
        socket={s}
        state={state}
        setPlug={setPlug}
        options={topTiers(catalog, catalog.pool(s))}
        nameOf={statName}
      />
    ) : (
      <PlugBox key={s.index} catalog={catalog} socket={s} state={state} setPlug={setPlug} />
    );

  const hasMain = columns.length > 0 || !!energy || armorMods.length > 0;

  return (
    <div className="item-body">
      <div className={`item-bar tier-${def.tier}`}>
        <div className="item-bar-text">
          <span className="item-bar-name">{def.name}</span>
          <span className="item-glyphs">
            {damage !== undefined && <DamageGlyph catalog={catalog} damage={damage} />}
            {def.ammo ? <AmmoGlyph catalog={catalog} ammo={def.ammo} /> : null}
            {armorEnergy !== undefined && <EnergyGlyph catalog={catalog} energy={armorEnergy} />}
          </span>
        </div>
        <div className="item-bar-actions">
          {versions.length > 1 && (
            <select
              value={state.hash}
              onChange={(e) => onChange(changeVersion(catalog, state, Number(e.target.value)))}
              aria-label="Version"
            >
              {versions.map((h) => (
                <option key={h} value={h}>
                  {catalog.versionLabel(h)}
                </option>
              ))}
            </select>
          )}
          {onEquip && <button onClick={onEquip}>Equip</button>}
          <button onClick={() => onChange(newItem(catalog, state.hash))}>
            Defaults
          </button>
          <button className="ghost danger" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      </div>

      {problems.length > 0 && (
        <ul className="item-problems">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      {(hasMain || bottom.length > 0) && (
        <div className={`item-layout ${hasMain ? 'has-main' : ''}`}>
          {hasMain && (
            <div className={`item-main ${slot.weapon ? '' : 'armor'}`}>
              {energy && <EnergyBox catalog={catalog} socket={energy} state={state} setPlug={setPlug} />}
              {armorMods.map(box)}
              {columns.length > 0 && <PerkColumns catalog={catalog} sockets={columns} state={state} setPlug={setPlug} />}
            </div>
          )}
          {bottom.length > 0 && <div className="item-side">{bottom.map(box)}</div>}
        </div>
      )}
    </div>
  );
}

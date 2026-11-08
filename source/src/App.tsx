import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { armorSlots, classNames, Catalog, SLOTS, weaponSlots, icon, loadData, type SlotKey } from './data';
import { downloadJson, exportLoadout, importLoadout } from './io';
import { clanTagMax, characterProblems, newLoadout, reduce, type Cell, type Loadout } from './model';
import { IdentityPanel } from './components/Identity';
import { Segmented } from './components/Segmented';
import { SlotPanel } from './components/SlotPanel';

const storageKey = 'shadowkeep.configurator.v1';

type View = 'weapons' | 'armor';

function readSaved(catalog: Catalog): Loadout | null
{
  try
  {
    const raw = localStorage.getItem(storageKey);
    return raw ? importLoadout(catalog, raw).loadout : null;
  }
  catch
  {
    return null;
  }
}

export function App()
{
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() =>
  {
    loadData()
      .then((d) => setCatalog(new Catalog(d)))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="splash">Could not start: {error}</div>;
  if (!catalog) return <div className="splash">Loading Season of Arrivals data…</div>;
  return <Configurator catalog={catalog} />;
}

function Configurator({ catalog }: { catalog: Catalog })
{
  const [loadout, dispatch] = useReducer(reduce, undefined, () => readSaved(catalog) ?? newLoadout(catalog));
  const [active, setActive] = useState(0);
  const [view, setView] = useState<View>('weapons');
  const [cells, setCells] = useState<Record<SlotKey, Cell>>(
    () => Object.fromEntries(SLOTS.map((s) => [s.key, 'equipped'])) as Record<SlotKey, Cell>,
  );
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'error'; title: string; lines: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() =>
  {
    try
    {
      localStorage.setItem(storageKey, JSON.stringify(exportLoadout(catalog, loadout)));
    }
    catch
    {
    }
  }, [catalog, loadout]);

  const problems = useMemo(() => loadout.characters.map((c) => characterProblems(catalog, c)), [catalog, loadout]);
  const character = loadout.characters[active];
  const slots = view === 'weapons' ? weaponSlots : armorSlots;

  const goTo = (slot: SlotKey, cell: Cell) =>
  {
    setView(weaponSlots.some((s) => s.key === slot) ? 'weapons' : 'armor');
    setCells((c) => ({ ...c, [slot]: cell }));
    requestAnimationFrame(() => document.getElementById(`slot-${slot}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const onImport = async (file: File) =>
  {
    try
    {
      const { loadout: next, warnings } = importLoadout(catalog, await file.text());
      dispatch({ type: 'replace', loadout: next });
      setNotice(
        warnings.length
          ? { kind: 'warn', title: `Imported ${file.name} with ${warnings.length} warning(s)`, lines: warnings }
          : { kind: 'ok', title: `Imported ${file.name}`, lines: [] },
      );
    }
    catch (e)
    {
      setNotice({ kind: 'error', title: `Could not import ${file.name}`, lines: [(e as Error).message] });
    }
  };

  const cellName = (cell?: Cell) => (cell === undefined ? '' : cell === 'equipped' ? 'equipped' : `stored ${cell + 1}`);

  return (
    <div className="app">
      <header className="topbar">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}crucible.svg`} alt="Shadowkeep" />
        <div className="guardian">
          <input
            value={loadout.name}
            maxLength={26}
            placeholder="Name"
            aria-label="Name"
            onChange={(e) => dispatch({ type: 'guardian', name: e.target.value })}
          />
          <input
            value={loadout.clan}
            maxLength={26}
            placeholder="Clan"
            aria-label="Clan"
            onChange={(e) => dispatch({ type: 'guardian', clan: e.target.value })}
          />
          <input
            className="clan-tag"
            value={loadout.clanTag}
            placeholder="Tag"
            aria-label="Clan tag"
            maxLength={clanTagMax + 2}
            onChange={(e) => dispatch({ type: 'guardian', clanTag: e.target.value })}
          />
        </div>
        <div className="actions">
          <button onClick={() => fileInput.current?.click()}>Import</button>
          <button onClick={() => downloadJson(exportLoadout(catalog, loadout))}>Export</button>
          <button
            onClick={() =>
            {
              if (confirm('Clear everything back to the default state?'))
              {
                dispatch({ type: 'replace', loadout: newLoadout(catalog) });
                setNotice(null);
              }
            }}
          >
            Clear
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) =>
            {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.kind}`}>
          <div className="notice-head">
            <strong>{notice.title}</strong>
            <button className="ghost small" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
          {notice.lines.length > 0 && (
            <ul>
              {notice.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <nav className="characters" aria-label="Characters">
        {loadout.characters.map((c, i) =>
        {
          const emblem = catalog.item(c.emblem);
          return (
            <button
              key={i}
              className={`character-card ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              style={{
                backgroundImage: emblem?.nameplate ? `url(${icon(emblem.nameplate)})` : undefined,
                backgroundColor: emblem?.color ? `rgb(${emblem.color.join(',')})` : undefined,
              }}
            >
              {classNames[c.classType]}
            </button>
          );
        })}
      </nav>

      <IdentityPanel key={active} catalog={catalog} character={character} index={active} dispatch={dispatch} />

      <div className="toolbar">
        <Segmented
          label="Gear"
          options={[
            { value: 'weapons' as View, label: 'Weapons' },
            { value: 'armor' as View, label: 'Armor' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {problems[active].length > 0 && (
        <ul className="problems">
          {problems[active].map((p, i) => (
            <li key={i}>
              {p.slot && (
                <button className="link" onClick={() => goTo(p.slot!, p.cell!)}>
                  {SLOTS.find((s) => s.key === p.slot)?.label} ({cellName(p.cell)})
                </button>
              )}{' '}
              {p.message}
            </li>
          ))}
        </ul>
      )}

      <main className="slots">
        {slots.map((slot) => (
          <SlotPanel
            key={`${active}-${slot.key}`}
            catalog={catalog}
            slot={slot}
            character={character}
            index={active}
            cell={cells[slot.key]}
            setCell={(c) => setCells((all) => ({ ...all, [slot.key]: c }))}
            dispatch={dispatch}
          />
        ))}
      </main>

    </div>
  );
}

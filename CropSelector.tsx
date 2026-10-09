import { useMemo, useState } from 'react';
import { GROUPS, SEASON_LABEL, searchCrops, type Crop } from './crops';

type Selection = { crop: Crop } | { custom: string };

export default function CropSelector({ onSelect }: { onSelect: (s: Selection) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | undefined>();
  const [customInput, setCustomInput] = useState('');
  const results = useMemo(() => searchCrops(query, group), [query, group]);

  // group results by category so the list stays organised
  const byCategory = useMemo(() => {
    const m = new Map<string, Crop[]>();
    results.forEach((c) => m.set(c.category, [...(m.get(c.category) ?? []), c]));
    return [...m.entries()];
  }, [results]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? 'bg-green-700 text-white border-green-700' : 'border-green-700/40'}`;

  return (
    <div className="space-y-3">
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search crop: gram, chana, tomato, Oryza..."
        aria-label="Search crops" className="w-full rounded-lg border px-3 py-2"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Crop categories">
        <button className={chip(!group)} onClick={() => setGroup(undefined)}>All</button>
        {GROUPS.map((g) => (
          <button key={g} className={chip(group === g)} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {byCategory.map(([category, crops]) => (
          <section key={category} className="mb-3">
            <h3 className="sticky top-0 bg-white/90 py-1 text-sm font-semibold text-green-800">{category}</h3>
            <ul>
              {crops.map((c) => (
                <li key={c.id}>
                  <button className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-green-50"
                          onClick={() => onSelect({ crop: c })}>
                    <span>{c.name}{c.sci && <em className="ml-2 text-xs text-gray-500">{c.sci}</em>}</span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {[...c.season].map((s) => SEASON_LABEL[s]?.split(' ')[0]).join(' / ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!results.length && (
          <div className="p-3 text-sm text-gray-600">
            No crop found for "{query}".{' '}
            {query.trim() && (
              <button
                type="button"
                className="ml-2 font-semibold text-green-700 underline"
                onClick={() => onSelect({ custom: query.trim() })}
              >
                Use "{query.trim()}" as my crop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Custom Crop Name Input */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Or type a custom crop name (e.g. Desi Chana GNG)..."
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customInput.trim()) {
              e.preventDefault();
              onSelect({ custom: customInput.trim() });
            }
          }}
        />
        <button
          type="button"
          disabled={!customInput.trim()}
          onClick={() => {
            if (customInput.trim()) onSelect({ custom: customInput.trim() });
          }}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Set Custom
        </button>
      </div>
    </div>
  );
}

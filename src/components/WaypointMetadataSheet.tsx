import React, { useState, useEffect } from 'react';
import { X, Lock, MapPin, Sprout, Check, Volume2 } from 'lucide-react';
import type { FieldWaypoint } from '../lib/geodesyField';
import { formatAllCoordinateSystems } from '../lib/digipin';
import { speakFieldGuidance } from '../lib/fieldAudioSensors';
import { useI18n } from '../lib/i18n';

interface WaypointMetadataSheetProps {
  isOpen: boolean;
  initialLat: number;
  initialLon: number;
  initialAltM: number | null;
  defaultFarmName: string;
  defaultCrop?: string;
  editingWaypoint?: FieldWaypoint | null;
  onClose: () => void;
  onSave: (wp: FieldWaypoint) => void;
}

const SYMBOL_TYPES = [
  { id: 'corner', label: 'Corner / Bund' },
  { id: 'soil', label: 'Soil Sample' },
  { id: 'water', label: 'Water / Borewell' },
  { id: 'hazard', label: 'Crop Stress / Damage' },
  { id: 'survey', label: 'Survey Benchmark' },
];

const PUSHPIN_SPRITES = [
  'castshadow-green.png',
  'castshadow-orange.png',
  'castshadow-blue.png',
  'castshadow-red.png',
  'castshadow-purple.png',
  'push-pin-yellow.png',
];

const SOIL_PRESETS = ['Black Cotton (Vertisol)', 'Red Loam (Alfisol)', 'Sandy Loam', 'Alluvial Clay', 'Laterite'];

export default function WaypointMetadataSheet({
  isOpen,
  initialLat,
  initialLon,
  initialAltM,
  defaultFarmName,
  defaultCrop,
  editingWaypoint,
  onClose,
  onSave,
}: WaypointMetadataSheetProps) {
  const { t, lang } = useI18n();
  const [label, setLabel] = useState('');
  const [farmId, setFarmId] = useState(defaultFarmName);
  const [crop, setCrop] = useState(defaultCrop || '');
  const [soilType, setSoilType] = useState(SOIL_PRESETS[0]);
  const [type, setType] = useState('corner');
  const [symbol, setSymbol] = useState('castshadow-orange.png');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingWaypoint) {
      setLabel(editingWaypoint.label);
      setFarmId(editingWaypoint.farmId || defaultFarmName);
      setCrop(editingWaypoint.crop || defaultCrop || '');
      setSoilType(editingWaypoint.soilType || SOIL_PRESETS[0]);
      setType(editingWaypoint.type || 'corner');
      setSymbol(editingWaypoint.symbol?.endsWith('.png') ? editingWaypoint.symbol : 'castshadow-orange.png');
      setNotes(editingWaypoint.notes || '');
    } else {
      setLabel(`WP-${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setFarmId(defaultFarmName);
      setCrop(defaultCrop || '');
      setSoilType(SOIL_PRESETS[0]);
      setType('corner');
      setSymbol('castshadow-green.png');
      setNotes('');
    }
  }, [isOpen, editingWaypoint, defaultFarmName, defaultCrop]);

  if (!isOpen) return null;

  const lat = editingWaypoint ? editingWaypoint.lat : initialLat;
  const lon = editingWaypoint ? editingWaypoint.lon : initialLon;
  const coords = formatAllCoordinateSystems(lat, lon);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: editingWaypoint?.id || `wp-${Date.now()}`,
      label: label.trim() || `WP-${Date.now()}`,
      lat,
      lon,
      altM: editingWaypoint?.altM ?? initialAltM,
      type,
      symbol,
      farmId: farmId.trim() || undefined,
      crop: crop.trim() || undefined,
      soilType: soilType.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingWaypoint?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('field.sheet.title')}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-lg bg-[#1E1E1E] border-t sm:border border-[#2F2F2F] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 text-white max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <MapPin size={20} className="text-[#F57C00]" />
              <span>{t('field.sheet.title')}</span>
            </h2>
            <p className="text-xs font-mono text-[#A3B1A6] mt-1 tabular-nums">
              {coords.decimal} · DIGIPIN {coords.digipin}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => speakFieldGuidance(`${t('field.sheet.title')}. ${label}.`, lang)}
              className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#2A2A2A] hover:bg-[#333333] text-[#81C784] flex items-center justify-center"
              aria-label={t('field.action.listen')}
            >
              <Volume2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] min-w-[48px] rounded-xl bg-[#2A2A2A] hover:bg-[#333333] text-[#E5E7EB] flex items-center justify-center"
              aria-label={t('field.action.close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2E7D32]/25 border border-[#2E7D32]/60 text-[11px] font-semibold text-[#A5D6A7]">
          <Lock size={12} />
          <span>{t('field.badge.localOnly')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-xs text-[#C7D0C9]">
            <span className="font-semibold">{t('field.sheet.name')}</span>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3.5 text-sm text-white focus:border-[#2E7D32] focus:outline-none"
            />
          </label>

          <label className="block space-y-1.5 text-xs text-[#C7D0C9]">
            <span className="font-semibold">{t('field.sheet.farmId')}</span>
            <input
              type="text"
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3.5 text-sm text-white focus:border-[#2E7D32] focus:outline-none"
            />
          </label>

          <label className="block space-y-1.5 text-xs text-[#C7D0C9]">
            <span className="font-semibold flex items-center gap-1.5">
              <Sprout size={13} className="text-[#81C784]" />
              {t('field.sheet.crop')}
            </span>
            <input
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="Rice / Cotton / Chilli"
              className="w-full min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3.5 text-sm text-white focus:border-[#2E7D32] focus:outline-none"
            />
          </label>

          <label className="block space-y-1.5 text-xs text-[#C7D0C9]">
            <span className="font-semibold">{t('field.sheet.soilType')}</span>
            <select
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3 text-sm text-white focus:border-[#2E7D32] focus:outline-none"
            >
              {SOIL_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#C7D0C9]">Point Category</span>
          <div className="flex flex-wrap gap-2">
            {PUSHPIN_SPRITES.map((pin) => (
              <button
                key={pin}
                type="button"
                onClick={() => setSymbol(pin)}
                className={`min-h-[48px] min-w-[48px] p-1.5 rounded-xl border flex items-center justify-center transition ${
                  symbol === pin ? 'bg-[#2E7D32]/35 border-[#4CAF50]' : 'bg-[#121212] border-[#343434]'
                }`}
                aria-label={pin}
              >
                <img src={`/images/field-kit/pushpins/${pin}`} alt={pin} className="w-7 h-7 object-contain" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {SYMBOL_TYPES.map((sym) => (
              <button
                key={sym.id}
                type="button"
                onClick={() => setType(sym.id)}
                className={`min-h-[48px] px-3.5 rounded-xl text-xs font-semibold border transition ${
                  type === sym.id
                    ? 'bg-[#2E7D32] border-[#4CAF50] text-white'
                    : 'bg-[#121212] border-[#343434] text-[#C7D0C9] hover:border-[#555]'
                }`}
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5 text-xs text-[#C7D0C9]">
          <span className="font-semibold">{t('field.sheet.notes')}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl bg-[#121212] border border-[#343434] p-3 text-sm text-white focus:border-[#2E7D32] focus:outline-none"
          />
        </label>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] rounded-xl bg-[#2A2A2A] hover:bg-[#363636] text-sm font-semibold text-[#E5E7EB]"
          >
            {t('field.action.close')}
          </button>
          <button
            type="submit"
            className="flex-1 min-h-[48px] rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg"
          >
            <Check size={18} />
            <span>{t('field.sheet.save')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}


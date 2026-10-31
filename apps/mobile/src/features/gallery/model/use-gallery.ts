import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { gallery, type GalleryAsset, type GalleryHistory, type GalleryPage, type GallerySource } from '../../../shared/api/gallery';

export function useGallery() {
  const generation = useRef(0);
  const [sources, setSources] = useState<GallerySource[]>([]);
  const [source, setSource] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<GalleryPage | null>(null);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [selected, setSelected] = useState<GalleryAsset | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [history, setHistory] = useState<GalleryHistory[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const currentSource = useRef('');
  const currentOffset = useRef(0);
  const clear = useCallback(() => {
    generation.current += 1;
    setPage(null); setPreviews({}); setSelected(null); setDetail(null); setHistory(null); setError(false); setLoading(false);
  }, []);
  const load = useCallback(async (id?: string, start = 0) => {
    clear();
    const version = generation.current;
    setLoading(true);
    try {
      const rows = await gallery.sources();
      if (version !== generation.current) return;
      setSources(rows);
      const active = rows.find((row) => row.id === id)?.id ?? rows[0]?.id ?? '';
      currentSource.current = active; currentOffset.current = start;
      setSource(active); setOffset(start);
      if (!active) { setLoading(false); return; }
      const value = await gallery.page(active, start);
      if (version !== generation.current) return;
      setPage(value); setLoading(false);
      // One decoded thumbnail at a time; page replacement bounds retained preview memory.
      for (const asset of value.items) {
        const uri = await gallery.preview(active, asset.id);
        if (version !== generation.current) return;
        setPreviews((old) => ({ ...old, [asset.id]: uri }));
      }
    } catch {
      if (version === generation.current) { clear(); setSources([]); setError(true); }
    }
  }, [clear]);
  useEffect(() => {
    void load();
    const listener = AppState.addEventListener('change', (state) => {
      clear();
      if (state === 'active') void load(currentSource.current);
    });
    return () => { generation.current += 1; listener.remove(); };
  }, [load, clear]);
  const close = useCallback(() => { void load(currentSource.current, currentOffset.current); }, [load]);
  const open = async (asset: GalleryAsset) => {
    const version = ++generation.current;
    setSelected(asset); setDetail(null); setHistory(null); setLoading(true); setError(false);
    try {
      const uri = await gallery.preview(currentSource.current, asset.id, true);
      if (version !== generation.current) return;
      setDetail(uri);
      const rows = await gallery.history(currentSource.current, asset.id);
      if (version !== generation.current) return;
      setHistory(rows); setLoading(false);
    } catch {
      if (version === generation.current) { clear(); setError(true); }
    }
  };
  return { sources, source, offset, page, previews, selected, detail, history, error, loading,
    choose: (id: string) => load(id), previous: () => load(source, Math.max(0, offset - 24)),
    next: () => load(source, offset + 24), refresh: () => load(source), open, close };
}

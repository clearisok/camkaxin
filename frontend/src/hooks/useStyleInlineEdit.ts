import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { message } from 'antd';
import { updateStyle } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { enrichStyleClient } from '@/utils/styleCalculations';

export function useStyleInlineEdit(
  setData: Dispatch<SetStateAction<StyleRecord[]>>
) {
  const [savingId, setSavingId] = useState<number | null>(null);

  const updateLocal = useCallback((id: number, patch: Partial<StyleRecord>) => {
    setData((prev) => prev.map((row) => (row.id === id ? enrichStyleClient({ ...row, ...patch }) : row)));
  }, [setData]);

  const saveField = useCallback(async (id: number, patch: Record<string, unknown>) => {
    setSavingId(id);
    try {
      const res = await updateStyle(id, patch);
      setData((prev) => prev.map((row) => (row.id === id ? enrichStyleClient(res.data) : row)));
    } catch (err) {
      message.error(String(err));
    } finally {
      setSavingId(null);
    }
  }, [setData]);

  return { savingId, updateLocal, saveField };
}

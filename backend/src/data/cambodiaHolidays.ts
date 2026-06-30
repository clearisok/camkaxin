/** 柬埔寨法定节假日（公历日期；农历节日按当年政府公布日录入，同步后可人工调整） */
export interface CambodiaHolidayEntry {
  date: string;
  name: string;
}

export const CAMBODIA_HOLIDAYS: Record<number, CambodiaHolidayEntry[]> = {
  2025: [
    { date: '2025-01-01', name: '国际新年' },
    { date: '2025-01-07', name: '推翻波尔布特政权胜利日' },
    { date: '2025-03-08', name: '国际妇女节' },
    { date: '2025-04-14', name: '柬新年' },
    { date: '2025-04-15', name: '柬新年' },
    { date: '2025-04-16', name: '柬新年' },
    { date: '2025-05-01', name: '国际劳动节' },
    { date: '2025-05-11', name: '佛诞节（Visak Bochea）' },
    { date: '2025-05-14', name: '国王诞辰' },
    { date: '2025-06-18', name: '太后诞辰' },
    { date: '2025-09-21', name: '亡人节（Pchum Ben）' },
    { date: '2025-09-22', name: '亡人节（Pchum Ben）' },
    { date: '2025-09-23', name: '亡人节（Pchum Ben）' },
    { date: '2025-10-15', name: '先王纪念日' },
    { date: '2025-10-29', name: '国王加冕日' },
    { date: '2025-11-09', name: '独立日' },
    { date: '2025-11-04', name: '送水节' },
    { date: '2025-11-05', name: '送水节' },
    { date: '2025-11-06', name: '送水节' },
  ],
  2026: [
    { date: '2026-01-01', name: '国际新年' },
    { date: '2026-01-07', name: '推翻波尔布特政权胜利日' },
    { date: '2026-03-08', name: '国际妇女节' },
    { date: '2026-04-14', name: '柬新年' },
    { date: '2026-04-15', name: '柬新年' },
    { date: '2026-04-16', name: '柬新年' },
    { date: '2026-05-01', name: '国际劳动节' },
    { date: '2026-05-04', name: '佛诞节（Visak Bochea）' },
    { date: '2026-05-14', name: '国王诞辰' },
    { date: '2026-06-18', name: '太后诞辰' },
    { date: '2026-09-16', name: '亡人节（Pchum Ben）' },
    { date: '2026-09-17', name: '亡人节（Pchum Ben）' },
    { date: '2026-09-18', name: '亡人节（Pchum Ben）' },
    { date: '2026-10-15', name: '先王纪念日' },
    { date: '2026-10-29', name: '国王加冕日' },
    { date: '2026-11-09', name: '独立日' },
    { date: '2026-11-23', name: '送水节' },
    { date: '2026-11-24', name: '送水节' },
    { date: '2026-11-25', name: '送水节' },
  ],
  2027: [
    { date: '2027-01-01', name: '国际新年' },
    { date: '2027-01-07', name: '推翻波尔布特政权胜利日' },
    { date: '2027-03-08', name: '国际妇女节' },
    { date: '2027-04-14', name: '柬新年' },
    { date: '2027-04-15', name: '柬新年' },
    { date: '2027-04-16', name: '柬新年' },
    { date: '2027-05-01', name: '国际劳动节' },
    { date: '2027-05-20', name: '佛诞节（Visak Bochea）' },
    { date: '2027-05-14', name: '国王诞辰' },
    { date: '2027-06-18', name: '太后诞辰' },
    { date: '2027-10-05', name: '亡人节（Pchum Ben）' },
    { date: '2027-10-06', name: '亡人节（Pchum Ben）' },
    { date: '2027-10-07', name: '亡人节（Pchum Ben）' },
    { date: '2027-10-15', name: '先王纪念日' },
    { date: '2027-10-29', name: '国王加冕日' },
    { date: '2027-11-09', name: '独立日' },
    { date: '2027-11-12', name: '送水节' },
    { date: '2027-11-13', name: '送水节' },
    { date: '2027-11-14', name: '送水节' },
  ],
};

export function cambodiaHolidayYears(): number[] {
  return Object.keys(CAMBODIA_HOLIDAYS).map(Number).sort((a, b) => a - b);
}

export function flattenCambodiaHolidays(years?: number[]): CambodiaHolidayEntry[] {
  const targetYears = years?.length ? years : cambodiaHolidayYears();
  const list: CambodiaHolidayEntry[] = [];
  for (const y of targetYears) {
    const entries = CAMBODIA_HOLIDAYS[y];
    if (entries) list.push(...entries);
  }
  return list;
}

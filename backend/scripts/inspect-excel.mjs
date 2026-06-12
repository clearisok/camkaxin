import ExcelJS from 'exceljs';

const file = String.raw`c:\Users\Administrator\Desktop\temp\2026柬埔寨生产预警报表(6.5)(2).xlsx`;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
console.log('sheets:', wb.worksheets.map((s) => s.name));
const ws = wb.worksheets[0];
console.log('active:', ws.name, 'rows:', ws.rowCount, 'cols:', ws.columnCount);
for (let r = 1; r <= Math.min(8, ws.rowCount); r++) {
  const row = ws.getRow(r);
  const vals = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 30) vals[col - 1] = cell.value;
  });
  console.log('ROW', r, JSON.stringify(vals));
}

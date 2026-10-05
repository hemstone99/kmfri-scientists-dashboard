// =============================================================================
// KMFRI Institutional Export Utilities (CSV, Excel .xls, Printable PDF/HTML)
// =============================================================================

export function exportToCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function exportToExcel(filename: string, sheetTitle: string, rows: Array<Record<string, unknown>>) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerCells = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = headers
        .map((h) => {
          const raw = row[h];
          const isNum = typeof raw === 'number' && !Number.isNaN(raw);
          const val = raw === null || raw === undefined ? '' : String(raw);
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetTitle.slice(0, 28) || 'KMFRI_Export')}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, `${filename}.xls`);
}

export function exportToMultiSheetExcel(
  filename: string,
  sheets: Array<{ title: string; rows: Array<Record<string, unknown>> }>
) {
  if (!sheets || sheets.length === 0) return;

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const worksheetsXml = sheets
    .map(({ title, rows }) => {
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const headerCells = headers
        .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
        .join('');

      const bodyRows = rows
        .map((row) => {
          const cells = headers
            .map((h) => {
              const raw = row[h];
              const isNum = typeof raw === 'number' && !Number.isNaN(raw);
              const val = raw === null || raw === undefined ? '' : String(raw);
              return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');

      return `<Worksheet ss:Name="${escapeXml(title.slice(0, 28) || 'Data')}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheetsXml}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, `${filename}.xls`);
}

export function exportToInstitutionalReportHTML(
  filename: string,
  title: string,
  subtitle: string,
  rows: Array<Record<string, unknown>>
) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const generatedAt = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} — KMFRI Official Report</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #0f172a; margin: 32px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .inst { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #0369a1; font-weight: 700; }
    h1 { margin: 4px 0; font-size: 22px; color: #0a2540; }
    .sub { font-size: 13px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
    th { background: #0a2540; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="inst">Kenya Marine and Fisheries Research Institute (KMFRI)</div>
      <h1>${title}</h1>
      <div class="sub">${subtitle}</div>
    </div>
    <div style="font-size:11px;color:#475569;text-align:right;">
      <div>Generated: ${generatedAt}</div>
      <div>Records: ${rows.length}</div>
    </div>
  </div>
  ${
    rows.length === 0
      ? '<p style="font-size:13px;color:#64748b;">No operational records present for this filter selection.</p>'
      : `<table>
    <thead>
      <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((h) => `<td>${r[h] === null || r[h] === undefined ? '—' : String(r[h])}</td>`)
              .join('')}</tr>`
        )
        .join('')}
    </tbody>
  </table>`
  }
  <div class="footer">
    Official KMFRI Research Management System Export · Mombasa Headquarters (English Point) · Republic of Kenya
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `${filename}_report.html`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

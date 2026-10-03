const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { query } = require('../db/database');

const downloadsDir = path.join(__dirname, '..', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

/**
 * Generate an Excel file from rows and columns and store in Download Area
 */
async function generateExcelReport({
  fileNamePrefix,
  category = 'Analytics Report',
  sheetName = 'Report Data',
  columns,
  data,
  generatedBy = 'System HR'
}) {
  const timestamp = Date.now();
  const fileName = `${fileNamePrefix}_${timestamp}.xlsx`;
  const filePath = path.join(downloadsDir, fileName);

  // Format data using column definitions
  const rows = data.map((item) => {
    const rowObj = {};
    columns.forEach((col) => {
      rowObj[col.header] = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '';
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths based on longest string in each column
  const colWidths = columns.map((col) => {
    let maxLen = col.header.length;
    data.forEach((row) => {
      const val = row[col.key] ? String(row[col.key]) : '';
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
  });

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, filePath);

  const stats = fs.statSync(filePath);

  // Insert into internal download area table
  await query.run(
    `INSERT INTO download_area_files (
      file_name, file_type, category, file_path, file_size, generated_by
    ) VALUES (?, 'Excel', ?, ?, ?, ?)`,
    [fileName, category, filePath, stats.size, generatedBy]
  );

  // Audit log
  await query.run(
    `INSERT INTO audit_logs (actor_type, actor_name, action, details)
     VALUES ('Admin', ?, 'Report Exported to Download Area', ?)`,
    [generatedBy, `Generated Excel export: ${fileName} (${data.length} records)`]
  );

  return {
    fileName,
    filePath,
    fileSize: stats.size,
    recordCount: data.length
  };
}

module.exports = {
  generateExcelReport
};

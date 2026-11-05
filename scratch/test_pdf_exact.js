const { generateVerificationReportPDF } = require('../backend/utils/pdfGenerator');
const fs = require('fs');

async function test() {
  console.log('Testing PDF generation for employee 12705...');
  const res = await generateVerificationReportPDF({ employee_id: '12705' });
  console.log('Result:', {
    filePath: res.filePath,
    totalPages: res.totalPages,
    fileName: res.fileName,
    fileSize: res.fileSize
  });
}

test().catch(console.error);

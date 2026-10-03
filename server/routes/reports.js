const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticateAdmin } = require('../middleware/auth');
const { generateExcelReport } = require('../utils/excelGenerator');

// POST /api/reports/generate - Generate requested report and output directly to internal Download Area
router.post('/generate', authenticateAdmin, async (req, res) => {
  try {
    const { reportType, branch, department, location, startDate, endDate, status } = req.body;

    let whereClauses = [];
    let params = [];

    if (branch && branch !== 'ALL') {
      whereClauses.push('e.branch = ?');
      params.push(branch);
    }

    if (department && department !== 'ALL') {
      whereClauses.push('e.department = ?');
      params.push(department);
    }

    if (location && location !== 'ALL') {
      whereClauses.push('e.location = ?');
      params.push(location);
    }

    if (status && status !== 'ALL') {
      whereClauses.push('e.verification_status = ?');
      params.push(status);
    }

    if (startDate) {
      whereClauses.push('e.date_of_joining >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('e.date_of_joining <= ?');
      params.push(endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let rows = [];
    let columns = [];
    let prefix = 'Collman_Report';

    switch (reportType) {
      case 'branch_summary':
        prefix = 'Branch_Verification_Report';
        rows = await query.all(
          `SELECT e.branch,
                  COUNT(e.id) as total_employees,
                  SUM(CASE WHEN e.verification_status = 'Verified' THEN 1 ELSE 0 END) as verified_count,
                  SUM(CASE WHEN e.verification_status = 'Pending BGV Review' THEN 1 ELSE 0 END) as pending_review,
                  SUM(CASE WHEN e.verification_status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                  SUM(CASE WHEN e.verification_status = 'Verification Failed' THEN 1 ELSE 0 END) as failed_count,
                  SUM(CASE WHEN e.verification_status = 'Reverification Required' THEN 1 ELSE 0 END) as reverify_count
           FROM employees e
           ${whereSql}
           GROUP BY e.branch`,
          params
        );
        columns = [
          { header: 'Branch Name', key: 'branch' },
          { header: 'Total Employees', key: 'total_employees' },
          { header: 'Verified', key: 'verified_count' },
          { header: 'Pending BGV Review', key: 'pending_review' },
          { header: 'In Progress', key: 'in_progress' },
          { header: 'Verification Failed', key: 'failed_count' },
          { header: 'Reverification Req', key: 'reverify_count' }
        ];
        break;

      case 'dept_summary':
        prefix = 'Department_Verification_Report';
        rows = await query.all(
          `SELECT e.department,
                  COUNT(e.id) as total_employees,
                  SUM(CASE WHEN e.verification_status = 'Verified' THEN 1 ELSE 0 END) as verified_count,
                  SUM(CASE WHEN e.verification_status = 'Pending BGV Review' THEN 1 ELSE 0 END) as pending_review,
                  SUM(CASE WHEN e.verification_status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                  SUM(CASE WHEN e.verification_status = 'Verification Failed' THEN 1 ELSE 0 END) as failed_count
           FROM employees e
           ${whereSql}
           GROUP BY e.department`,
          params
        );
        columns = [
          { header: 'Department', key: 'department' },
          { header: 'Total Employees', key: 'total_employees' },
          { header: 'Verified', key: 'verified_count' },
          { header: 'Pending Review', key: 'pending_review' },
          { header: 'In Progress', key: 'in_progress' },
          { header: 'Failed', key: 'failed_count' }
        ];
        break;

      case 'reviewer_productivity':
        prefix = 'Reviewer_Productivity_Report';
        rows = await query.all(
          `SELECT u.full_name as reviewer_name,
                  u.email as reviewer_email,
                  COUNT(vc.id) as total_assigned,
                  SUM(CASE WHEN vc.status = 'Verified' THEN 1 ELSE 0 END) as verified_cases,
                  SUM(CASE WHEN vc.status = 'Verification Failed' THEN 1 ELSE 0 END) as failed_cases,
                  SUM(CASE WHEN vc.status = 'Reverification Required' THEN 1 ELSE 0 END) as reverified_cases,
                  SUM(CASE WHEN vc.status = 'Pending BGV Review' THEN 1 ELSE 0 END) as pending_cases
           FROM users u
           LEFT JOIN verification_cases vc ON u.id = vc.assigned_reviewer_id
           WHERE u.role = 'BGV Reviewer'
           GROUP BY u.id`
        );
        columns = [
          { header: 'Reviewer Name', key: 'reviewer_name' },
          { header: 'Email', key: 'reviewer_email' },
          { header: 'Total Assigned', key: 'total_assigned' },
          { header: 'Verified Cases', key: 'verified_cases' },
          { header: 'Failed Cases', key: 'failed_cases' },
          { header: 'Reverification Req', key: 'reverified_cases' },
          { header: 'Pending Cases', key: 'pending_cases' }
        ];
        break;

      case 'tat_report':
        prefix = 'TAT_Compliance_Report';
        rows = await query.all(
          `SELECT e.employee_id,
                  e.employee_name,
                  e.branch,
                  e.department,
                  e.verification_status,
                  vc.case_reference,
                  vc.tat_deadline,
                  CASE
                    WHEN e.verification_status IN ('Verified', 'Verification Failed') THEN 'Completed Within TAT'
                    WHEN vc.tat_deadline IS NOT NULL AND datetime('now') > datetime(vc.tat_deadline) THEN 'TAT Breached'
                    WHEN vc.tat_deadline IS NOT NULL AND date('now') = date(vc.tat_deadline) THEN 'Due Today'
                    ELSE 'Within TAT'
                  END as tat_status
           FROM employees e
           LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
           ${whereSql}`,
          params
        );
        columns = [
          { header: 'Employee ID', key: 'employee_id' },
          { header: 'Employee Name', key: 'employee_name' },
          { header: 'Branch', key: 'branch' },
          { header: 'Department', key: 'department' },
          { header: 'Verification Status', key: 'verification_status' },
          { header: 'Case Ref', key: 'case_reference' },
          { header: 'TAT Deadline', key: 'tat_deadline' },
          { header: 'TAT Status', key: 'tat_status' }
        ];
        break;

      case 'employee_detailed':
      default:
        prefix = 'Employee_Address_Verification_Master_Report';
        rows = await query.all(
          `SELECT e.employee_id,
                  e.employee_name,
                  e.mobile_number,
                  e.email_id,
                  e.date_of_joining,
                  e.department,
                  e.designation,
                  e.branch,
                  e.location,
                  e.hr_city,
                  e.hr_state,
                  e.hr_pincode,
                  e.hr_current_address,
                  e.verification_status,
                  vc.case_reference,
                  vc.final_decision,
                  vp.submitted_address,
                  vp.distance_from_hr_meters,
                  vp.distance_category,
                  vp.residence_type,
                  vp.document_type
           FROM employees e
           LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
           LEFT JOIN verification_progress vp ON e.employee_id = vp.employee_id
           ${whereSql}
           ORDER BY e.created_at DESC`,
          params
        );
        columns = [
          { header: 'Employee ID', key: 'employee_id' },
          { header: 'Employee Name', key: 'employee_name' },
          { header: 'Mobile Number', key: 'mobile_number' },
          { header: 'Email ID', key: 'email_id' },
          { header: 'DOJ', key: 'date_of_joining' },
          { header: 'Department', key: 'department' },
          { header: 'Designation', key: 'designation' },
          { header: 'Branch', key: 'branch' },
          { header: 'Location', key: 'location' },
          { header: 'Original HR Address', key: 'hr_current_address' },
          { header: 'Verified Address', key: 'submitted_address' },
          { header: 'GPS Distance (m)', key: 'distance_from_hr_meters' },
          { header: 'GPS Category', key: 'distance_category' },
          { header: 'Residence Type', key: 'residence_type' },
          { header: 'Document Type', key: 'document_type' },
          { header: 'Verification Status', key: 'verification_status' },
          { header: 'Case Reference', key: 'case_reference' },
          { header: 'Final Decision', key: 'final_decision' }
        ];
        break;
    }

    const exportResult = await generateExcelReport({
      fileNamePrefix: prefix,
      category: 'Analytics Report',
      sheetName: 'Collman BGV Report',
      columns,
      data: rows,
      generatedBy: req.user.full_name
    });

    res.json({
      success: true,
      message: `Report generated successfully with ${rows.length} record(s) and placed into Download Area.`,
      fileName: exportResult.fileName,
      recordCount: rows.length
    });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;

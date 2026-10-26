import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Cleanly format value for tabular export
 */
function formatCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return Number.isInteger(val) ? val : Number(val.toFixed(2));
  return String(val);
}

/**
 * Export report to Excel (.xlsx)
 * @param {string} title Report Title (e.g. "ANANTHA STORES - Daily Sales Report")
 * @param {string} period Filter period label (e.g. "Today (22 Oct 2026)")
 * @param {Array<{ key: string, label: string }>} columns Column definitions
 * @param {Array<Object>} rows Data rows
 * @param {Array<{ label: string, value: any }>} summaryRows Optional key-value summary metrics
 */
export function exportReportToExcel(title, period, columns, rows, summaryRows = []) {
  try {
    const wb = XLSX.utils.book_new();

    // Build worksheet data array of arrays (AOA)
    const aoa = [
      ['ANANTHA STORES - POS BILLING & INVENTORY SYSTEM'],
      [title],
      [`Reporting Period: ${period || 'All Time'}`],
      [`Generated On: ${new Date().toLocaleString('en-IN')}`],
      [], // blank line
    ];

    if (summaryRows && summaryRows.length > 0) {
      aoa.push(['--- SUMMARY METRICS ---']);
      summaryRows.forEach(s => {
        aoa.push([s.label, formatCell(s.value)]);
      });
      aoa.push([]); // blank line
    }

    // Header row
    const headers = columns.map(c => c.label);
    aoa.push(headers);

    // Data rows
    rows.forEach(r => {
      const rowData = columns.map(c => {
        const val = r[c.key];
        return formatCell(val);
      });
      aoa.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-fit column widths
    const maxCols = headers.length > 2 ? headers.length : 3;
    ws['!cols'] = Array(maxCols).fill({ wch: 22 });

    const safeTitle = (title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, safeTitle);

    const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    return true;
  } catch (err) {
    console.error('Failed to export to Excel:', err);
    throw new Error('Excel export failed: ' + err.message);
  }
}

/**
 * Export report to CSV with UTF-8 BOM
 * @param {string} title Report Title
 * @param {string} period Filter period label
 * @param {Array<{ key: string, label: string }>} columns Column definitions
 * @param {Array<Object>} rows Data rows
 * @param {Array<{ label: string, value: any }>} summaryRows Optional summary metrics
 */
export function exportReportToCSV(title, period, columns, rows, summaryRows = []) {
  try {
    const lines = [
      `"ANANTHA STORES - POS BILLING & INVENTORY SYSTEM"`,
      `"${title.replace(/"/g, '""')}"`,
      `"Reporting Period: ${(period || 'All Time').replace(/"/g, '""')}"`,
      `"Generated On: ${new Date().toLocaleString('en-IN').replace(/"/g, '""')}"`,
      '',
    ];

    if (summaryRows && summaryRows.length > 0) {
      lines.push('"--- SUMMARY METRICS ---"');
      summaryRows.forEach(s => {
        const safeVal = String(formatCell(s.value)).replace(/"/g, '""');
        lines.push(`"${s.label.replace(/"/g, '""')}","${safeVal}"`);
      });
      lines.push('');
    }

    // Header row
    const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    lines.push(headers);

    // Data rows
    rows.forEach(r => {
      const rowData = columns.map(c => {
        const val = r[c.key];
        const formatted = formatCell(val);
        return `"${String(formatted).replace(/"/g, '""')}"`;
      }).join(',');
      lines.push(rowData);
    });

    // UTF-8 BOM to ensure Tamil text displays correctly in Excel/Spreadsheets
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to export to CSV:', err);
    throw new Error('CSV export failed: ' + err.message);
  }
}

/**
 * Export report to professional, selectable-text vector PDF
 * Follows Palette: Navy Blue (#17365D) + Primary Orange (#F97316) + Light Grey (#F3F6FA)
 * @param {string} title Report Title (e.g. "Weekly Sales Report")
 * @param {string} period Filter period label (e.g. "This Week (19 Oct - 25 Oct 2026)")
 * @param {Array<{ key: string, label: string }>} columns Column definitions
 * @param {Array<Object>} rows Data rows
 * @param {Array<{ label: string, value: any }>} summaryRows Optional summary metrics
 */
export function exportReportToPDF(title, period, columns, rows, summaryRows = []) {
  try {
    const isWide = columns.length > 5;
    const doc = new jsPDF({
      orientation: isWide ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36; // 0.5 inch margins

    // 1. Top Decorative Brand Banner (Primary Navy #17365D)
    doc.setFillColor(23, 54, 93); // #17365D
    doc.rect(margin, 25, pageWidth - (margin * 2), 4, 'F');

    // 2. Header Content
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(23, 54, 93); // Primary Navy #17365D
    doc.text('ANANTHA STORES', margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500 #64748B
    doc.text('DEPARTMENTAL STORE POS & INVENTORY MANAGEMENT', margin, 60);

    // Report Title & Period badge on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(249, 115, 22); // Primary Orange #F97316
    doc.text(title, pageWidth - margin, 48, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Period: ${period || 'All Time'}  |  Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 60, { align: 'right' });

    let currentY = 72;

    // 3. Optional Summary Metrics Box
    if (summaryRows && summaryRows.length > 0) {
      const summaryBoxHeight = 44;
      doc.setFillColor(243, 246, 250); // Background #F3F6FA
      doc.setDrawColor(217, 226, 239); // Border #D9E2EF
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, 'FD');

      const colWidth = (pageWidth - (margin * 2)) / Math.min(summaryRows.length, 6);
      summaryRows.slice(0, 6).forEach((s, idx) => {
        const xPos = margin + (idx * colWidth) + 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(String(s.label).toUpperCase(), xPos, currentY + 16);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(23, 54, 93); // Navy Text #17365D
        doc.text(String(s.value), xPos, currentY + 32);
      });

      currentY += summaryBoxHeight + 12;
    }

    // 4. Table Construction
    if (!rows || rows.length === 0) {
      // Empty state banner
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 40, 4, 4, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(185, 28, 28);
      doc.text('No sales transactions or records found for the selected reporting period.', margin + 14, currentY + 24);
    } else {
      const headers = columns.map(c => c.label);
      const bodyData = rows.map(r => {
        return columns.map(c => {
          const val = r[c.key];
          return formatCell(val);
        });
      });

      // Compute numeric column alignment
      const colStyles = {};
      columns.forEach((col, idx) => {
        const lowerKey = col.key.toLowerCase();
        const lowerLabel = col.label.toLowerCase();
        if (
          lowerKey.includes('sales') ||
          lowerKey.includes('price') ||
          lowerKey.includes('cost') ||
          lowerKey.includes('profit') ||
          lowerKey.includes('amount') ||
          lowerKey.includes('total') ||
          lowerKey.includes('count') ||
          lowerKey.includes('bill') ||
          lowerKey.includes('qty') ||
          lowerKey.includes('stock') ||
          lowerLabel.includes('₹') ||
          lowerLabel.includes('%')
        ) {
          colStyles[idx] = { halign: 'right' };
        }
      });

      const autoTableFn = autoTable.default || autoTable;
      autoTableFn(doc, {
        startY: currentY,
        margin: { left: margin, right: margin, top: 40, bottom: 40 },
        head: [headers],
        body: bodyData,
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: isWide ? 7.5 : 8.5,
          cellPadding: isWide ? 4 : 5,
          textColor: [23, 54, 93], // Navy Text #17365D
          lineColor: [217, 226, 239], // Border #D9E2EF
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [255, 241, 231], // Light orange surface #FFF1E7
          textColor: [23, 54, 93], // Navy Text #17365D
          fontStyle: 'bold',
          fontSize: isWide ? 8 : 9,
          lineColor: [217, 226, 239],
        },
        alternateRowStyles: {
          fillColor: [243, 246, 250], // Background #F3F6FA
        },
        columnStyles: colStyles,
        showHead: 'everyPage',
      });
    }

    // 5. Page Numbering & Footer Stamp on Every Page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();

      // Thin footer line
      doc.setDrawColor(217, 226, 239); // Border #D9E2EF
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text('ANANTHA STORES POS  •  Confidential Retail Business Report', margin, pageHeight - 14);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
    }

    // 6. Trigger Download
    const safeTitle = (title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `ANANTHA_${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('Failed to export to PDF:', err);
    throw new Error('PDF export failed: ' + err.message);
  }
}

/**
 * Export failed / rejected import rows to CSV for user correction
 * @param {Array<Object>} failedRows List of failed row objects
 * @param {string} filename Base filename
 */
export function exportFailedRowsToCSV(failedRows, filename = 'failed_import_rows') {
  try {
    const columns = [
      { key: 'rowNumber', label: 'Row #' },
      { key: 'name', label: 'Product Name' },
      { key: 'tamilName', label: 'Tamil Name' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'categoryName', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'purchasePrice', label: 'Purchase Cost (₹)' },
      { key: 'sellingPrice', label: 'Selling Price (₹)' },
      { key: 'openingStock', label: 'Initial Stock' },
      { key: 'minimumStock', label: 'Min Stock' },
      { key: 'errorMessage', label: 'Validation Errors' },
    ];

    const lines = [
      `"ANANTHA STORES - IMPORT VALIDATION ERROR REPORT"`,
      `"Generated On: ${new Date().toLocaleString('en-IN').replace(/"/g, '""')}"`,
      `"Total Rejected Rows: ${failedRows.length}"`,
      `"Instructions: Correct the errors in this sheet and re-upload into Admin Product Import."`,
      '',
    ];

    // Header row
    lines.push(columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(','));

    // Data rows
    failedRows.forEach(r => {
      const rowData = columns.map(c => {
        let val = r[c.key];
        if (c.key === 'errorMessage' && (!val || val === '') && r.errors && Array.isArray(r.errors)) {
          val = r.errors.join('; ');
        }
        const formatted = formatCell(val);
        return `"${String(formatted).replace(/"/g, '""')}"`;
      }).join(',');
      lines.push(rowData);
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeFilename = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to export failed rows to CSV:', err);
    throw new Error('Failed to export CSV: ' + err.message);
  }
}

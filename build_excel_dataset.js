import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Load generated 100 products json
const rawData = fs.readFileSync('products_100_data.json', 'utf8');
const products = JSON.parse(rawData);

console.log(`Loaded ${products.length} products for Excel generation.`);

// 1. Create 100-Product Excel file with required exact columns
const worksheetData = products.map((p) => ({
  product_name: p.product_name,
  tamil_name: p.tamil_name,
  brand: p.brand,
  category: p.category,
  unit: p.unit,
  purchase_price: p.purchase_price,
  selling_price: p.selling_price,
  opening_stock: p.opening_stock,
  minimum_stock: p.minimum_stock,
  image_filename: p.image_filename,
  status: p.status,
}));

const ws = XLSX.utils.json_to_sheet(worksheetData);

// Set column widths for comfortable Excel readability
ws['!cols'] = [
  { wch: 45 }, // product_name
  { wch: 40 }, // tamil_name
  { wch: 18 }, // brand
  { wch: 18 }, // category
  { wch: 10 }, // unit
  { wch: 15 }, // purchase_price
  { wch: 15 }, // selling_price
  { wch: 15 }, // opening_stock
  { wch: 15 }, // minimum_stock
  { wch: 22 }, // image_filename
  { wch: 10 }, // status
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Anantha_Store_100_Products');

// Write Excel file to project root and public folder
const excelPath = 'anantha_store_100_products.xlsx';
const publicExcelPath = 'public/anantha_store_100_products.xlsx';
XLSX.writeFile(wb, excelPath);
XLSX.writeFile(wb, publicExcelPath);
console.log(`✔ Generated: ${excelPath} and ${publicExcelPath}`);

// 2. Also create an empty/sample template with 3 sample rows
const templateRows = [
  {
    product_name: 'Parle-G Glucose Biscuit 250g',
    tamil_name: 'பார்லே-ஜி குளுக்கோஸ் பிஸ்கட் 250கி',
    brand: 'Parle',
    category: 'Biscuits',
    unit: 'pack',
    purchase_price: 22.0,
    selling_price: 25.0,
    opening_stock: 100,
    minimum_stock: 15,
    image_filename: 'biscuit-001.png',
    status: 'active',
  },
  {
    product_name: 'Aavin Toned Fresh Milk Pouch 500ml',
    tamil_name: 'ஆவின் சமன்படுத்தப்பட்ட பால் 500மி.லி',
    brand: 'Aavin',
    category: 'Dairy',
    unit: 'pack',
    purchase_price: 22.0,
    selling_price: 25.0,
    opening_stock: 50,
    minimum_stock: 10,
    image_filename: 'dairy-001.png',
    status: 'active',
  },
  {
    product_name: 'Surf Excel Quick Wash Detergent Powder 1kg',
    tamil_name: 'சர்ப் எக்செல் குயிக் வாஷ் சலவை தூள் 1கிலோ',
    brand: 'Surf Excel',
    category: 'Household',
    unit: 'pack',
    purchase_price: 135.0,
    selling_price: 155.0,
    opening_stock: 40,
    minimum_stock: 10,
    image_filename: 'household-001.png',
    status: 'active',
  },
];

const templateWs = XLSX.utils.json_to_sheet(templateRows);
templateWs['!cols'] = ws['!cols'];
const templateWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(templateWb, templateWs, 'Products_Template');

const templatePath = 'anantha_store_products_template.xlsx';
const publicTemplatePath = 'public/anantha_store_products_template.xlsx';
XLSX.writeFile(templateWb, templatePath);
XLSX.writeFile(templateWb, publicTemplatePath);
console.log(`✔ Generated: ${templatePath} and ${publicTemplatePath}`);

// 3. Generate CSV version for instant previews
const csvContent = XLSX.utils.sheet_to_csv(ws);
fs.writeFileSync('anantha_store_100_products.csv', csvContent, 'utf8');
fs.writeFileSync('public/anantha_store_100_products.csv', csvContent, 'utf8');
console.log(`✔ Generated CSV files`);

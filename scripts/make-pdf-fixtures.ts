/**
 * Generates synthetic statement and CAS PDFs for tests. Every name, number and
 * reference is invented. Run with `npm run fixtures:pdf`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "@cantoo/pdf-lib";

type Row = string[];
type StatementSpec = {
  file: string;
  title: string;
  meta: string[];
  columns: { label: string; x: number }[];
  rows: Row[];
  opening: string;
  closing: string;
  password?: string;
};

function write(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size = 8,
) {
  page.drawText(text, { x, y, size, font });
}

async function statement(spec: StatementSpec) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([842, 595]);
  let y = 560;
  write(page, font, spec.title, 30, y, 12);
  for (const line of spec.meta) write(page, font, line, 30, (y -= 16));
  write(page, font, `Opening Balance  ${spec.opening}`, 30, (y -= 16));
  const header = () => {
    y -= 24;
    for (const column of spec.columns)
      write(page, font, column.label, column.x, y);
  };
  header();
  spec.rows.forEach((row, index) => {
    if (index > 0 && index % 20 === 0) {
      page = doc.addPage([842, 595]);
      y = 560;
      header();
    }
    y -= 14;
    row.forEach((cell, column) => {
      if (cell) write(page, font, cell, spec.columns[column].x, y);
    });
  });
  write(page, font, `Closing Balance  ${spec.closing}`, 30, (y -= 24));
  if (spec.password)
    doc.encrypt({
      userPassword: spec.password,
      ownerPassword: spec.password + "-owner",
      permissions: { printing: "highResolution", copying: true },
    });
  writeFileSync(
    `tests/fixtures/pdf/${spec.file}`,
    await doc.save({ useObjectStreams: false }),
  );
}

const hdfcColumns = [
  { label: "Date", x: 30 },
  { label: "Narration", x: 90 },
  { label: "Chq./Ref.No.", x: 370 },
  { label: "Value Dt", x: 470 },
  { label: "Withdrawal Amt.", x: 540 },
  { label: "Deposit Amt.", x: 640 },
  { label: "Closing Balance", x: 730 },
];
const hdfcRows: Row[] = [
  [
    "01/11/26",
    "NEFT CR-ICIC0000123-ACME TECHNOLOGIES PVT LTD-SALARY NOV",
    "ICICN52026110112345",
    "01/11/26",
    "",
    "75,000.00",
    "85,000.00",
  ],
  [
    "05/11/26",
    "ACH D- NACH HOME LOAN EMI",
    "0000000000123456",
    "05/11/26",
    "20,000.00",
    "",
    "65,000.00",
  ],
  [
    "12/11/26",
    "POS 412345XXXXXX5678 HPCL PETROL PUMP",
    "0000431234567890",
    "12/11/26",
    "2,000.00",
    "",
    "63,000.00",
  ],
  [
    "25/11/26",
    "UPI-SWIGGY-SWIGGY@ICICI-433112345678-PAYMENT",
    "0000433112345678",
    "25/11/26",
    "499.00",
    "",
    "62,501.00",
  ],
  [
    "28/11/26",
    "UPI-RAHUL K-RAHUL.K@OKICICI-433212345699-RENT SHARE",
    "0000433212345699",
    "28/11/26",
    "",
    "1,500.00",
    "64,001.00",
  ],
];

async function main() {
  mkdirSync("tests/fixtures/pdf", { recursive: true });
  mkdirSync("tests/fixtures/cas", { recursive: true });
  const hdfcMeta = [
    "Account Number : 50100012341234",
    "Statement From : 01/11/2026 To : 30/11/2026",
    "Customer ID : 99999999",
  ];
  await statement({
    file: "hdfc.pdf",
    title: "HDFC BANK Ltd. Statement of Account",
    meta: hdfcMeta,
    columns: hdfcColumns,
    rows: hdfcRows,
    opening: "10,000.00",
    closing: "64,001.00",
    password: "TEST1234",
  });
  await statement({
    file: "hdfc-bad-reconciliation.pdf",
    title: "HDFC BANK Ltd. Statement of Account",
    meta: hdfcMeta,
    columns: hdfcColumns,
    rows: hdfcRows.slice(0, 4),
    opening: "10,000.00",
    closing: "64,001.00",
  });
  await statement({
    file: "sbi.pdf",
    title: "STATE BANK OF INDIA Account Statement",
    meta: [
      "Account Number : 00000031234561234",
      "Period : 1 Nov 2026 to 30 Nov 2026",
    ],
    columns: [
      { label: "Txn Date", x: 30 },
      { label: "Value Date", x: 95 },
      { label: "Description", x: 160 },
      { label: "Ref No./Cheque No.", x: 420 },
      { label: "Debit", x: 560 },
      { label: "Credit", x: 650 },
      { label: "Balance", x: 740 },
    ],
    rows: [
      [
        "1 Nov 2026",
        "1 Nov 2026",
        "BY TRANSFER-NEFT*ACME TECHNOLOGIES SALARY",
        "SBIN426305123456",
        "",
        "50,000.00",
        "70,000.00",
      ],
      [
        "20 Nov 2026",
        "20 Nov 2026",
        "TO TRANSFER-NEFT*LANDLORD",
        "SBIN426328123456",
        "12,000.00",
        "",
        "58,000.00",
      ],
      [
        "25 Nov 2026",
        "25 Nov 2026",
        "TO TRANSFER-UPI/DR/433012345678/SWIGGY",
        "433012345678",
        "250.00",
        "",
        "57,750.00",
      ],
    ],
    opening: "20,000.00",
    closing: "57,750.00",
  });
  await statement({
    file: "icici.pdf",
    title: "ICICI BANK LIMITED Detailed Statement",
    meta: [
      "Account Number : XXXXXXXX1234",
      "Transactions List From 01/11/2026 To 30/11/2026",
    ],
    columns: [
      { label: "S No.", x: 30 },
      { label: "Value Date", x: 60 },
      { label: "Transaction Date", x: 125 },
      { label: "Cheque Number", x: 200 },
      { label: "Transaction Remarks", x: 270 },
      { label: "Withdrawal Amount (INR )", x: 520 },
      { label: "Deposit Amount (INR )", x: 630 },
      { label: "Balance (INR )", x: 740 },
    ],
    rows: [
      [
        "1",
        "01/11/2026",
        "01/11/2026",
        "",
        "NEFT-SALARY-ACME TECHNOLOGIES",
        "",
        "60,000.00",
        "65,000.00",
      ],
      [
        "2",
        "25/11/2026",
        "25/11/2026",
        "",
        "UPI/433312345678/ZOMATO/zomato@hdfcbank",
        "350.00",
        "",
        "64,650.00",
      ],
    ],
    opening: "5,000.00",
    closing: "64,650.00",
  });
  await statement({
    file: "axis.pdf",
    title: "AXIS BANK Statement of Account",
    meta: [
      "Account No : 912010012341234",
      "Statement period From : 01-11-2026 To : 30-11-2026",
    ],
    columns: [
      { label: "Tran Date", x: 30 },
      { label: "Chq No", x: 100 },
      { label: "Particulars", x: 170 },
      { label: "Debit", x: 520 },
      { label: "Credit", x: 610 },
      { label: "Balance", x: 700 },
      { label: "Init. Br", x: 790 },
    ],
    rows: [
      [
        "25-11-2026",
        "",
        "UPI/P2M/433512345678/UBER INDIA",
        "450.00",
        "",
        "9,550.00",
        "001",
      ],
      [
        "26-11-2026",
        "",
        "UPI/P2A/433612345699/PRIYA S",
        "",
        "2,000.00",
        "11,550.00",
        "001",
      ],
    ],
    opening: "10,000.00",
    closing: "11,550.00",
  });
  await statement({
    file: "kotak.pdf",
    title: "KOTAK MAHINDRA BANK Account Statement",
    meta: ["Account No. 1234561234", "Period 01-11-2026 to 30-11-2026"],
    columns: [
      { label: "Date", x: 30 },
      { label: "Narration", x: 100 },
      { label: "Chq/Ref No", x: 400 },
      { label: "Withdrawal (Dr)", x: 520 },
      { label: "Deposit (Cr)", x: 630 },
      { label: "Balance", x: 740 },
    ],
    rows: [
      [
        "25-11-2026",
        "UPI/RAPIDO/433712345678/Ride",
        "UPI-433712345678",
        "220.00",
        "",
        "7,780.00",
      ],
      [
        "24-11-2026",
        "UPI/AMIT S/433812345699/Dinner",
        "UPI-433812345699",
        "",
        "3,000.00",
        "10,780.00",
      ],
    ],
    opening: "8,000.00",
    closing: "10,780.00",
  });

  // CAMS-style mutual fund CAS: includes personal-detail lines that must never be stored.
  const cams = await PDFDocument.create();
  const font = await cams.embedFont(StandardFonts.Helvetica);
  const page = cams.addPage([595, 842]);
  const lines = [
    "Consolidated Account Statement",
    "01-Apr-2026 To 31-Oct-2026",
    "Investor Name: TEST INVESTOR",
    "Email Id: investor@example.com   Mobile: 9876543210",
    "Address: 1 Test Street, Testville",
    "Folio No: 1234567 / 89   PAN: ABCDE1234F   KYC: OK",
    "ACME-Acme Bluechip Fund - Direct Plan - Growth - ISIN: INF000A01011 (Advisor: DIRECT) Registrar : CAMS",
    "AMFI Code: 100001",
    "Opening Unit Balance: 0.000",
    "05-Apr-2026  SIP Purchase - Instalment 1/12  5,000.00  100.000  50.0000  100.000",
    "05-May-2026  SIP Purchase - Instalment 2/12  5,000.00  95.238  52.5000  195.238",
    "05-Jun-2026  Redemption  (1,100.00)  (20.000)  55.0000  175.238",
    "Closing Unit Balance: 175.238  NAV on 31-Oct-2026: INR 60.0000  Total Cost Value: 8,900.00  Market Value on 31-Oct-2026: INR 10,514.28",
    "Folio No: 7654321   PAN: ABCDE1234F   KYC: OK",
    "BETA-Beta Liquid Fund - Direct Plan - Growth - ISIN: INF000B01022 (Advisor: DIRECT) Registrar : KFINTECH",
    "Opening Unit Balance: 10.000",
    "10-Apr-2026  Purchase  2,000.00  1.000  2,000.0000  11.000",
    "Closing Unit Balance: 12.000  NAV on 31-Oct-2026: INR 2,100.0000  Total Cost Value: 22,000.00  Market Value on 31-Oct-2026: INR 25,200.00",
  ];
  lines.forEach((line, index) =>
    page.drawText(line, { x: 20, y: 800 - index * 16, size: 7, font }),
  );
  writeFileSync(
    "tests/fixtures/cas/cams.pdf",
    await cams.save({ useObjectStreams: false }),
  );

  const nsdl = await PDFDocument.create();
  const nsdlFont = await nsdl.embedFont(StandardFonts.Helvetica);
  const nsdlPage = nsdl.addPage([595, 842]);
  const rows: [string, number][] = [
    ["NSDL Consolidated Account Statement", 20],
    ["Statement for the period from 01-Oct-2026 to 31-Oct-2026", 20],
    ["Holdings as on 31-Oct-2026", 20],
    ["TEST INVESTOR  PAN: ABCDE1234F", 20],
    ["Equities (E)", 20],
    ["ISIN  Security  Shares  Market Price  Value", 20],
    ["INE000A01010  ACME INDUSTRIES LTD  10  2,500.00  25,000.00", 20],
    ["Exchange Traded Funds", 20],
    ["INF000E01010  ACME NIFTY 50 ETF  100  250.50  25,050.00", 20],
    ["Corporate Bonds", 20],
    ["INE000B07010  ACME CORP 8.5% NCD 2030  5  1,020.00  5,100.00", 20],
    ["Mutual Fund Folios (F)", 20],
    [
      "INF000A01011  ACME BLUECHIP FUND - DIRECT GROWTH  120.500  55.0000  6,627.50",
      20,
    ],
  ];
  rows.forEach(([text, x], index) =>
    nsdlPage.drawText(text, {
      x,
      y: 800 - index * 16,
      size: 8,
      font: nsdlFont,
    }),
  );
  writeFileSync(
    "tests/fixtures/cas/nsdl.pdf",
    await nsdl.save({ useObjectStreams: false }),
  );
  console.log("Synthetic PDF fixtures written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

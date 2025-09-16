const express = require('express');
const multer = require('multer');
const cors = require('cors');
const stream = require('stream');
const fs = require('fs');
const path = require('path');

const mammoth = require('mammoth');
const puppeteer = require('puppeteer');

const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  PDFAccessibilityCheckerJob,
  PDFAccessibilityCheckerResult,
  CreatePDFJob,
  FileRef,
} = require('@adobe/pdfservices-node-sdk');
require('dotenv').config();

const app = express();

app.use(
  cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  console.log('File name:', req.file.originalname);
  console.log('File size (bytes):', req.file.size);
  console.log('File mimetype:', req.file.mimetype);
  console.log('First 100 bytes (hex):', req.file.buffer.slice(0, 100).toString('hex'));

  let readStream;
  let mimeType = req.file.mimetype;
  let pdfBuffer;

  try {
    // Adobe PDF Services credentials
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.ADOBE_CLIENT_ID,
      clientSecret: process.env.ADOBE_CLIENT_SECRET,
    });

    const pdfServices = new PDFServices({ credentials });

    // If the file is a .docx, convert it to PDF using mammoth and puppeteer
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || req.file.originalname.endsWith('.docx')) {
      // Convert DOCX to HTML
      const mammothResult = await mammoth.convertToHtml({ buffer: req.file.buffer });
      const html = mammothResult.value;

      // Use puppeteer to render HTML to PDF
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();

      // Now set up a stream for the PDF
      readStream = new stream.PassThrough();
      readStream.end(pdfBuffer);
      mimeType = MimeType.PDF;
    } else {
      // If already PDF, use the uploaded buffer
      readStream = new stream.PassThrough();
      readStream.end(req.file.buffer);
      mimeType = MimeType.PDF;
    }

    // Upload the PDF (converted or original)
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF,
    });

    // Create Accessibility Checker job
    const job = new PDFAccessibilityCheckerJob({ inputAsset });

    // Submit the job
    const pollingURL = await pdfServices.submit({ job });

    // Get the result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: PDFAccessibilityCheckerResult,
    });

    // The report asset (JSON)
    const resultAssetReport = pdfServicesResponse.result.report;
    const streamAssetReport = await pdfServices.getContent({ asset: resultAssetReport });

    // --- Save JSON report to server ---
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

    const reportFileName = `${Date.now()}-accessibility-report.json`;
    const reportFilePath = path.join(reportsDir, reportFileName);

    const writeStream = fs.createWriteStream(reportFilePath);
    streamAssetReport.readStream.pipe(writeStream);

    // When finished writing, send the file to the client
    writeStream.on('finish', () => {
      res.download(reportFilePath, 'accessibility-report.json', (err) => {
        if (err) console.error('Error sending file:', err);
      });
    });
  } catch (err) {
    console.error('Error processing PDF:', err);
    res.status(500).send('Error processing PDF');
  } finally {
    readStream?.destroy();
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));

// const express = require('express');
// const multer = require('multer');
// const cors = require('cors');

// const app = express();

// app.use(
//   cors({
//     origin: 'http://localhost:4200',
//     methods: ['GET', 'POST', 'OPTIONS'],
//     allowedHeaders: ['Content-Type'],
//   })
// );

// const upload = multer({ storage: multer.memoryStorage() });

// app.post('/upload-pdf', upload.single('file'), async (req, res) => {
//   if (!req.file) return res.status(400).send('No file uploaded');

//   console.log('File name:', req.file.originalname);
//   console.log('File size (bytes):', req.file.size);
//   console.log('File mimetype:', req.file.mimetype);

//   // --- Dummy JSON for testing ---
//   const dummyReport = {
//     fileName: req.file.originalname,
//     uploadedAt: new Date().toISOString(),
//     wcagResults: [
//       { rule: '1.1.1 Non-text Content', status: 'pass' },
//       { rule: '1.2.1 Audio-only and Video-only (Prerecorded)', status: 'fail' },
//       { rule: '1.3.1 Info and Relationships', status: 'pass' },
//     ],
//     summary: {
//       totalRules: 3,
//       passed: 2,
//       failed: 1,
//     },
//   };

//   // Send as JSON file download
//   res.setHeader('Content-Disposition', 'attachment; filename="accessibility-report.json"');
//   res.setHeader('Content-Type', 'application/json');
//   res.send(JSON.stringify(dummyReport, null, 2));
// });

// app.listen(3000, () => console.log('Server running on port 3000'));

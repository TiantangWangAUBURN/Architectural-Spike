const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');

const app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      'https://kmoreland126.github.io',
      'https://kmoreland126.github.io/Accessibility-Checker',
      'http://localhost:4200',
      'https://localhost:4200'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// JSON body parsing middleware
app.use(express.json());

app.get('/', (req, res) => res.send('DOCX to PDF Converter - App is running'));

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload-docx', upload.single('file'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, buffer } = req.file;

    // Validate file type - only allow .docx files
    const isDocx = 
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.toLowerCase().endsWith('.docx');

    if (!isDocx) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only .docx files are allowed.' 
      });
    }

    console.log(`Processing .docx file: ${originalname} (${buffer.length} bytes)`);

    // Convert DOCX to HTML using mammoth
    const mammothResult = await mammoth.convertToHtml({ buffer });
    const html = mammothResult.value;

    // Extract text content for basic analysis
    const textContent = mammothResult.value.replace(/<[^>]*>/g, '').trim();
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;

    // Convert HTML to PDF using puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      }
    });
    
    await browser.close();

    // Generate basic document analysis
    const analysis = {
      fileName: originalname,
      originalSize: buffer.length,
      pdfSize: pdfBuffer.length,
      wordCount: wordCount,
      conversionTime: new Date().toISOString(),
      hasImages: html.includes('<img'),
      hasLinks: html.includes('<a'),
      hasTables: html.includes('<table'),
      hasHeadings: /(<h[1-6])/i.test(html),
      warnings: []
    };

    // Add warnings based on content analysis
    if (!analysis.hasHeadings) {
      analysis.warnings.push('Document may lack proper heading structure for accessibility');
    }
    
    if (analysis.hasImages && !html.includes('alt=')) {
      analysis.warnings.push('Images may be missing alt text descriptions');
    }
    
    if (wordCount < 10) {
      analysis.warnings.push('Document appears to have very little text content');
    }

    // Return PDF as base64 with analysis
    const response = {
      success: true,
      message: 'DOCX successfully converted to PDF',
      analysis: analysis,
      pdf: {
        data: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
        filename: originalname.replace('.docx', '.pdf')
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error processing DOCX file:', error);
    res.status(500).json({ 
      error: 'Error processing DOCX file: ' + error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'docx-to-pdf-converter',
    timestamp: new Date().toISOString() 
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`DOCX to PDF Converter running on port ${port}`);
  console.log('Supported: .docx files only');
  console.log('Features: DOCX to PDF conversion with basic accessibility analysis');
});
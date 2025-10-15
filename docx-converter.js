const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');

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

app.get('/', (req, res) => res.send('DOCX Analyzer - App is running'));

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

    // Convert DOCX to HTML using mammoth for analysis (keep the original .docx intact)
    const mammothResult = await mammoth.convertToHtml({ buffer });
    const html = mammothResult.value;

    // Extract text content for basic analysis
    const textContent = mammothResult.value.replace(/<[^>]*>/g, '').trim();
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;

    // Generate basic document analysis (no PDF conversion)
    const analysis = {
      fileName: originalname,
      originalSize: buffer.length,
      docxSize: buffer.length,
      wordCount: wordCount,
      analysisTime: new Date().toISOString(),
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

    // Return original DOCX as base64 with analysis
    const response = {
      success: true,
      message: 'DOCX uploaded and analyzed',
      analysis: analysis,
      docx: {
        data: buffer.toString('base64'),
        mimeType: mimetype,
        filename: originalname
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
    service: 'docx-analyzer',
    timestamp: new Date().toISOString() 
  });
});

// Export app for Vercel serverless
module.exports = app;

// Only start server when run directly (not on Vercel)
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`DOCX Analyzer running on port ${port}`);
    console.log('Supported: .docx files only');
    console.log('Features: DOCX analysis (no PDF conversion) with basic accessibility checks');
  });
}
const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  AutotagPDFParams,
  AutotagPDFJob,
  AutotagPDFResult,
} = require('@adobe/pdfservices-node-sdk');
const fs = require('fs');

require('dotenv').config();

async function runAnalysis() {
  let readStream;
  try {
    // Initial setup, create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.ADOBE_CLIENT_ID,
      clientSecret: process.env.ADOBE_CLIENT_SECRET,
    });

    // Creates a PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Creates an asset(s) from source file(s) and upload
    readStream = fs.createReadStream('./Adobe_Accessibility_Auto_Tag_API_Sample.pdf');
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF,
    });

    // Create parameters for the job
    const params = new AutotagPDFParams({
      generateReport: true,
      shiftHeadings: true,
    });

    // Creates a new job instance
    const job = new AutotagPDFJob({ inputAsset, params });

    // Submit the job and get the job result
    const pollingURL = await pdfServices.submit({ job });
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: AutotagPDFResult,
    });

    // Get content from the resulting asset(s)
    const resultAsset = pdfServicesResponse.result.taggedPDF;
    const resultAssetReport = pdfServicesResponse.result.report;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    const streamAssetReport = await pdfServices.getContent({ asset: resultAssetReport });

    // Creates output streams and write files
    const outputFilePath = './autotag-tagged.pdf';
    const outputFilePathReport = './autotag-report.xlsx';
    console.log(`Saving asset at ${outputFilePath}`);
    console.log(`Saving asset at ${outputFilePathReport}`);

    // Save tagged PDF
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputFilePath);
      streamAsset.readStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Save accessibility report
    await new Promise((resolve, reject) => {
      const writeStreamReport = fs.createWriteStream(outputFilePathReport);
      streamAssetReport.readStream.pipe(writeStreamReport);
      writeStreamReport.on('finish', resolve);
      writeStreamReport.on('error', reject);
    });
  } catch (err) {
    console.error('Exception encountered while executing operation:', err);
  } finally {
    readStream?.destroy();
  }
}

// Call the async function
runAnalysis();

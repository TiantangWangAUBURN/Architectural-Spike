const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential, InteractiveBrowserCredential } = require('@azure/identity');

class MicrosoftGraphService {
  constructor() {
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.graphClient = null;
  }

  // Initialize Graph client with application credentials
  async initializeGraphClient() {
    try {
      // For server-to-server scenarios, use client credentials
      const credential = new ClientSecretCredential(
        this.tenantId,
        this.clientId,
        this.clientSecret
      );

      this.graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const tokenResponse = await credential.getToken(['https://graph.microsoft.com/.default']);
            return tokenResponse.token;
          }
        }
      });

      console.log('Microsoft Graph client initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Graph client:', error);
      return false;
    }
  }

  // Get file content from OneDrive/SharePoint by file ID
  async getFileContent(fileId) {
    try {
      if (!this.graphClient) {
        await this.initializeGraphClient();
      }

      // Get file metadata
      const file = await this.graphClient.api(`/drives/me/items/${fileId}`).get();
      console.log('File metadata:', file.name, file.size);

      // Download file content
      const fileContent = await this.graphClient.api(`/drives/me/items/${fileId}/content`).get();
      
      return {
        name: file.name,
        size: file.size,
        mimeType: file.file?.mimeType,
        content: fileContent
      };
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  }

  // Convert Office document to PDF using Graph API
  async convertToPdf(fileId, originalName) {
    try {
      if (!this.graphClient) {
        await this.initializeGraphClient();
      }

      // Check if it's an Office document that can be converted
      const supportedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-word', // .doc
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.ms-excel' // .xls
      ];

      // Use Graph API's conversion endpoint
      const pdfContent = await this.graphClient
        .api(`/drives/me/items/${fileId}/content`)
        .query({ format: 'pdf' })
        .get();

      return {
        name: originalName.replace(/\.[^/.]+$/, '.pdf'),
        content: pdfContent,
        mimeType: 'application/pdf'
      };
    } catch (error) {
      console.error('Error converting to PDF:', error);
      throw error;
    }
  }

  // Extract text content from Office documents
  async extractTextContent(fileId) {
    try {
      if (!this.graphClient) {
        await this.initializeGraphClient();
      }

      // Get file metadata to determine type
      const file = await this.graphClient.api(`/drives/me/items/${fileId}`).get();
      const mimeType = file.file?.mimeType;

      let textContent = '';

      if (mimeType?.includes('wordprocessingml')) {
        // Word document - extract text
        textContent = await this.extractWordText(fileId);
      } else if (mimeType?.includes('presentationml')) {
        // PowerPoint - extract slide text
        textContent = await this.extractPowerPointText(fileId);
      } else if (mimeType?.includes('spreadsheetml')) {
        // Excel - extract cell text
        textContent = await this.extractExcelText(fileId);
      }

      return {
        name: file.name,
        mimeType: mimeType,
        textContent: textContent
      };
    } catch (error) {
      console.error('Error extracting text content:', error);
      throw error;
    }
  }

  // Extract text from Word documents
  async extractWordText(fileId) {
    try {
      // Get Word document content
      const content = await this.graphClient
        .api(`/drives/me/items/${fileId}/workbook/worksheets`)
        .get();
      
      // Note: This is a simplified example. In practice, you might need to use
      // the Word API endpoints or convert to a format that's easier to parse
      return 'Word document text content would be extracted here';
    } catch (error) {
      console.log('Word text extraction not fully implemented yet');
      return 'Word document content';
    }
  }

  // Extract text from PowerPoint presentations
  async extractPowerPointText(fileId) {
    try {
      // PowerPoint slides text extraction would go here
      return 'PowerPoint slide content would be extracted here';
    } catch (error) {
      console.log('PowerPoint text extraction not fully implemented yet');
      return 'PowerPoint presentation content';
    }
  }

  // Extract text from Excel workbooks
  async extractExcelText(fileId) {
    try {
      // Excel cells text extraction would go here
      return 'Excel worksheet content would be extracted here';
    } catch (error) {
      console.log('Excel text extraction not fully implemented yet');
      return 'Excel workbook content';
    }
  }

  // Search for files by name or type
  async searchFiles(query) {
    try {
      if (!this.graphClient) {
        await this.initializeGraphClient();
      }

      const searchResults = await this.graphClient
        .api('/drives/me/root/search')
        .query({ q: query })
        .get();

      return searchResults.value.map(item => ({
        id: item.id,
        name: item.name,
        size: item.size,
        mimeType: item.file?.mimeType,
        webUrl: item.webUrl
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }
}

module.exports = MicrosoftGraphService;
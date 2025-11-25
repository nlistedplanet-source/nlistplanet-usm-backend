import express from 'express';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import { protect, authorize } from '../middleware/auth.js';
import Company from '../models/Company.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   POST /api/admin/ocr/extract
// @desc    Extract company data from image using OCR
// @access  Admin
router.post('/ocr/extract', protect, authorize('admin'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    console.log('Processing OCR for image...');

    // Convert buffer to base64 for Tesseract
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Run OCR
    const { data: { text } } = await Tesseract.recognize(base64Image, 'eng', {
      logger: m => console.log(m)
    });

    console.log('Extracted text:', text);

    // Parse the extracted text to find company data
    const extractedData = parseCompanyData(text);

    res.json({
      success: true,
      rawText: text,
      extractedData,
      message: 'OCR completed successfully'
    });
  } catch (error) {
    console.error('OCR Error:', error);
    next(error);
  }
});

// Helper function to parse company data from OCR text
function parseCompanyData(text) {
  const data = {
    companyName: null,
    scripName: null,
    isin: null,
    pan: null,
    cin: null,
    sector: null,
    registrationDate: null,
    outstandingShares: null,
    faceValue: null,
    eps: null,
    peRatio: null,
    psRatio: null,
    marketCap: null,
    bookValue: null,
    pbv: null
  };

  // Extract Company Name
  const companyNameMatch = text.match(/Company Name[:\s]*([^\n]+)/i);
  if (companyNameMatch) {
    data.companyName = companyNameMatch[1].trim();
  }

  // Extract Scrip Name
  const scripNameMatch = text.match(/Scrip Name[:\s]*([^\n]+)/i);
  if (scripNameMatch) {
    data.scripName = scripNameMatch[1].trim();
  }

  // Extract ISIN
  const isinMatch = text.match(/ISIN\s*(?:No\.?)?[:\s]*(INE[A-Z0-9]+)/i);
  if (isinMatch) {
    data.isin = isinMatch[1].trim();
  }

  // Extract PAN
  const panMatch = text.match(/PAN\s*(?:No\.?)?[:\s]*([A-Z]{5}[0-9]{4}[A-Z])/i);
  if (panMatch) {
    data.pan = panMatch[1].trim();
  }

  // Extract CIN
  const cinMatch = text.match(/CIN[:\s]*(U\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d+)/i);
  if (cinMatch) {
    data.cin = cinMatch[1].trim();
  }

  // Extract Sector
  const sectorMatch = text.match(/Sector[:\s]*([^\n]+)/i);
  if (sectorMatch) {
    data.sector = sectorMatch[1].trim();
  }

  // Extract Registration Date
  const regDateMatch = text.match(/Registration Date[:\s]*([\d\/]+)/i);
  if (regDateMatch) {
    data.registrationDate = regDateMatch[1].trim();
  }

  // Extract Outstanding Shares
  const sharesMatch = text.match(/(?:No\.\s*of\s*)?Outstanding Shares[:\s]*([\d,]+)/i);
  if (sharesMatch) {
    data.outstandingShares = sharesMatch[1].replace(/,/g, '');
  }

  // Extract Face Value
  const faceValueMatch = text.match(/Face Value[:\s]*₹?\s*([\d.]+)/i);
  if (faceValueMatch) {
    data.faceValue = parseFloat(faceValueMatch[1]);
  }

  // Extract EPS
  const epsMatch = text.match(/EPS[:\s]*₹?\s*([\d.]+)/i);
  if (epsMatch) {
    data.eps = parseFloat(epsMatch[1]);
  }

  // Extract PE Ratio
  const peMatch = text.match(/PE\s*[Rr]atio[:\s]*([\d.]+)/i);
  if (peMatch) {
    data.peRatio = parseFloat(peMatch[1]);
  }

  // Extract P/S Ratio
  const psMatch = text.match(/P\/S\s*[Rr]atio[:\s]*([\d.]+)/i);
  if (psMatch) {
    data.psRatio = parseFloat(psMatch[1]);
  }

  // Extract Market Cap
  const marketCapMatch = text.match(/Market\s*Capitali[sz]ation[:\s]*₹?\s*([\d,.]+)\s*Crore/i);
  if (marketCapMatch) {
    data.marketCap = marketCapMatch[1].replace(/,/g, '');
  }

  // Extract Book Value
  const bookValueMatch = text.match(/Book\s*[Vv]alue[:\s]*₹?\s*([\d.]+)/i);
  if (bookValueMatch) {
    data.bookValue = parseFloat(bookValueMatch[1]);
  }

  // Extract P/BV
  const pbvMatch = text.match(/P\/BV[:\s]*([\d.]+)/i);
  if (pbvMatch) {
    data.pbv = parseFloat(pbvMatch[1]);
  }

  return data;
}

// @route   POST /api/admin/companies
// @desc    Create new company (with OCR data)
// @access  Admin
router.post('/companies', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { name, sector, logo, isin, cin, pan, description, ...otherData } = req.body;

    // Check if company already exists
    const existingCompany = await Company.findOne({ 
      $or: [
        { name: name },
        { isin: isin },
        { cin: cin }
      ]
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company already exists with this name, ISIN or CIN'
      });
    }

    // Create company
    const company = await Company.create({
      name,
      sector,
      logo: logo || '',
      isin: isin || '',
      cin: cin || '',
      pan: pan || '',
      description: description || '',
      ...otherData
    });

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/companies/:id
// @desc    Update company details
// @access  Admin
router.put('/companies/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      company[key] = req.body[key];
    });

    await company.save();

    res.json({
      success: true,
      message: 'Company updated successfully',
      company
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/admin/companies/:id
// @desc    Delete company
// @access  Admin
router.delete('/companies/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if company has active listings
    const Listing = (await import('../models/Listing.js')).default;
    const activeListings = await Listing.countDocuments({ 
      companyId: req.params.id,
      status: 'active'
    });

    if (activeListings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete company with ${activeListings} active listings`
      });
    }

    await company.deleteOne();

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/companies
// @desc    Get all companies (admin view with stats)
// @access  Admin
router.get('/companies', protect, authorize('admin'), async (req, res, next) => {
  try {
    const companies = await Company.find({}).sort({ name: 1 });

    // Get listing counts for each company
    const Listing = (await import('../models/Listing.js')).default;
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const listingsCount = await Listing.countDocuments({ 
          companyId: company._id,
          status: 'active'
        });
        
        return {
          ...company.toObject(),
          listingsCount
        };
      })
    );

    res.json({
      success: true,
      count: companiesWithStats.length,
      companies: companiesWithStats
    });
  } catch (error) {
    next(error);
  }
});

export default router;

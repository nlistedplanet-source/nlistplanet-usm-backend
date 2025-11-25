import express from 'express';
import Listing from '../models/Listing.js';
import Company from '../models/Company.js';
import Notification from '../models/Notification.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/listings
// @desc    Get all active listings (marketplace)
// @access  Public (with optional auth to filter own listings)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      type, // 'sell' or 'buy'
      companyId, 
      search,
      sort = '-createdAt', // -createdAt, price, -price
      page = 1,
      limit = 20
    } = req.query;

    const query = { status: 'active' };

    // Filter by type
    if (type) query.type = type;

    // Filter by company
    if (companyId) query.companyId = companyId;

    // Search by company name
    if (search) {
      query.companyName = { $regex: search, $options: 'i' };
    }

    // Hide own listings if user is logged in
    if (req.user) {
      query.userId = { $ne: req.user._id };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch listings with boosted ones first
    const listings = await Listing.find(query)
      .sort({ isBoosted: -1, [sort]: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username avatar fullName')
      .populate('companyId', 'CompanyName ScripName Logo Sector name logo sector PAN ISIN CIN pan isin cin');

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/listings/my
// @desc    Get user's own listings
// @access  Private
router.get('/my', protect, async (req, res, next) => {
  try {
    const { type, status = 'active' } = req.query;

    const query = { userId: req.user._id };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const listings = await Listing.find(query)
      .sort('-createdAt')
      .populate('companyId', 'CompanyName ScripName Logo Sector name logo sector PAN ISIN CIN pan isin cin');

    res.json({
      success: true,
      data: listings
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/listings/my-placed-bids
// @desc    Get bids/offers that current user placed on others' listings
// @access  Private
router.get('/my-placed-bids', protect, async (req, res, next) => {
  try {
    // Find all listings where current user has placed a bid or offer
    const listings = await Listing.find({
      $or: [
        { 'bids.userId': req.user._id },
        { 'offers.userId': req.user._id }
      ]
    })
      .sort('-createdAt')
      .populate('userId', 'username avatar fullName')
      .populate('companyId', 'CompanyName ScripName Logo Sector name logo sector PAN ISIN CIN pan isin cin');

    // Extract user's bids and offers from listings
    const myActivity = [];
    
    listings.forEach(listing => {
      // Check bids array (for sell posts)
      if (listing.bids && listing.bids.length > 0) {
        listing.bids.forEach(bid => {
          if (bid.userId.toString() === req.user._id.toString()) {
            myActivity.push({
              _id: bid._id,
              type: 'bid',
              listingType: listing.type,
              listing: {
                _id: listing._id,
                companyName: listing.companyName,
                companyId: listing.companyId,
                listingPrice: listing.price,
                listingQuantity: listing.quantity,
                owner: listing.userId
              },
              price: bid.price,
              quantity: bid.quantity,
              message: bid.message,
              status: bid.status,
              counterHistory: bid.counterHistory,
              createdAt: bid.createdAt
            });
          }
        });
      }
      
      // Check offers array (for buy posts)
      if (listing.offers && listing.offers.length > 0) {
        listing.offers.forEach(offer => {
          if (offer.userId.toString() === req.user._id.toString()) {
            myActivity.push({
              _id: offer._id,
              type: 'offer',
              listingType: listing.type,
              listing: {
                _id: listing._id,
                companyName: listing.companyName,
                companyId: listing.companyId,
                listingPrice: listing.price,
                listingQuantity: listing.quantity,
                owner: listing.userId
              },
              price: offer.price,
              quantity: offer.quantity,
              message: offer.message,
              status: offer.status,
              counterHistory: offer.counterHistory,
              createdAt: offer.createdAt
            });
          }
        });
      }
    });

    // Sort by creation date
    myActivity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: myActivity
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/listings
// @desc    Create new listing
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { type, companyId, price, quantity, minLot, companySegmentation, description } = req.body;

    // Validate company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Create listing
    const listing = await Listing.create({
      userId: req.user._id,
      username: req.user.username,
      type,
      companyId,
      companyName: company.CompanyName || company.name,
      companySegmentation: companySegmentation || null,
      price,
      quantity,
      minLot: minLot || 1,
      description
    });

    // Update company listings count
    company.totalListings += 1;
    await company.save();

    res.status(201).json({
      success: true,
      message: `${type === 'sell' ? 'Sell post' : 'Buy request'} created successfully`,
      data: listing
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/listings/:id/bid
// @desc    Place bid on sell post or make offer on buy request
// @access  Private
router.post('/:id/bid', protect, async (req, res, next) => {
  try {
    const { price, quantity, message } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Can't bid on own listing
    if (listing.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on your own listing'
      });
    }

    // Check if listing is active
    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Listing is not active'
      });
    }

    // Add bid/offer
    const bidData = {
      userId: req.user._id,
      username: req.user.username,
      price,
      quantity,
      message,
      counterHistory: []
    };

    if (listing.type === 'sell') {
      listing.bids.push(bidData);
    } else {
      listing.offers.push(bidData);
    }

    await listing.save();

    // Create notification for listing owner
    await Notification.create({
      userId: listing.userId,
      type: listing.type === 'sell' ? 'new_bid' : 'new_offer',
      title: listing.type === 'sell' ? 'New Bid Received' : 'New Offer Received',
      message: `@${req.user.username} ${listing.type === 'sell' ? 'placed a bid' : 'made an offer'} of ₹${price} for ${quantity} shares`,
      data: {
        listingId: listing._id,
        bidId: bidData._id,
        fromUser: req.user.username,
        amount: price,
        quantity,
        companyName: listing.companyName
      }
    });

    res.status(201).json({
      success: true,
      message: listing.type === 'sell' ? 'Bid placed successfully' : 'Offer made successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/listings/:id/boost
// @desc    Boost a listing
// @access  Private
router.put('/:id/boost', protect, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Set boost
    listing.isBoosted = true;
    listing.boostExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await listing.save();

    // Create transaction record
    const Transaction = (await import('../models/Transaction.js')).default;
    await Transaction.create({
      type: 'boost_fee',
      listingId: listing._id,
      sellerId: req.user._id,
      amount: process.env.BOOST_PRICE || 100,
      companyName: listing.companyName,
      description: `Boost fee for ${listing.type} post`
    });

    res.json({
      success: true,
      message: 'Listing boosted successfully for 24 hours'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/listings/:listingId/bids/:bidId/accept
// @desc    Accept a bid/offer
// @access  Private (listing owner only)
router.put('/:listingId/bids/:bidId/accept', protect, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this bid'
      });
    }

    // Find bid in appropriate array
    const bidArray = listing.type === 'sell' ? listing.bids : listing.offers;
    const bid = bidArray.id(req.params.bidId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Update bid status
    bid.status = 'accepted';
    await listing.save();

    // Create notification for bidder
    await Notification.create({
      userId: bid.userId,
      type: 'bid_accepted',
      title: 'Bid Accepted! 🎉',
      message: `Your ${listing.type === 'sell' ? 'bid' : 'offer'} of ₹${bid.price} for ${bid.quantity} shares of ${listing.companyName} has been accepted!`,
      data: {
        listingId: listing._id,
        bidId: bid._id,
        amount: bid.price,
        quantity: bid.quantity,
        companyName: listing.companyName
      }
    });

    res.json({
      success: true,
      message: 'Bid accepted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/listings/:listingId/bids/:bidId/reject
// @desc    Reject a bid/offer
// @access  Private (listing owner only)
router.put('/:listingId/bids/:bidId/reject', protect, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this bid'
      });
    }

    // Find bid in appropriate array
    const bidArray = listing.type === 'sell' ? listing.bids : listing.offers;
    const bid = bidArray.id(req.params.bidId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Update bid status
    bid.status = 'rejected';
    await listing.save();

    // Create notification for bidder
    await Notification.create({
      userId: bid.userId,
      type: 'bid_rejected',
      title: 'Bid Rejected',
      message: `Your ${listing.type === 'sell' ? 'bid' : 'offer'} of ₹${bid.price} for ${bid.quantity} shares of ${listing.companyName} has been rejected.`,
      data: {
        listingId: listing._id,
        bidId: bid._id,
        amount: bid.price,
        quantity: bid.quantity,
        companyName: listing.companyName
      }
    });

    res.json({
      success: true,
      message: 'Bid rejected successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/listings/:listingId/bids/:bidId/counter
// @desc    Counter a bid/offer
// @access  Private (listing owner only)
router.put('/:listingId/bids/:bidId/counter', protect, async (req, res, next) => {
  try {
    const { price, quantity, message } = req.body;
    const listing = await Listing.findById(req.params.listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to counter this bid'
      });
    }

    // Find bid in appropriate array
    const bidArray = listing.type === 'sell' ? listing.bids : listing.offers;
    const bid = bidArray.id(req.params.bidId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Add to counter history
    const round = (bid.counterHistory?.length || 0) + 1;
    bid.counterHistory.push({
      round,
      by: 'seller',
      price,
      quantity: quantity || bid.quantity,
      message: message || '',
      timestamp: new Date()
    });

    // Update bid status
    bid.status = 'countered';
    bid.price = price;
    if (quantity) bid.quantity = quantity;
    
    await listing.save();

    // Create notification for bidder
    await Notification.create({
      userId: bid.userId,
      type: 'bid_countered',
      title: 'Counter Offer Received',
      message: `Counter offer on ${listing.companyName}: ₹${price} for ${quantity || bid.quantity} shares`,
      data: {
        listingId: listing._id,
        bidId: bid._id,
        amount: price,
        quantity: quantity || bid.quantity,
        companyName: listing.companyName,
        round
      }
    });

    res.json({
      success: true,
      message: 'Counter offer sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/listings/:id
// @desc    Update/modify a listing
// @access  Private (listing owner only)
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { price, quantity, minQuantity } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing'
      });
    }

    // Can only update active listings
    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Can only update active listings'
      });
    }

    // Update fields
    if (price !== undefined) listing.price = price;
    if (quantity !== undefined) listing.quantity = quantity;
    if (minQuantity !== undefined) listing.minLot = minQuantity;
    
    await listing.save();

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: listing
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/listings/:id
// @desc    Delete a listing
// @access  Private (listing owner only)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Verify ownership
    if (listing.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this listing'
      });
    }

    // Can't delete listings with accepted bids/offers
    const hasAcceptedBids = listing.bids?.some(bid => bid.status === 'accepted') || 
                            listing.offers?.some(offer => offer.status === 'accepted');
    
    if (hasAcceptedBids) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete listing with accepted bids/offers. Please contact admin.'
      });
    }

    // Send notifications to all bidders/offers
    const bidUsers = [...(listing.bids || []), ...(listing.offers || [])].map(b => b.userId);
    if (bidUsers.length > 0) {
      await Notification.insertMany(
        bidUsers.map(userId => ({
          userId,
          type: 'listing_cancelled',
          title: 'Listing Cancelled',
          message: `The listing for ${listing.companyName} has been cancelled by the seller.`,
          data: {
            listingId: listing._id,
            companyName: listing.companyName
          }
        }))
      );
    }

    // Delete the listing
    await listing.deleteOne();

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import express from 'express';
import { protect } from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Company from '../models/Company.js';
import Listing from '../models/Listing.js';

const router = express.Router();

// @route   GET /api/portfolio/stats
// @desc    Get portfolio statistics (total invested, current value, P&L)
// @access  Private
router.get('/stats', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all completed transactions for the user
    const transactions = await Transaction.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      status: 'completed'
    });

    let totalInvested = 0;
    let totalReturns = 0;
    let totalShares = 0;

    transactions.forEach(tx => {
      const amount = tx.price * tx.quantity;
      
      if (tx.buyerId.toString() === userId.toString()) {
        // User bought shares
        totalInvested += amount;
        totalShares += tx.quantity;
      } else {
        // User sold shares
        totalReturns += amount;
        totalShares -= tx.quantity;
      }
    });

    const currentValue = totalInvested + totalReturns; // Simplified - can be enhanced with current market prices
    const profitLoss = totalReturns - totalInvested;
    const profitLossPercentage = totalInvested > 0 ? ((profitLoss / totalInvested) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalInvested,
        currentValue,
        profitLoss,
        profitLossPercentage: profitLossPercentage.toFixed(2),
        totalShares,
        totalTransactions: transactions.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/portfolio/holdings
// @desc    Get user's current holdings grouped by company
// @access  Private
router.get('/holdings', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all completed transactions
    const transactions = await Transaction.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      status: 'completed'
    }).populate('listingId', 'companyName companyId price');

    // Group by company and calculate holdings
    const holdingsMap = {};

    for (const tx of transactions) {
      const companyName = tx.listingId?.companyName || 'Unknown';
      
      if (!holdingsMap[companyName]) {
        holdingsMap[companyName] = {
          companyName,
          totalQuantity: 0,
          avgBuyPrice: 0,
          totalInvested: 0,
          transactions: []
        };
      }

      const holding = holdingsMap[companyName];
      const amount = tx.price * tx.quantity;

      if (tx.buyerId.toString() === userId.toString()) {
        // User bought
        holding.totalQuantity += tx.quantity;
        holding.totalInvested += amount;
        holding.transactions.push({
          type: 'buy',
          quantity: tx.quantity,
          price: tx.price,
          date: tx.createdAt
        });
      } else {
        // User sold
        holding.totalQuantity -= tx.quantity;
        holding.totalInvested -= amount;
        holding.transactions.push({
          type: 'sell',
          quantity: tx.quantity,
          price: tx.price,
          date: tx.createdAt
        });
      }

      // Calculate average buy price
      if (holding.totalQuantity > 0) {
        holding.avgBuyPrice = holding.totalInvested / holding.totalQuantity;
      }
    }

    // Convert to array and filter out zero holdings
    const holdings = Object.values(holdingsMap).filter(h => h.totalQuantity > 0);

    res.json({
      success: true,
      data: holdings
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/portfolio/activities
// @desc    Get recent portfolio activities (transactions, bids, offers)
// @access  Private
router.get('/activities', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    // Get recent transactions
    const transactions = await Transaction.find({
      $or: [{ buyerId: userId }, { sellerId: userId }]
    })
      .populate('listingId', 'companyName')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get recent bids/offers placed by user
    const listings = await Listing.find({
      $or: [
        { 'bids.userId': userId },
        { 'offers.userId': userId }
      ]
    })
      .select('companyName listingType bids offers createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Format activities
    const activities = [];

    // Add transactions
    transactions.forEach(tx => {
      activities.push({
        type: 'transaction',
        action: tx.buyerId.toString() === userId.toString() ? 'buy' : 'sell',
        companyName: tx.listingId?.companyName || 'Unknown',
        quantity: tx.quantity,
        price: tx.price,
        status: tx.status,
        date: tx.createdAt
      });
    });

    // Add bids/offers
    listings.forEach(listing => {
      const userBids = listing.bids?.filter(b => b.userId.toString() === userId.toString()) || [];
      const userOffers = listing.offers?.filter(o => o.userId.toString() === userId.toString()) || [];

      userBids.forEach(bid => {
        activities.push({
          type: 'bid',
          action: 'placed_bid',
          companyName: listing.companyName,
          quantity: bid.quantity,
          price: bid.price,
          status: bid.status,
          date: bid.createdAt
        });
      });

      userOffers.forEach(offer => {
        activities.push({
          type: 'offer',
          action: 'placed_offer',
          companyName: listing.companyName,
          quantity: offer.quantity,
          price: offer.price,
          status: offer.status,
          date: offer.createdAt
        });
      });
    });

    // Sort by date and limit
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: limitedActivities
    });
  } catch (error) {
    next(error);
  }
});

export default router;

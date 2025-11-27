# Username History Tracking System

## Overview
This system tracks all usernames ever used by users and prevents old usernames from being reassigned to different users. This protects user identity, prevents impersonation, and maintains accountability in the marketplace.

## Key Features

### 1. **Username History Database**
- All usernames (current and past) are stored permanently
- Each username is linked to the user who owned it
- Includes timestamp and reason for change

### 2. **Reassignment Prevention**
- Once a username is used, it cannot be assigned to another user
- Even if user changes their username, the old one is locked
- System checks history before allowing username changes

### 3. **User Previous Usernames Array**
- Each user has a `previousUsernames` array in their profile
- Shows chronological history of their username changes
- Useful for transparency and user history tracking

## Database Schema

### UsernameHistory Model
```javascript
{
  username: String,           // The username (lowercase)
  userId: ObjectId,           // Reference to User
  changedAt: Date,           // When it was changed/created
  reason: String,            // Reason for change
  timestamps: true
}
```

### User Model Addition
```javascript
{
  previousUsernames: [{
    username: String,
    changedAt: Date
  }]
}
```

## API Endpoints

### User Routes

#### Update Profile (with username change)
```
PUT /api/auth/profile
```

**Request:**
```json
{
  "username": "new_username_123",
  "fullName": "Updated Name",
  ...
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "username": "new_username_123",
    "previousUsernames": [
      {
        "username": "old_username",
        "changedAt": "2025-11-27T05:39:21.251Z"
      }
    ]
  }
}
```

**Error Response (400) - Username in history:**
```json
{
  "success": false,
  "message": "This username was previously used and cannot be assigned to another user"
}
```

### Admin Routes

#### View User's Username History
```
GET /api/admin/username-history/:userId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentUsername": "new_username",
    "email": "user@example.com",
    "previousUsernames": [
      {
        "username": "old_username",
        "changedAt": "2025-11-27T05:39:21.251Z"
      }
    ],
    "fullHistory": [
      {
        "_id": "...",
        "username": "old_username",
        "userId": "...",
        "changedAt": "2025-11-27T05:39:21.251Z",
        "reason": "User changed username"
      },
      {
        "_id": "...",
        "username": "initial_username",
        "userId": "...",
        "changedAt": "2025-11-19T10:15:57.000Z",
        "reason": "Initial registration"
      }
    ]
  }
}
```

#### Check Username Availability
```
GET /api/admin/check-username/:username
```

**Response (Available):**
```json
{
  "success": true,
  "available": true,
  "message": "Username is available and has never been used"
}
```

**Response (Not Available):**
```json
{
  "success": true,
  "available": false,
  "data": {
    "currentlyUsedBy": {
      "username": "coolshark339",
      "email": "user@example.com",
      "createdAt": "2025-11-19T10:15:57.000Z"
    },
    "previouslyUsedBy": {
      "username": "current_owner",
      "email": "owner@example.com",
      "changedAt": "2025-11-20T08:30:00.000Z",
      "reason": "User changed username"
    }
  }
}
```

## Migration & Setup

### Initial Migration
Run this script once to migrate all existing usernames to history:

```bash
node scripts/migrateUsernameHistory.js
```

**Output:**
```
✅ Connected to database
📊 Found 6 users to migrate

✅ Migrated: cobra_genius_366
✅ Migrated: coolshark339
✅ Migrated: cyber_millionaire_81
✅ Migrated: nlist_admin
✅ Migrated: champion_legend
✅ Migrated: delhi501

==================================================
📈 Migration Summary:
   Total Users: 6
   ✅ Migrated: 6
   ⏩ Skipped: 0
==================================================
```

### Testing
Verify the system works correctly:

```bash
node scripts/testUsernameHistory.js
```

## How It Works

### Registration Flow
1. User registers with username `coolshark339`
2. System creates user account
3. System adds `coolshark339` to `UsernameHistory` collection
4. Username is now permanently locked to this user

### Username Change Flow
1. User requests to change username from `coolshark339` to `new_user_2025`
2. System checks if `new_user_2025` exists in `UsernameHistory`
3. If found → Return error (username was used before)
4. If not found → Proceed:
   - Add `coolshark339` to `UsernameHistory`
   - Add `coolshark339` to user's `previousUsernames` array
   - Update user's username to `new_user_2025`
   - Add `new_user_2025` to `UsernameHistory`

### Prevention Example
```
User A: coolshark339 → changed to → shark_king_2025
User B: Tries to register as "coolshark339"
System: ❌ Blocks registration (username in history, owned by User A)
```

## Use Cases

### 1. Prevent Impersonation
```
Popular user "crypto_trader" changes to "crypto_trader_pro"
→ No one else can take "crypto_trader" and impersonate
```

### 2. Transaction Accountability
```
User made trades as "seller_123"
Changed username to "buyer_456"
→ Old transactions still show "seller_123"
→ Admin can track via username history
```

### 3. Brand Protection
```
Business owner "tesla_shares_dealer" changes username
→ Competitors cannot take the old username
→ Brand identity protected
```

### 4. Fraud Prevention
```
User with bad reputation changes username to escape history
→ Admin can view previousUsernames array
→ Link new and old accounts
→ Maintain trust & safety
```

## Security Benefits

1. **Identity Persistence**: Users cannot fully hide their history
2. **Impersonation Protection**: Old usernames are locked forever
3. **Audit Trail**: Complete history of username changes
4. **Marketplace Trust**: Buyers/sellers can be tracked across renames
5. **Admin Oversight**: Admins can view full username history

## Database Indexes
```javascript
UsernameHistory:
  - username: 1 (unique)
  - userId: 1, username: 1 (compound index)

User:
  - username: 1 (unique)
```

## Error Handling

### Duplicate Username in History
```javascript
if (existingHistory) {
  return res.status(400).json({
    success: false,
    message: 'This username was previously used and cannot be assigned to another user'
  });
}
```

### Database Error
```javascript
try {
  await UsernameHistory.create({...});
} catch (error) {
  if (error.code === 11000) {
    // Duplicate key error
    return res.status(400).json({
      success: false,
      message: 'Username already exists in history'
    });
  }
  next(error);
}
```

## Maintenance

### View All Username History
```javascript
db.usernamehistories.find().sort({ changedAt: -1 })
```

### Find User's Old Usernames
```javascript
db.users.findOne({ 
  email: 'user@example.com' 
}, { 
  previousUsernames: 1 
})
```

### Check Username Ownership
```javascript
db.usernamehistories.findOne({ username: 'coolshark339' })
```

## Future Enhancements

1. **Username Expiry**: Release usernames after X years of inactivity
2. **Username Reservation**: Allow users to reserve usernames before release
3. **Username Trading**: Allow users to transfer usernames (with admin approval)
4. **Frontend UI**: Show username history in user profile
5. **Notifications**: Alert user when someone tries to use their old username

## Support

For issues or questions about username history:
- Check logs in `logs/security.log`
- Run test script: `node scripts/testUsernameHistory.js`
- Contact: admin@nlistplanet.com

---

**Last Updated**: November 27, 2025  
**Version**: 1.0.0  
**Author**: NListPlanet Development Team

# Production Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Fix Syntax Error in Backend

The admin controller had a syntax error that has been fixed. Deploy the updated code:

```bash
cd d:\aarambh\backend

# Pull latest changes or copy the fixed files
git pull origin main

# Or if using direct file upload:
# Upload: src/controllers/adminController.js
```

**Fixed Issue:**
- Line 275: Changed `subscription Summary` → `subscriptionSummary`

---

### 2. Run Database Migration

The leaderboard requires a MongoDB compound index. Run this script:

```bash
cd d:\aarambh\backend

# Set your production MongoDB URI in .env first
# Then run the migration script:
node scripts/setup-leaderboard-index.js
```

This script will:
- ✅ Create the required compound index: `{ totalPoints: -1, _id: 1 }`
- ✅ Initialize `totalPoints` field for any users missing it
- ✅ Verify the index was created successfully
- ✅ Show you the top 5 users on the leaderboard

**Expected Output:**
```
✅ Connected to MongoDB
✅ Index created successfully
✅ Updated X users
📊 Sample leaderboard data (top 5 users):
  1. John Doe (john@example.com) - 150 points
  2. Jane Smith (jane@example.com) - 120 points
  ...
✅ Migration completed successfully!
```

---

### 3. Verify Environment Variables

Ensure your production `.env` file has all required variables:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aarambh
# or
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# SMTP (for subscription confirmation emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=your-email@gmail.com

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...

# CORS
FRONTEND_URL=https://your-app-url
ADMIN_PANEL_URL=https://your-admin-url

# Server
PORT=5000
NODE_ENV=production
```

---

### 4. Restart Backend Server

After fixing the code and running the migration:

```bash
# If using PM2:
pm2 restart aarambh-api

# Or if using a different process manager:
npm run start
# or
node src/app.js
```

---

### 5. Test the Fixes

#### Test Leaderboard:

**Using curl:**
```bash
# Replace with your JWT token and backend URL
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-backend-url/api/leaderboard
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Leaderboard fetched successfully",
  "data": {
    "rankings": [...],
    "totalUsers": 100,
    "me": {
      "id": "...",
      "name": "Your Name",
      "points": 50,
      "rank": 25
    }
  }
}
```

#### Test Admin Panel:

1. **Open Admin Panel:** `https://your-backend-url/admin`
2. **Login with admin credentials**
3. **Test Dashboard:** Should show subscription stats and revenue
4. **Test Users Tab:** Click on a user to see detailed info with subscriptions
5. **Test Subscriptions Tab:** Should load and display all subscriptions
6. **Test Game Questions Tab:** Should load games and questions
7. **Test Notifications Tab:** Should allow creating notifications

---

## 🔍 Troubleshooting

### Issue: Leaderboard still not working

**Check 1: Database Index**
```bash
mongosh "your-connection-string"
use aarambh
db.users.getIndexes()
```

Look for an index with `{ totalPoints: -1, _id: 1 }`. If missing, run the migration script.

**Check 2: User Data**
```bash
mongosh "your-connection-string"
use aarambh
db.users.findOne({ role: "user" })
```

Verify the user has a `totalPoints` field. If not, run the migration script.

**Check 3: API Authentication**
- Open browser dev tools → Network tab
- Open the leaderboard in the app
- Check if the API call to `/api/leaderboard` is successful
- If 401/403, there's an authentication issue

**Check 4: Backend Logs**
```bash
# If using PM2:
pm2 logs aarambh-api

# Check for errors related to leaderboard
```

---

### Issue: Admin Panel not loading data

**Check 1: CORS Settings**

Verify `backend/src/config/cors.js` includes your admin panel URL:

```javascript
const whitelist = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL,
  'http://localhost:3000',
  'http://localhost:8081',
];
```

**Check 2: Admin Authentication**
- Clear browser cookies
- Login again with admin credentials
- Check browser console for errors

**Check 3: API Endpoints**

Test each endpoint individually:
```bash
# Dashboard stats
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
     https://your-backend-url/api/admin/stats

# Users list
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
     https://your-backend-url/api/admin/users

# Subscriptions
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
     https://your-backend-url/api/admin/subscriptions
```

---

### Issue: Email confirmations not sending

**Check 1: SMTP Credentials**

Test SMTP connection:
```javascript
// Create a test file: backend/test-email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Error:', error);
  } else {
    console.log('✅ SMTP is ready to send emails');
  }
});
```

Run it:
```bash
node backend/test-email.js
```

**Check 2: Gmail App Password**

If using Gmail, you need an App Password (not your regular password):
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Generate an App Password for "Mail"
4. Use that password in `SMTP_PASS`

**Check 3: Backend Logs**

Check for email sending errors:
```bash
pm2 logs aarambh-api | grep -i email
```

---

## 📊 Monitoring

### Key Metrics to Monitor:

1. **Leaderboard Performance:**
   - API response time should be < 500ms
   - Check MongoDB slow query logs
   - Monitor index usage

2. **Email Delivery:**
   - Check `subscriptions` collection for `emailSent: true`
   - Monitor SMTP logs for failures
   - Track bounces and complaints

3. **Admin Panel Usage:**
   - Monitor API error rates
   - Check for slow queries
   - Track admin actions

---

## 🎯 Post-Deployment Checklist

### Backend:
- [ ] Syntax error fixed in `adminController.js`
- [ ] MongoDB compound index created
- [ ] All users have `totalPoints` field
- [ ] Backend server restarted
- [ ] No errors in server logs

### Database:
- [ ] Index exists: `db.users.getIndexes()`
- [ ] Sample query works: `db.users.find().sort({totalPoints:-1}).limit(5)`
- [ ] All users have `totalPoints` field

### Environment:
- [ ] All `.env` variables set
- [ ] SMTP credentials correct
- [ ] Razorpay keys correct (live, not test)
- [ ] CORS whitelist includes frontend and admin URLs

### Testing:
- [ ] Leaderboard loads in mobile app
- [ ] Admin dashboard shows subscription stats
- [ ] User details show subscriptions and courses
- [ ] Subscriptions tab loads data
- [ ] Email sent after test subscription purchase
- [ ] Game questions load in admin panel
- [ ] Notifications can be created and sent

### Mobile App:
- [ ] Test leaderboard loading
- [ ] Test points sync
- [ ] Test auto-refresh
- [ ] Verify rank calculation
- [ ] Check error handling

### Admin Panel:
- [ ] Login works
- [ ] Dashboard stats display
- [ ] All tabs load without errors
- [ ] User search/filter works
- [ ] Subscription list loads
- [ ] User detail modal works
- [ ] Email logs visible

---

## 🔄 Rollback Plan

If issues occur after deployment:

1. **Revert Code:**
   ```bash
   git revert HEAD
   pm2 restart aarambh-api
   ```

2. **Remove Index (if causing issues):**
   ```bash
   mongosh "connection-string"
   use aarambh
   db.users.dropIndex("totalPoints_-1__id_1")
   ```

3. **Restore Previous Version:**
   - Use your backup or previous deployment
   - Restore database snapshot if needed

---

## 📝 Changes Summary

### Files Modified:
1. `backend/src/controllers/adminController.js` - Fixed syntax error
2. `backend/src/models/User.js` - Already has index definition
3. `backend/src/controllers/leaderboardController.js` - No changes (working)

### Files Created:
1. `backend/scripts/setup-leaderboard-index.js` - Migration script
2. `FIXES_SUMMARY.md` - Detailed fix documentation
3. `PRODUCTION_DEPLOYMENT_GUIDE.md` - This file

### Database Changes:
1. New index: `{ totalPoints: -1, _id: 1 }` on `users` collection
2. Field initialization: `totalPoints: 0` for existing users

---

## 🆘 Support

If you encounter issues:

1. **Check Logs:**
   ```bash
   pm2 logs aarambh-api --lines 100
   ```

2. **Check MongoDB:**
   ```bash
   mongosh "connection-string" --eval "db.users.getIndexes()"
   ```

3. **Test API Directly:**
   Use Postman or curl to test endpoints

4. **Review Error Messages:**
   Check browser console and network tab

---

## ✅ Success Criteria

Deployment is successful when:

1. ✅ Backend starts without errors
2. ✅ Leaderboard API returns data
3. ✅ Mobile app displays leaderboard
4. ✅ Admin panel loads all sections
5. ✅ User details show subscriptions
6. ✅ Email confirmation sends after subscription
7. ✅ No errors in logs
8. ✅ Database index exists and is being used

---

**Last Updated:** 2026-08-14
**Version:** 1.0.0

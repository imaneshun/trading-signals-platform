# Deployment Guide - Trading Signals Platform

## Quick Netlify Deployment

### Option 1: Direct Netlify Deployment (Recommended)

1. **Prepare the project**:
   ```bash
   npm run build:css
   ```

2. **Deploy to Netlify**:
   - Go to [Netlify](https://netlify.com)
   - Click "Add new site" → "Deploy manually"
   - Drag and drop the entire project folder
   - Or connect your Git repository for automatic deployments

3. **Configure build settings**:
   - Build command: `npm run build:css`
   - Publish directory: `public`
   - Node version: `18`

### Option 2: Git-based Deployment

1. **Initialize Git repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Trading Signals Platform"
   ```

2. **Push to GitHub/GitLab**:
   ```bash
   git remote add origin YOUR_REPOSITORY_URL
   git push -u origin main
   ```

3. **Connect to Netlify**:
   - Go to Netlify dashboard
   - Click "Add new site" → "Import from Git"
   - Select your repository
   - Configure build settings as above

## Environment Variables

Set these in Netlify dashboard under Site settings → Environment variables:

```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random
NODE_ENV=production
DEFAULT_VIP_PRICE=29.99
```

## Important Notes

⚠️ **Database Limitation**: This platform uses SQLite which works for development but has limitations on Netlify:
- Netlify is a static hosting service
- The Node.js server with SQLite won't work on Netlify's static hosting
- Database changes won't persist between deployments

## Production-Ready Solutions

### Option A: Deploy to Heroku/Railway/Render (Recommended)

For a fully functional backend with persistent database:

1. **Heroku**:
   ```bash
   # Install Heroku CLI
   heroku create your-trading-signals-app
   heroku config:set JWT_SECRET=your-secret-key
   git push heroku main
   ```

2. **Railway**:
   - Connect your GitHub repository
   - Set environment variables
   - Deploy automatically

3. **Render**:
   - Connect repository
   - Set build command: `npm install`
   - Set start command: `npm start`

### Option B: Netlify Functions (Advanced)

Convert the Express server to Netlify Functions:

1. Create `netlify/functions/` directory
2. Split API routes into separate function files
3. Use external database (MongoDB Atlas, PlanetScale, etc.)

### Option C: Static Version for Netlify

Create a simplified static version:

1. Remove server-side functionality
2. Use localStorage for data persistence
3. Implement client-side only features
4. Deploy as static site

## Database Migration

For production deployment, consider:

1. **PostgreSQL** (Heroku Postgres, Supabase)
2. **MongoDB** (MongoDB Atlas)
3. **MySQL** (PlanetScale, Railway)

Update the database connection in `server.js` accordingly.

## Custom Domain Setup

After deployment:

1. Go to Netlify dashboard → Domain settings
2. Add custom domain
3. Configure DNS records
4. Enable HTTPS (automatic with Netlify)

## Security Checklist

- [ ] Change default admin credentials
- [ ] Update JWT secret to secure random string
- [ ] Configure CORS for production domain
- [ ] Set up rate limiting
- [ ] Enable HTTPS
- [ ] Review and update security headers

## Monitoring & Analytics

Consider adding:
- Google Analytics
- Error tracking (Sentry)
- Performance monitoring
- Database monitoring

## Backup Strategy

- Regular database backups
- Code repository backups
- Environment variables backup
- SSL certificate backup

## Support

For deployment issues:
1. Check build logs in Netlify dashboard
2. Verify environment variables
3. Test locally first
4. Check browser console for errors

---

**Current Status**: Ready for static deployment to Netlify with limitations. For full functionality, deploy to a platform that supports Node.js servers.

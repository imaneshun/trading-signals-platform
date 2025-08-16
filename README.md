# Trading Signals Platform

A modern, professional trading signals platform with VIP access system, built with Node.js, Express, and SQLite.

## Features

### Phase 1 - Free Signals ✅
- **Modern Landing Page**: Sleek, trading-themed design with dark mode
- **Free Trading Signals**: Display trading pairs, entry points, targets, and stop losses
- **Signal History**: Archive of past signals with filtering options
- **Responsive Design**: Mobile-friendly interface
- **User Authentication**: Email-based registration and login system

### Phase 2 - VIP Access ✅
- **VIP Signal Section**: Exclusive premium signals for VIP users
- **Activation Code System**: Redeem VIP codes for time-limited access
- **Admin Panel**: Complete management interface for signals and VIP codes
- **Signal Management**: Add, edit, delete, and schedule signals
- **VIP Code Generation**: Create activation codes with custom duration
- **Settings Management**: Configure VIP pricing and platform settings

### Additional Features ✅
- **Professional UI**: Trading-themed design with modern animations
- **Real-time Updates**: Dynamic signal loading and filtering
- **Secure Authentication**: JWT-based auth with bcrypt password hashing
- **Database Management**: SQLite database with proper schema
- **Admin Dashboard**: Statistics, analytics, and platform management
- **Notification System**: Toast notifications for user feedback

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3 (Tailwind CSS), Vanilla JavaScript
- **Authentication**: JWT, bcryptjs
- **Security**: Helmet, CORS, Rate limiting
- **Icons**: Lucide Icons
- **Fonts**: Inter, JetBrains Mono

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build CSS**:
   ```bash
   npm run build:css
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Start Production Server**:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## Default Admin Access

- **Email**: `admin@tradingsignals.com`
- **Password**: `admin123`

⚠️ **Important**: Change the default admin password in production!

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
DB_PATH=./trading_signals.db
ADMIN_EMAIL=admin@tradingsignals.com
ADMIN_PASSWORD=admin123
DEFAULT_VIP_PRICE=29.99
```

## Database Schema

The platform uses SQLite with the following tables:
- `users` - User accounts and VIP status
- `signals` - Trading signals with targets and analysis
- `vip_codes` - Activation codes for VIP access
- `settings` - Platform configuration

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Signals
- `GET /api/signals` - Get public signals
- `GET /api/signals/vip` - Get VIP signals (authenticated)

### VIP System
- `POST /api/redeem-code` - Redeem VIP activation code

### Admin (Authenticated)
- `GET /api/admin/signals` - Get all signals
- `POST /api/admin/signals` - Create signal
- `PUT /api/admin/signals/:id` - Update signal
- `DELETE /api/admin/signals/:id` - Delete signal
- `GET /api/admin/vip-codes` - Get VIP codes
- `POST /api/admin/vip-codes` - Generate VIP codes
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings

## Deployment

### Netlify Deployment

1. **Build the project**:
   ```bash
   npm run build:css
   ```

2. **Deploy to Netlify**:
   - Connect your repository to Netlify
   - Set build command: `npm run build:css`
   - Set publish directory: `public`
   - Add environment variables in Netlify dashboard

### Production Considerations

- Change JWT secret to a secure random string
- Update admin credentials
- Configure proper CORS origins
- Set up SSL/HTTPS
- Configure rate limiting based on your needs
- Set up database backups
- Monitor application logs

## Usage

### For Users
1. Visit the platform homepage
2. View free trading signals
3. Register for an account
4. Redeem VIP codes for premium access
5. Access exclusive VIP signals

### For Admins
1. Login with admin credentials
2. Access admin panel at `/admin.html`
3. Manage signals (add, edit, delete)
4. Generate VIP activation codes
5. Configure platform settings
6. Monitor platform statistics

## VIP Code System

- Codes are unique 12-character alphanumeric strings
- Each code has a duration (days of VIP access)
- Codes can have expiration dates
- Used codes are tracked with user information
- Codes extend existing VIP subscriptions

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization
- Admin-only routes protection

## Future Enhancements

- Payment gateway integration
- Email notifications
- Telegram bot integration
- Advanced analytics dashboard
- Signal performance tracking
- User referral system
- Multi-tier VIP levels
- Mobile app development

## Support

For technical support or questions, please contact the development team.

## License

MIT License - see LICENSE file for details.

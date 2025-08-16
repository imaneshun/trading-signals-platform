// Trading Signals Platform - Main JavaScript
class TradingSignalsPlatform {
    constructor() {
        this.currentUser = null;
        this.signals = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.initializeIcons();
        this.setupEventListeners();
        this.checkAuthStatus();
        this.loadSignals();
        this.setupSmoothScrolling();
    }

    initializeIcons() {
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Auth buttons
        this.setupAuthButtons();
        
        // Hero buttons
        document.getElementById('hero-signals-btn')?.addEventListener('click', () => {
            this.scrollToSection('signals');
        });
        
        document.getElementById('hero-vip-btn')?.addEventListener('click', () => {
            window.location.href = '/vip';
        });
        
        document.getElementById('hero-investment-btn')?.addEventListener('click', () => {
            window.location.href = '/investment';
        });
        
        document.getElementById('hero-dashboard-btn')?.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });

        // Signal filters
        this.setupSignalFilters();

        // VIP activation form
        this.setupVipActivation();

        // Navigation links
        this.setupNavigation();
    }

    setupAuthButtons() {
        // Login buttons
        document.getElementById('login-btn')?.addEventListener('click', () => this.showLoginModal());
        document.getElementById('mobile-login-btn')?.addEventListener('click', () => this.showLoginModal());
        
        // Register buttons
        document.getElementById('register-btn')?.addEventListener('click', () => this.showRegisterModal());
        document.getElementById('mobile-register-btn')?.addEventListener('click', () => this.showRegisterModal());
        
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Modal close buttons
        document.getElementById('close-login-modal')?.addEventListener('click', () => this.hideLoginModal());
        document.getElementById('close-register-modal')?.addEventListener('click', () => this.hideRegisterModal());

        // Switch between modals
        document.getElementById('switch-to-register')?.addEventListener('click', () => {
            this.hideLoginModal();
            this.showRegisterModal();
        });
        
        document.getElementById('switch-to-login')?.addEventListener('click', () => {
            this.hideRegisterModal();
            this.showLoginModal();
        });

        // Form submissions
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));

        // Close modals on backdrop click
        document.getElementById('login-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'login-modal') this.hideLoginModal();
        });
        
        document.getElementById('register-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'register-modal') this.hideRegisterModal();
        });
    }

    setupSignalFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Update current filter
                const filter = e.target.id.replace('filter-', '');
                this.currentFilter = filter;
                this.filterSignals(filter);
            });
        });
    }

    setupVipActivation() {
        const vipForm = document.getElementById('vip-activation-form');
        if (vipForm) {
            vipForm.addEventListener('submit', (e) => this.handleVipActivation(e));
        }
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('a[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                this.scrollToSection(targetId);
            });
        });
    }

    setupSmoothScrolling() {
        // Add smooth scrolling behavior
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const navHeight = document.querySelector('nav').offsetHeight;
            const sectionTop = section.offsetTop - navHeight;
            window.scrollTo({
                top: sectionTop,
                behavior: 'smooth'
            });
        }
    }

    // Authentication Methods
    checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.updateUIForAuthenticatedUser();
                this.showDashboardButton();
            } catch (error) {
                console.error('Error parsing user data:', error);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
            }
        }
        
        // Load payment methods and contact info for home page display
        this.loadHomePageInfo();
    }

    updateUIForAuthenticatedUser() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userEmail = document.getElementById('user-email');
        const vipBadge = document.getElementById('vip-badge');
        const adminLink = document.getElementById('admin-link');
        
        if (authButtons) authButtons.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userEmail) userEmail.textContent = this.currentUser.email;
        
        // Show VIP badge if user has VIP access
        if (this.currentUser.vip_expires_at) {
            const expiryDate = new Date(this.currentUser.vip_expires_at);
            const now = new Date();
            if (expiryDate > now && vipBadge) {
                vipBadge.classList.remove('hidden');
            }
        }
        
        // Show admin link if user is admin
        if (this.currentUser.isAdmin && adminLink) {
            adminLink.classList.remove('hidden');
        }
        
        this.showDashboardButton();
    }

    isVipActive() {
        if (!this.currentUser.vip_expires_at) return false;
        return new Date(this.currentUser.vip_expires_at) > new Date();
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }
    }

    showRegisterModal() {
        const modal = document.getElementById('register-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
    }

    hideRegisterModal() {
        const modal = document.getElementById('register-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                this.currentUser = data.user;
                this.hideLoginModal();
                this.updateUIForAuthenticatedUser();
                this.showNotification('Login successful!', 'success');
                this.loadSignals(); // Reload signals to show VIP ones if applicable
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm-password');

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                this.currentUser = data.user;
                this.hideRegisterModal();
                this.updateUIForAuthenticatedUser();
                this.showNotification('Account created successfully!', 'success');
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        this.currentUser = null;
        
        // Reset UI
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const vipBadge = document.getElementById('vip-badge');
        const adminLink = document.getElementById('admin-link');
        
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (vipBadge) vipBadge.classList.add('hidden');
        if (adminLink) adminLink.classList.add('hidden');
        
        this.hideDashboardButton();
        this.showNotification('Logged out successfully', 'success');
        
        // Reload signals to show only free signals
        this.loadSignals();
    }

    showDashboardButton() {
        const dashboardBtn = document.getElementById('hero-dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.classList.remove('hidden');
            dashboardBtn.style.display = 'inline-flex';
        }
    }

    hideDashboardButton() {
        const dashboardBtn = document.getElementById('hero-dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.classList.add('hidden');
            dashboardBtn.style.display = 'none';
        }
    }

    async loadHomePageInfo() {
        try {
            // Load payment methods for display
            const paymentResponse = await fetch('/api/payment-methods');
            if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                this.displayPaymentMethods(paymentData.paymentMethods);
            }

            // Load contact info for display
            const contactResponse = await fetch('/api/settings/contact');
            if (contactResponse.ok) {
                const contactData = await contactResponse.json();
                this.displayContactInfo(contactData);
            }
        } catch (error) {
            console.error('Error loading home page info:', error);
        }
    }

    displayPaymentMethods(methods) {
        const container = document.getElementById('payment-methods-list');
        if (!container || !methods) return;

        const activeMethods = methods.filter(method => method.is_active);
        container.innerHTML = activeMethods.map(method => `
            <div class="flex items-center space-x-2 text-sm text-gray-300">
                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>${method.name}</span>
            </div>
        `).join('');
    }

    displayContactInfo(contactData) {
        const container = document.getElementById('contact-info');
        if (!container || !contactData.method || !contactData.value) return;

        const icon = contactData.method === 'telegram' ? 'send' : 
                    contactData.method === 'whatsapp' ? 'phone' : 'phone';
        
        container.innerHTML = `
            <div class="flex items-center justify-center space-x-2">
                <i data-lucide="${icon}" class="w-4 h-4"></i>
                <span>${contactData.method.charAt(0).toUpperCase() + contactData.method.slice(1)}:</span>
                <span class="font-mono">${contactData.value}</span>
            </div>
        `;
        
        // Recreate icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Signals Methods
    async loadSignals() {
        const signalsGrid = document.getElementById('signals-grid');
        const signalsLoading = document.getElementById('signals-loading');

        if (signalsLoading) signalsLoading.classList.remove('hidden');
        if (signalsGrid) signalsGrid.innerHTML = '';

        try {
            const response = await fetch('/api/signals');
            const data = await response.json();

            if (response.ok) {
                this.signals = data;
                this.renderSignals(this.signals);
            } else {
                this.showNotification('Failed to load signals', 'error');
            }
        } catch (error) {
            console.error('Error loading signals:', error);
            this.showNotification('Network error loading signals', 'error');
        } finally {
            if (signalsLoading) signalsLoading.classList.add('hidden');
        }
    }

    renderSignals(signals) {
        const signalsGrid = document.getElementById('signals-grid');
        if (!signalsGrid) return;

        if (signals.length === 0) {
            signalsGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="text-gray-400 mb-4">
                        <i data-lucide="trending-up" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
                        <p class="text-xl">No signals available</p>
                        <p class="text-sm">Check back later for new trading opportunities</p>
                    </div>
                </div>
            `;
            this.initializeIcons();
            return;
        }

        signalsGrid.innerHTML = signals.map(signal => this.createSignalCard(signal)).join('');
        this.initializeIcons();
    }

    createSignalCard(signal) {
        const isVip = signal.signal_type === 'vip';
        const publishedDate = new Date(signal.published_at).toLocaleDateString();
        const publishedTime = new Date(signal.published_at).toLocaleTimeString();

        return `
            <div class="signal-card ${isVip ? 'border-yellow-400' : ''}">
                <div class="flex justify-between items-start mb-4">
                    <div class="signal-pair">${signal.pair}</div>
                    <div class="flex items-center space-x-2">
                        ${isVip ? '<span class="px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-xs font-bold rounded">VIP</span>' : '<span class="px-2 py-1 bg-trading-accent text-white text-xs font-bold rounded">FREE</span>'}
                        <span class="px-2 py-1 bg-success-500 text-white text-xs font-bold rounded uppercase">${signal.status}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div class="text-sm text-gray-400 mb-1">Entry Price</div>
                        <div class="signal-price font-bold text-white">$${signal.entry_price.toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-400 mb-1">Stop Loss</div>
                        <div class="signal-price font-bold signal-bear">$${signal.stop_loss.toLocaleString()}</div>
                    </div>
                </div>

                <div class="mb-4">
                    <div class="text-sm text-gray-400 mb-2">Targets</div>
                    <div class="grid grid-cols-3 gap-2">
                        ${signal.target_1 ? `<div class="text-center p-2 bg-trading-darker rounded"><div class="text-xs text-gray-400">T1</div><div class="signal-price text-sm signal-bull">$${signal.target_1.toLocaleString()}</div></div>` : ''}
                        ${signal.target_2 ? `<div class="text-center p-2 bg-trading-darker rounded"><div class="text-xs text-gray-400">T2</div><div class="signal-price text-sm signal-bull">$${signal.target_2.toLocaleString()}</div></div>` : ''}
                        ${signal.target_3 ? `<div class="text-center p-2 bg-trading-darker rounded"><div class="text-xs text-gray-400">T3</div><div class="signal-price text-sm signal-bull">$${signal.target_3.toLocaleString()}</div></div>` : ''}
                    </div>
                </div>

                ${signal.description ? `
                    <div class="mb-4">
                        <div class="text-sm text-gray-400 mb-1">Analysis</div>
                        <div class="text-sm text-gray-300">${signal.description}</div>
                    </div>
                ` : ''}

                <div class="flex justify-between items-center text-xs text-gray-500">
                    <div class="flex items-center space-x-1">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>${publishedDate} ${publishedTime}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="trending-up" class="w-3 h-3"></i>
                        <span>Signal #${signal.id}</span>
                    </div>
                </div>
            </div>
        `;
    }

    filterSignals(filter) {
        let filteredSignals = this.signals;

        if (filter === 'free') {
            filteredSignals = this.signals.filter(signal => signal.signal_type === 'free');
        } else if (filter === 'vip') {
            filteredSignals = this.signals.filter(signal => signal.signal_type === 'vip');
        }

        this.renderSignals(filteredSignals);
    }

    // VIP Activation
    async handleVipActivation(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const code = formData.get('vip-code');

        if (!this.currentUser) {
            this.showNotification('Please login first to activate VIP access', 'error');
            return;
        }

        try {
            const response = await fetch('/api/redeem-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (response.ok) {
                // Update user data
                this.currentUser.vip_status = 'vip';
                this.currentUser.vip_expires_at = data.vip_expires_at;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                
                this.updateUIForAuthenticatedUser();
                this.showNotification('VIP access activated successfully!', 'success');
                
                // Clear the form
                e.target.reset();
                
                // Reload signals to show VIP ones
                this.loadSignals();
            } else {
                this.showNotification(data.error || 'Failed to activate VIP access', 'error');
            }
        } catch (error) {
            console.error('VIP activation error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    // Utility Methods
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform translate-x-full transition-transform duration-300 ${
            type === 'success' ? 'bg-success-500 text-white' :
            type === 'error' ? 'bg-danger-500 text-white' :
            'bg-trading-card border border-trading-border text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    ${type === 'success' ? '<i data-lucide="check-circle" class="w-5 h-5"></i>' :
                      type === 'error' ? '<i data-lucide="x-circle" class="w-5 h-5"></i>' :
                      '<i data-lucide="info" class="w-5 h-5"></i>'}
                </div>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button class="flex-shrink-0 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);
        this.initializeIcons();

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(full)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the platform when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TradingSignalsPlatform();
});

// Add CSS for filter buttons
const style = document.createElement('style');
style.textContent = `
    .filter-btn {
        color: #9CA3AF;
        background-color: transparent;
    }
    
    .filter-btn:hover {
        color: #00d4aa;
        background-color: rgba(0, 212, 170, 0.1);
    }
    
    .filter-btn.active {
        color: #ffffff;
        background-color: #00d4aa;
    }
`;
document.head.appendChild(style);

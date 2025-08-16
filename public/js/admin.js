// Trading Signals Platform - Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.signals = [];
        this.vipCodes = [];
        this.settings = {};
        this.currentTab = 'signals';
        this.editingSignal = null;
        this.init();
    }

    init() {
        this.initializeIcons();
        this.checkAdminAuth();
        this.setupEventListeners();
        this.loadInitialData();
    }

    initializeIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    checkAdminAuth() {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('user_data');
        
        if (!token || !user) {
            this.redirectToLogin();
            return;
        }

        try {
            this.currentUser = JSON.parse(user);
            if (!this.currentUser.isAdmin) {
                this.showNotification('Admin access required', 'error');
                this.redirectToLogin();
                return;
            }
            
            document.getElementById('admin-email').textContent = this.currentUser.email;
        } catch (error) {
            console.error('Error parsing user data:', error);
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        window.location.href = '/';
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.id.replace('tab-', '');
                this.switchTab(tabId);
            });
        });

        // Logout
        document.getElementById('admin-logout')?.addEventListener('click', () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            this.redirectToLogin();
        });

        // Signal management
        document.getElementById('add-signal-btn')?.addEventListener('click', () => this.showSignalModal());
        document.getElementById('close-signal-modal')?.addEventListener('click', () => this.hideSignalModal());
        document.getElementById('cancel-signal')?.addEventListener('click', () => this.hideSignalModal());
        document.getElementById('signal-form')?.addEventListener('submit', (e) => this.handleSignalSubmit(e));

        // VIP codes management
        document.getElementById('generate-codes-btn')?.addEventListener('click', () => this.showVipCodesModal());
        document.getElementById('close-vip-codes-modal')?.addEventListener('click', () => this.hideVipCodesModal());
        document.getElementById('cancel-vip-codes')?.addEventListener('click', () => this.hideVipCodesModal());
        document.getElementById('vip-codes-form')?.addEventListener('submit', (e) => this.handleVipCodesSubmit(e));

        // Settings form
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => this.handleSettingsUpdate(e));
        }

        // Contact form
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => this.handleContactUpdate(e));
        }

        // Wallet form
        const walletForm = document.getElementById('walletForm');
        if (walletForm) {
            walletForm.addEventListener('submit', (e) => this.handleWalletUpdate(e));
        }

        // Modal backdrop clicks
        document.getElementById('signal-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'signal-modal') this.hideSignalModal();
        });
        
        document.getElementById('vip-codes-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'vip-codes-modal') this.hideVipCodesModal();
        });
    }

    async loadInitialData() {
        await Promise.all([
            this.loadSignals(),
            this.loadVipCodes(),
            this.loadSettings()
        ]);
        this.updateStats();
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`${tabId}-tab`).classList.remove('hidden');

        this.currentTab = tabId;

        // Load data if needed
        if (tabId === 'vip-codes' && this.vipCodes.length === 0) {
            this.loadVipCodes();
        }
    }

    // Signals Management
    async loadSignals() {
        try {
            const response = await this.fetchWithAuth('/api/admin/signals');
            const data = await response.json();

            if (response.ok) {
                this.signals = data;
                this.renderSignalsTable();
            } else {
                this.showNotification(data.error || 'Failed to load signals', 'error');
            }
        } catch (error) {
            console.error('Error loading signals:', error);
            this.showNotification('Network error loading signals', 'error');
        }
    }

    renderSignalsTable() {
        const tbody = document.getElementById('signals-table-body');
        if (!tbody) return;

        if (this.signals.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center text-gray-400">
                        <i data-lucide="trending-up" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <p>No signals found</p>
                    </td>
                </tr>
            `;
            this.initializeIcons();
            return;
        }

        tbody.innerHTML = this.signals.map(signal => this.createSignalRow(signal)).join('');
        this.initializeIcons();
    }

    createSignalRow(signal) {
        const publishedDate = signal.published_at ? 
            new Date(signal.published_at).toLocaleDateString() : 
            (signal.scheduled_at ? `Scheduled: ${new Date(signal.scheduled_at).toLocaleDateString()}` : 'Draft');

        const targets = [signal.target_1, signal.target_2, signal.target_3]
            .filter(t => t)
            .map(t => `$${t.toLocaleString()}`)
            .join(', ') || 'None';

        return `
            <tr class="hover:bg-trading-darker/50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-white">${signal.pair}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">$${signal.entry_price.toLocaleString()}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-300">${targets}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-red-400">$${signal.stop_loss.toLocaleString()}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                        signal.signal_type === 'vip' ? 
                        'bg-yellow-400 text-black' : 
                        'bg-trading-accent text-white'
                    }">
                        ${signal.signal_type.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                        signal.status === 'active' ? 'bg-green-500 text-white' :
                        signal.status === 'closed' ? 'bg-gray-500 text-white' :
                        'bg-red-500 text-white'
                    }">
                        ${signal.status.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">${publishedDate}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="adminPanel.editSignal(${signal.id})" class="text-trading-accent hover:text-white mr-3">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="adminPanel.deleteSignal(${signal.id})" class="text-red-400 hover:text-red-300">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    showSignalModal(signal = null) {
        this.editingSignal = signal;
        const modal = document.getElementById('signal-modal');
        const title = document.getElementById('signal-modal-title');
        const form = document.getElementById('signal-form');

        if (signal) {
            title.textContent = 'Edit Signal';
            this.populateSignalForm(signal);
        } else {
            title.textContent = 'Add Signal';
            form.reset();
            document.getElementById('signal-id').value = '';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    hideSignalModal() {
        const modal = document.getElementById('signal-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
        this.editingSignal = null;
    }

    populateSignalForm(signal) {
        document.getElementById('signal-id').value = signal.id;
        document.getElementById('signal-pair').value = signal.pair;
        document.getElementById('signal-entry').value = signal.entry_price;
        document.getElementById('signal-target1').value = signal.target_1 || '';
        document.getElementById('signal-target2').value = signal.target_2 || '';
        document.getElementById('signal-target3').value = signal.target_3 || '';
        document.getElementById('signal-stop-loss').value = signal.stop_loss;
        document.getElementById('signal-type').value = signal.signal_type;
        document.getElementById('signal-status').value = signal.status;
        document.getElementById('signal-description').value = signal.description || '';
        
        if (signal.scheduled_at) {
            const date = new Date(signal.scheduled_at);
            document.getElementById('signal-scheduled').value = date.toISOString().slice(0, 16);
        }
    }

    async handleSignalSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const signalData = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        ['entry_price', 'target_1', 'target_2', 'target_3', 'stop_loss'].forEach(field => {
            if (signalData[field]) {
                signalData[field] = parseFloat(signalData[field]);
            }
        });

        // Remove empty fields
        Object.keys(signalData).forEach(key => {
            if (signalData[key] === '' || signalData[key] === null) {
                delete signalData[key];
            }
        });

        try {
            const isEditing = this.editingSignal !== null;
            const url = isEditing ? `/api/admin/signals/${this.editingSignal.id}` : '/api/admin/signals';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await this.fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signalData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(
                    isEditing ? 'Signal updated successfully!' : 'Signal created successfully!', 
                    'success'
                );
                this.hideSignalModal();
                this.loadSignals();
            } else {
                this.showNotification(data.error || 'Failed to save signal', 'error');
            }
        } catch (error) {
            console.error('Error saving signal:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async editSignal(signalId) {
        const signal = this.signals.find(s => s.id === signalId);
        if (signal) {
            this.showSignalModal(signal);
        }
    }

    async deleteSignal(signalId) {
        if (!confirm('Are you sure you want to delete this signal?')) return;

        try {
            const response = await this.fetchWithAuth(`/api/admin/signals/${signalId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Signal deleted successfully!', 'success');
                this.loadSignals();
            } else {
                this.showNotification(data.error || 'Failed to delete signal', 'error');
            }
        } catch (error) {
            console.error('Error deleting signal:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    // VIP Codes Management
    async loadVipCodes() {
        try {
            const response = await this.fetchWithAuth('/api/admin/vip-codes');
            const data = await response.json();

            if (response.ok) {
                this.vipCodes = data;
                this.renderVipCodesTable();
            } else {
                this.showNotification(data.error || 'Failed to load VIP codes', 'error');
            }
        } catch (error) {
            console.error('Error loading VIP codes:', error);
            this.showNotification('Network error loading VIP codes', 'error');
        }
    }

    renderVipCodesTable() {
        const tbody = document.getElementById('vip-codes-table-body');
        if (!tbody) return;

        if (this.vipCodes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-400">
                        <i data-lucide="key" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <p>No VIP codes found</p>
                    </td>
                </tr>
            `;
            this.initializeIcons();
            return;
        }

        tbody.innerHTML = this.vipCodes.map(code => this.createVipCodeRow(code)).join('');
        this.initializeIcons();
    }

    createVipCodeRow(code) {
        const createdDate = new Date(code.created_at).toLocaleDateString();
        const usedDate = code.used_at ? new Date(code.used_at).toLocaleDateString() : '-';
        const usedBy = code.used_by_email || '-';

        return `
            <tr class="hover:bg-trading-darker/50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-mono text-white">${code.code}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">${code.duration_days} days</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                        code.is_used ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }">
                        ${code.is_used ? 'USED' : 'AVAILABLE'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">${usedBy}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">${usedDate}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-300">${createdDate}</div>
                </td>
            </tr>
        `;
    }

    showVipCodesModal() {
        const modal = document.getElementById('vip-codes-modal');
        const form = document.getElementById('vip-codes-form');
        
        form.reset();
        document.getElementById('code-duration').value = '30';
        document.getElementById('code-quantity').value = '1';

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    hideVipCodesModal() {
        const modal = document.getElementById('vip-codes-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }

    async handleVipCodesSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const codeData = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        codeData.duration_days = parseInt(codeData.duration_days);
        codeData.quantity = parseInt(codeData.quantity);

        try {
            const response = await this.fetchWithAuth('/api/admin/vip-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(codeData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(`${codeData.quantity} VIP code(s) generated successfully!`, 'success');
                this.hideVipCodesModal();
                this.loadVipCodes();
            } else {
                this.showNotification(data.error || 'Failed to generate VIP codes', 'error');
            }
        } catch (error) {
            console.error('Error generating VIP codes:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    // Settings Management
    async loadSettings() {
        try {
            const response = await this.fetchWithAuth('/api/admin/settings');
            const data = await response.json();

            if (response.ok) {
                this.settings = data;
                this.populateSettingsForm();
            } else {
                this.showNotification(data.error || 'Failed to load settings', 'error');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showNotification('Network error loading settings', 'error');
        }
    }

    populateSettingsForm() {
        const vipPriceInput = document.getElementById('vip-price');
        if (vipPriceInput && this.settings.vip_price) {
            vipPriceInput.value = this.settings.vip_price;
        }
    }

    async handleSettingsUpdate(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const settingsData = {};
        
        const vipPrice = formData.get('vip-price');
        if (vipPrice) {
            settingsData.vip_price = parseFloat(vipPrice);
        }

        try {
            const response = await this.fetchWithAuth('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Settings updated successfully!', 'success');
                this.settings = { ...this.settings, ...settingsData };
            } else {
                this.showNotification(data.error || 'Failed to update settings', 'error');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async handleContactUpdate(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const walletData = {};
        
        const btcAddress = formData.get('btcAddress');
        const ethAddress = formData.get('ethAddress');
        const usdtAddress = formData.get('usdtAddress');
        const bnbAddress = formData.get('bnbAddress');
        const tonAddress = formData.get('tonAddress');
        
        if (btcAddress) walletData.btc_address = btcAddress;
        if (ethAddress) walletData.eth_address = ethAddress;
        if (usdtAddress) walletData.usdt_address = usdtAddress;
        if (bnbAddress) walletData.bnb_address = bnbAddress;
        if (tonAddress) walletData.ton_address = tonAddress;

        try {
            const response = await this.fetchWithAuth('/api/admin/wallets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(walletData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Wallet addresses updated successfully!', 'success');
            } else {
                this.showNotification(data.error || 'Failed to update wallet addresses', 'error');
            }
        } catch (error) {
            console.error('Error updating contact info:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    // Statistics
    updateStats() {
        const totalSignals = this.signals.length;
        const activeSignals = this.signals.filter(s => s.status === 'active').length;
        const vipSignals = this.signals.filter(s => s.signal_type === 'vip').length;
        const totalCodes = this.vipCodes.length;
        const usedCodes = this.vipCodes.filter(c => c.is_used).length;

        document.getElementById('stat-total-signals').textContent = totalSignals;
        document.getElementById('stat-active-signals').textContent = activeSignals;
        document.getElementById('stat-vip-signals').textContent = vipSignals;
        document.getElementById('stat-total-codes').textContent = totalCodes;
        document.getElementById('stat-used-codes').textContent = usedCodes;
    }

    // Utility Methods
    async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('auth_token');
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });
    }

    showNotification(message, type = 'info') {
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

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

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

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Add CSS for tab buttons
const style = document.createElement('style');
style.textContent = `
    .tab-btn {
        color: #9CA3AF;
        background-color: transparent;
    }
    
    .tab-btn:hover {
        color: #00d4aa;
        background-color: rgba(0, 212, 170, 0.1);
    }
    
    .tab-btn.active {
        color: #ffffff;
        background-color: #00d4aa;
    }
`;
document.head.appendChild(style);

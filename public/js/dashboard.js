class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserData();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        if (!token || !userData) {
            window.location.href = '/';
            return;
        }

        try {
            this.currentUser = JSON.parse(userData);
            document.getElementById('userEmail').textContent = this.currentUser.email;
        } catch (error) {
            console.error('Error parsing user data:', error);
            window.location.href = '/';
        }
    }

    setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        // Event listeners
        document.getElementById('logout-btn').addEventListener('click', this.logout.bind(this));
        
        // Password form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', this.handlePasswordChange.bind(this));
        }
    }

    async loadUserData() {
        try {
            // Load user account info
            await this.loadAccountInfo();
            
            // Load signals based on user type
            await this.loadSignals();
            
            // Load investments if user is investor
            if (this.currentUser.user_type === 'investor') {
                await this.loadInvestments();
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showNotification('Error loading dashboard data', 'error');
        }
    }

    async loadAccountInfo() {
        const accountType = document.getElementById('accountType');
        if (accountType) {
            accountType.textContent = this.currentUser.user_type.charAt(0).toUpperCase() + this.currentUser.user_type.slice(1);
        }

        // Show VIP status if user has VIP access
        if (this.currentUser.vip_expires_at) {
            const vipCard = document.getElementById('vipStatusCard');
            const vipExpiry = document.getElementById('vipExpiry');
            
            if (vipCard && vipExpiry) {
                const expiryDate = new Date(this.currentUser.vip_expires_at);
                const now = new Date();
                
                if (expiryDate > now) {
                    vipExpiry.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
                    vipCard.classList.remove('hidden');
                    
                    // Show VIP signals section
                    const vipSignalsSection = document.getElementById('vipSignalsSection');
                    if (vipSignalsSection) {
                        vipSignalsSection.classList.remove('hidden');
                    }
                } else {
                    vipExpiry.textContent = 'Expired';
                    vipCard.classList.remove('hidden');
                }
            }
        }
    }

    async loadSignals() {
        try {
            // Load free signals
            const freeResponse = await fetch('/api/signals');
            const freeData = await freeResponse.json();
            
            if (freeResponse.ok) {
                this.displaySignals(freeData, 'freeSignals');
            }

            // Load VIP signals if user has access
            if (this.hasVIPAccess()) {
                const token = localStorage.getItem('auth_token');
                const vipResponse = await fetch('/api/signals/vip', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const vipData = await vipResponse.json();
                
                if (vipResponse.ok) {
                    this.displaySignals(vipData, 'vipSignals');
                }
            }
        } catch (error) {
            console.error('Error loading signals:', error);
        }
    }

    async loadInvestments() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/investments/my', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.displayInvestments(data.investments);
                
                // Update investment card
                const investmentCard = document.getElementById('investmentCard');
                const totalInvestment = document.getElementById('totalInvestment');
                
                if (investmentCard && totalInvestment && data.investments.length > 0) {
                    const total = data.investments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
                    totalInvestment.textContent = `$${total.toFixed(2)} USDT`;
                    investmentCard.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error('Error loading investments:', error);
        }
    }

    displaySignals(signals, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (signals.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">No signals available</p>';
            return;
        }

        container.innerHTML = signals.map(signal => `
            <div class="bg-gray-800 rounded-lg p-6">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-blue-400">${signal.pair}</h3>
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${
                        signal.signal_type === 'vip' ? 'bg-yellow-600 text-yellow-100' : 'bg-green-600 text-green-100'
                    }">
                        ${signal.signal_type.toUpperCase()}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <div class="text-gray-400 text-sm">Entry</div>
                        <div class="font-semibold">${signal.entry_price}</div>
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm">Target 1</div>
                        <div class="font-semibold text-green-400">${signal.target_1}</div>
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm">Target 2</div>
                        <div class="font-semibold text-green-400">${signal.target_2}</div>
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm">Stop Loss</div>
                        <div class="font-semibold text-red-400">${signal.stop_loss}</div>
                    </div>
                </div>
                
                ${signal.description ? `<p class="text-gray-300 text-sm">${signal.description}</p>` : ''}
                
                <div class="text-xs text-gray-500 mt-2">
                    Published: ${new Date(signal.published_at).toLocaleString()}
                </div>
            </div>
        `).join('');
    }

    displayInvestments(investments) {
        const container = document.getElementById('investmentList');
        const section = document.getElementById('investmentSection');
        
        if (!container || !section) return;

        if (investments.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">No investments found</p>';
            section.classList.remove('hidden');
            return;
        }

        container.innerHTML = investments.map(investment => {
            const startDate = new Date(investment.start_date);
            const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days later
            const now = new Date();
            const isMatured = now >= endDate;
            const profit = parseFloat(investment.amount) * (parseFloat(investment.profit_rate) / 100);
            const total = parseFloat(investment.amount) + profit;

            return `
                <div class="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition-colors"
                     onclick="showInvestmentDetails(${investment.id})">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-lg font-semibold">Investment #${investment.id}</h3>
                            <p class="text-gray-400">Started: ${startDate.toLocaleDateString()}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${
                            investment.status === 'active' ? 'bg-green-600 text-green-100' : 
                            investment.status === 'completed' ? 'bg-blue-600 text-blue-100' :
                            'bg-gray-600 text-gray-100'
                        }">
                            ${investment.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <div class="text-gray-400 text-sm">Amount</div>
                            <div class="font-semibold">${parseFloat(investment.amount).toFixed(2)} USDT</div>
                        </div>
                        <div>
                            <div class="text-gray-400 text-sm">Profit</div>
                            <div class="font-semibold text-green-400">+${profit.toFixed(2)} USDT</div>
                        </div>
                        <div>
                            <div class="text-gray-400 text-sm">Total</div>
                            <div class="font-semibold text-blue-400">${total.toFixed(2)} USDT</div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <div class="text-gray-400 text-sm">Maturity Date</div>
                        <div class="font-semibold ${isMatured ? 'text-green-400' : 'text-yellow-400'}">
                            ${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString()}
                            ${isMatured ? '(Ready for withdrawal)' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        section.classList.remove('hidden');
    }

    hasVIPAccess() {
        if (!this.currentUser.vip_expires_at) return false;
        messageElement.textContent = message;
        
        // Set notification color based on type
        notification.className = notification.className.replace(/bg-\w+-600/g, '');
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-600');
                break;
            case 'error':
                notification.classList.add('bg-red-600');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-600');
                break;
            default:
                notification.classList.add('bg-blue-600');
        }
        
        // Show notification
        notification.classList.remove('translate-x-full');
        notification.classList.add('translate-x-0');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.classList.remove('translate-x-0');
            notification.classList.add('translate-x-full');
        }
    }
}

// Global functions
function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.classList.remove('translate-x-0');
        notification.classList.add('translate-x-full');
    }
}

function showInvestmentDetails(investmentId) {
    // This would typically fetch detailed investment data
    // For now, we'll show a placeholder modal
    const modal = document.getElementById('investmentModal');
    const content = document.getElementById('investmentModalContent');
    
    if (modal && content) {
        content.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span class="text-gray-400">Investment ID:</span>
                    <span>#${investmentId}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Status:</span>
                    <span class="text-green-400">Active</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Maturity:</span>
                    <span>Check main dashboard</span>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        lucide.createIcons();
    }
}

function closeInvestmentModal() {
    const modal = document.getElementById('investmentModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});

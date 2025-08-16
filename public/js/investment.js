class InvestmentManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.loadPaymentMethods();
        this.updateCalculator();
    }

    setupEventListeners() {
        const investmentForm = document.getElementById('investmentForm');
        const loginBtn = document.getElementById('loginBtn');
        const calcAmount = document.getElementById('calcAmount');

        if (investmentForm) {
            investmentForm.addEventListener('submit', (e) => this.handleInvestmentSubmission(e));
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.redirectToHome());
        }

        if (calcAmount) {
            calcAmount.addEventListener('input', () => this.updateCalculator());
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        const loginBtn = document.getElementById('loginBtn');
        
        if (token && loginBtn) {
            loginBtn.textContent = 'Dashboard';
            loginBtn.onclick = () => window.location.href = '/dashboard';
        }
    }

    async loadPaymentMethods() {
        try {
            const response = await fetch('/api/payment-methods');
            const data = await response.json();
            
            if (response.ok) {
                this.populatePaymentMethods(data.paymentMethods);
            }
        } catch (error) {
            console.error('Error loading payment methods:', error);
        }
    }

    populatePaymentMethods(methods) {
        const select = document.getElementById('paymentMethod');
        if (!select) return;

        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        methods.forEach(method => {
            if (method.is_active) {
                const option = document.createElement('option');
                option.value = method.name;
                option.textContent = method.name;
                select.appendChild(option);
            }
        });
    }

    async handleInvestmentSubmission(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const amount = parseFloat(formData.get('amount'));
        const paymentMethod = formData.get('paymentMethod');

        if (!email || !password || !amount || !paymentMethod) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (amount < 100) {
            this.showNotification('Minimum investment amount is 100 USDT', 'error');
            return;
        }

        try {
            const response = await fetch('/api/investment/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    amount,
                    paymentMethod
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token and user data
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showPaymentInfo(data.paymentInfo, data.contactInfo);
                this.showNotification('Investment account created! Please complete payment.', 'success');
            } else {
                this.showNotification(data.error || 'Failed to create investment', 'error');
            }
        } catch (error) {
            console.error('Investment creation error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    showPaymentInfo(paymentInfo, contactInfo) {
        const paymentInfoDiv = document.getElementById('paymentInfo');
        const paymentDetails = document.getElementById('paymentDetails');
        const contactInfoDiv = document.getElementById('contactInfo');

        if (!paymentInfoDiv || !paymentDetails || !contactInfoDiv) return;

        // Show payment details
        paymentDetails.innerHTML = `
            <div class="bg-gray-700 p-4 rounded-lg">
                <h4 class="font-semibold mb-2">Send Payment To:</h4>
                <div class="space-y-2">
                    <div>
                        <span class="text-gray-400">Method:</span>
                        <span class="font-mono">${paymentInfo.method}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Address:</span>
                        <span class="font-mono text-sm break-all">${paymentInfo.address}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Amount:</span>
                        <span class="font-semibold text-green-400">${paymentInfo.amount} USDT</span>
                    </div>
                </div>
                <button onclick="copyToClipboard('${paymentInfo.address}')" 
                        class="mt-2 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm">
                    Copy Address
                </button>
            </div>
        `;

        // Show contact info
        contactInfoDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <i data-lucide="${contactInfo.method === 'telegram' ? 'send' : 'phone'}" class="w-4 h-4"></i>
                <span>${contactInfo.method === 'telegram' ? 'Telegram:' : 'WhatsApp:'}</span>
                <span class="font-mono">${contactInfo.value}</span>
            </div>
        `;

        paymentInfoDiv.classList.remove('hidden');
        
        // Scroll to payment info
        paymentInfoDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Recreate icons
        lucide.createIcons();
    }

    updateCalculator() {
        const calcAmount = document.getElementById('calcAmount');
        const monthlyProfit = document.getElementById('monthlyProfit');
        const totalReturn = document.getElementById('totalReturn');

        if (!calcAmount || !monthlyProfit || !totalReturn) return;

        const amount = parseFloat(calcAmount.value) || 0;
        const profit = amount * 0.05;
        const total = amount + profit;

        monthlyProfit.textContent = `$${profit.toFixed(2)}`;
        totalReturn.textContent = `$${total.toFixed(2)}`;
    }

    redirectToHome() {
        window.location.href = '/';
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        if (!notification || !messageElement) return;

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

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary success message
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        if (notification && messageElement) {
            messageElement.textContent = 'Address copied to clipboard!';
            notification.className = notification.className.replace(/bg-\w+-600/g, '');
            notification.classList.add('bg-green-600');
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
            
            setTimeout(() => {
                hideNotification();
            }, 2000);
        }
    });
}

// Initialize investment manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InvestmentManager();
});

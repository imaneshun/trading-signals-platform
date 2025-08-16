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
                    amount: parseFloat(amount),
                    paymentMethod
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Payment details generated successfully!', 'success');
                
                // Show payment information
                this.displayPaymentInfo(data.paymentInfo, data.contactInfo, amount, paymentMethod);
                
                // Store user data
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
            } else {
                this.showNotification(data.error || 'Failed to generate payment details', 'error');
            }
        } catch (error) {
            console.error('Payment generation error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    displayPaymentInfo(paymentInfo, contactInfo, amount, paymentMethod) {
        const paymentInfoDiv = document.getElementById('paymentInfo');
        
        // Update payment amount and wallet address
        document.getElementById('paymentAmount').textContent = `${amount} ${paymentMethod}`;
        document.getElementById('walletAddress').value = paymentInfo.address;
        
        // Update contact info
        const supportContact = document.getElementById('supportContact');
        if (supportContact && contactInfo) {
            const contactMethod = contactInfo.method || 'telegram';
            const contactValue = contactInfo.value || '@tradingsignals';
            
            if (contactMethod === 'telegram') {
                supportContact.innerHTML = `<a href="https://t.me/${contactValue.replace('@', '')}" target="_blank" class="text-blue-400 hover:text-blue-300">Telegram: ${contactValue}</a>`;
            } else if (contactMethod === 'whatsapp') {
                supportContact.innerHTML = `<a href="https://wa.me/${contactValue}" target="_blank" class="text-green-400 hover:text-green-300">WhatsApp: ${contactValue}</a>`;
            } else {
                supportContact.innerHTML = `<span class="text-gray-300">${contactMethod}: ${contactValue}</span>`;
            }
        }
        
        // Show payment info section
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

// Global functions for wallet integration
function openWallet() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const amount = document.getElementById('paymentAmount').textContent;
    const address = document.getElementById('walletAddress').value;
    
    // Create deep links for different wallets
    const walletLinks = {
        'BTC': `bitcoin:${address}?amount=${amount.split(' ')[0]}`,
        'ETH': `ethereum:${address}@1?value=${amount.split(' ')[0]}e18`,
        'USDT': `tron:${address}?amount=${amount.split(' ')[0]}&token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`,
        'BNB': `binance:${address}?amount=${amount.split(' ')[0]}`,
        'TON': `ton://transfer/${address}?amount=${amount.split(' ')[0]}`
    };
    
    const deepLink = walletLinks[paymentMethod];
    
    if (deepLink) {
        // Try to open wallet app
        window.location.href = deepLink;
        
        // Fallback: show instructions
        setTimeout(() => {
            alert(`If your wallet didn't open automatically:\n\n1. Open your ${paymentMethod} wallet app\n2. Send ${amount} to:\n${address}\n\nAddress copied to clipboard!`);
            copyToClipboard('walletAddress');
        }, 1000);
    } else {
        alert(`Please open your ${paymentMethod} wallet and send ${amount} to:\n${address}\n\nAddress copied to clipboard!`);
        copyToClipboard('walletAddress');
    }
}

// Initialize investment manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InvestmentManager();
});

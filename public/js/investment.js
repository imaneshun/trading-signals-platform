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

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (element && element.value) {
        // Try modern clipboard API first
        if (navigator.clipboard) {
            navigator.clipboard.writeText(element.value).then(() => {
                showCopyNotification();
            }).catch(() => {
                // Fallback to older method
                fallbackCopy(element);
            });
        } else {
            // Fallback for older browsers
            fallbackCopy(element);
        }
    }
}

function fallbackCopy(element) {
    element.select();
    element.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        showCopyNotification();
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

function showCopyNotification() {
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
}

// Global functions for wallet integration
function openWallet() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const amount = document.getElementById('paymentAmount').textContent;
    const address = document.getElementById('walletAddress').value;
    
    if (!paymentMethod || !amount || !address) {
        alert('Payment information not available. Please try again.');
        return;
    }
    
    // Show immediate instructions with copy functionality
    const amountValue = amount.split(' ')[0];
    const instructions = `Send ${amount} to this address:\n\n${address}\n\nInstructions:\n1. Copy the address above\n2. Open your ${paymentMethod} wallet\n3. Send exactly ${amountValue} ${paymentMethod}\n4. Use the correct network:\n   - USDT: TRC20 network\n   - BTC: Bitcoin network\n   - ETH: Ethereum network\n   - BNB: BSC network\n   - TON: TON network`;
    
    // Copy address to clipboard
    copyToClipboard('walletAddress');
    
    // Show detailed instructions
    alert(instructions);
    
    // Try deep links as secondary option
    const walletLinks = {
        'BTC': `bitcoin:${address}?amount=${amountValue}`,
        'ETH': `ethereum:${address}?value=${amountValue}`,
        'USDT': `https://link.trustwallet.com/send?coin=195&address=${address}&amount=${amountValue}`,
        'BNB': `https://link.trustwallet.com/send?coin=714&address=${address}&amount=${amountValue}`,
        'TON': `https://app.tonkeeper.com/transfer/${address}?amount=${amountValue}`
    };
    
    const deepLink = walletLinks[paymentMethod];
    
    if (deepLink && confirm('Would you like to try opening your wallet app automatically?')) {
        try {
            // Create a temporary link and click it
            const tempLink = document.createElement('a');
            tempLink.href = deepLink;
            tempLink.target = '_blank';
            tempLink.rel = 'noopener noreferrer';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
        } catch (error) {
            console.log('Deep link failed:', error);
        }
    }
}

// Specific wallet functions
function openTrustWallet() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const amount = document.getElementById('paymentAmount').textContent;
    const address = document.getElementById('walletAddress').value;
    
    if (!paymentMethod || !amount || !address) {
        alert('Payment information not available. Please try again.');
        return;
    }
    
    const amountValue = amount.split(' ')[0];
    
    // Trust Wallet deep links
    const trustLinks = {
        'BTC': `https://link.trustwallet.com/send?coin=0&address=${address}&amount=${amountValue}`,
        'ETH': `https://link.trustwallet.com/send?coin=60&address=${address}&amount=${amountValue}`,
        'USDT': `https://link.trustwallet.com/send?coin=195&address=${address}&amount=${amountValue}`,
        'BNB': `https://link.trustwallet.com/send?coin=714&address=${address}&amount=${amountValue}`,
        'TON': `https://link.trustwallet.com/send?coin=607&address=${address}&amount=${amountValue}`
    };
    
    const trustLink = trustLinks[paymentMethod];
    if (trustLink) {
        window.open(trustLink, '_blank');
        copyToClipboard('walletAddress');
    } else {
        alert(`Trust Wallet link not available for ${paymentMethod}. Please use manual instructions.`);
        openWallet();
    }
}

function openMetaMask() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const amount = document.getElementById('paymentAmount').textContent;
    const address = document.getElementById('walletAddress').value;
    
    if (!paymentMethod || !amount || !address) {
        alert('Payment information not available. Please try again.');
        return;
    }
    
    if (paymentMethod === 'ETH' || paymentMethod === 'USDT') {
        if (typeof window.ethereum !== 'undefined') {
            // MetaMask is installed
            const amountValue = amount.split(' ')[0];
            const amountWei = (parseFloat(amountValue) * Math.pow(10, 18)).toString(16);
            
            window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    to: address,
                    value: paymentMethod === 'ETH' ? '0x' + amountWei : '0x0',
                    from: window.ethereum.selectedAddress,
                }],
            }).catch(console.error);
        } else {
            // MetaMask not installed
            alert('MetaMask not detected. Please install MetaMask or use manual instructions.');
            openWallet();
        }
    } else {
        alert(`MetaMask only supports ETH and USDT. Please use manual instructions for ${paymentMethod}.`);
        openWallet();
    }
}

// Initialize investment manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InvestmentManager();
});

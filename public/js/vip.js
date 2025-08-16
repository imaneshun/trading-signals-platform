class VIPManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        const vipForm = document.getElementById('vipForm');
        const loginBtn = document.getElementById('loginBtn');

        if (vipForm) {
            vipForm.addEventListener('submit', (e) => this.handleVIPSubmission(e));
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.redirectToHome());
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

    async handleVIPSubmission(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const vipCode = formData.get('vipCode');
        const email = formData.get('email');
        const password = formData.get('password');

        if (!vipCode || !email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/vip/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vipCode,
                    email,
                    password
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token and user data
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showNotification('VIP access activated successfully!', 'success');
                
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                this.showNotification(data.error || 'Failed to activate VIP access', 'error');
            }
        } catch (error) {
            console.error('VIP activation error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
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

// Global function for hiding notification
function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.classList.remove('translate-x-0');
        notification.classList.add('translate-x-full');
    }
}

// Initialize VIP manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VIPManager();
});

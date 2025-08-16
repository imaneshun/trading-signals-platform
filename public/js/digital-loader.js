// Digital Loading Screen Controller
class DigitalLoader {
    constructor() {
        // Only run on home page (index.html)
        const isHomePage = window.location.pathname === '/' || window.location.pathname === '/index.html';
        
        if (!isHomePage) {
            return; // Don't run on other pages
        }
        
        // Check if loader has already run in this session
        if (sessionStorage.getItem('digitalLoaderShown')) {
            return; // Don't run again
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Mark as shown for this session
        sessionStorage.setItem('digitalLoaderShown', 'true');
        
        // Create loader HTML
        this.createLoader();
        
        // Start the loading sequence
        this.startLoadingSequence();
    }

    createLoader() {
        const loaderHTML = `
            <div id="digitalLoader" class="digital-loader">
                <div class="chart-container">
                    <div class="grid-lines">
                        <div class="grid-line horizontal" style="top: 20%;"></div>
                        <div class="grid-line horizontal" style="top: 40%;"></div>
                        <div class="grid-line horizontal" style="top: 60%;"></div>
                        <div class="grid-line horizontal" style="top: 80%;"></div>
                        <div class="grid-line vertical" style="left: 25%;"></div>
                        <div class="grid-line vertical" style="left: 50%;"></div>
                        <div class="grid-line vertical" style="left: 75%;"></div>
                    </div>
                    <div class="candlestick"></div>
                    <div class="candlestick red"></div>
                    <div class="candlestick"></div>
                    <div class="candlestick red"></div>
                    <div class="candlestick"></div>
                </div>
                
                <div class="digital-text">
                    Welcome to Reality
                </div>
                
                <div class="trading-stats">
                    <div class="stat-item">
                        <div class="stat-label">BTC/USDT</div>
                        <div class="stat-value">$${this.generatePrice(45000, 48000)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Success Rate</div>
                        <div class="stat-value">${this.generatePercentage(85, 95)}%</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Active Signals</div>
                        <div class="stat-value blue">${this.generateNumber(12, 25)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Profit Today</div>
                        <div class="stat-value red">+${this.generatePercentage(3, 8)}%</div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', loaderHTML);
    }

    generatePrice(min, max) {
        return (Math.random() * (max - min) + min).toFixed(2);
    }

    generatePercentage(min, max) {
        return (Math.random() * (max - min) + min).toFixed(1);
    }

    generateNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    startLoadingSequence() {
        const loader = document.getElementById('digitalLoader');
        
        // After 4 seconds, start fade out
        setTimeout(() => {
            loader.classList.add('fade-out');
            
            // Remove loader after fade out completes
            setTimeout(() => {
                loader.remove();
            }, 800); // Match CSS fade-out duration
        }, 4000);
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DigitalLoader();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new DigitalLoader();
    });
} else {
    new DigitalLoader();
}

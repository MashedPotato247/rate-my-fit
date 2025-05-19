var themes = [
    {
        background: "#1A1A2E",
        color: "#FFFFFF",
        primaryColor: "#ff4d4d"
    },
    {
        background: "#461220", 
        color: "#FFFFFF",
        primaryColor: "#E94560"
    },
    {
        background: "#192A51",
        color: "#FFFFFF",
        primaryColor: "#967AA1"
    },
    {
        background: "#F7B267",
        color: "#000000",
        primaryColor: "#F4845F"
    }
];

// Theme manager with better caching and performance
const ThemeManager = {
    currentTheme: null,
    
    init() {
        this.loadSavedTheme();
        this.setupThemeButtons();
    },
    
    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem('rateMyFitTheme');
            if (savedTheme) {
                this.setTheme(JSON.parse(savedTheme));
            } else {
                this.setTheme(themes[0]);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
            this.setTheme(themes[0]);
        }
    },
    
    setTheme(theme) {
        if (!theme) return;
        
        this.currentTheme = theme;
        const root = document.querySelector(":root");
        
        // Batch DOM operations for better performance
        requestAnimationFrame(() => {
            root.style.setProperty("--background", theme.background);
            root.style.setProperty("--color", theme.color);
            root.style.setProperty("--primary-color", theme.primaryColor);
            
            document.body.style.background = theme.background;
            document.body.style.backgroundImage = `linear-gradient(135deg, ${theme.background}, #121212)`;
            
            const formBgColor = theme.background === "#1A1A2E" ? 'rgba(30, 30, 46, 0.5)' : 'rgba(0, 0, 0, 0.2)';
            const formContainer = document.querySelector('.form-container');
            if (formContainer) {
                formContainer.style.backgroundColor = formBgColor;
            }
            
            // Update circle colors
            const circles = document.querySelectorAll('.circle');
            circles.forEach(circle => {
                circle.style.backgroundColor = theme.primaryColor;
            });
            
            // Save to localStorage
            localStorage.setItem('rateMyFitTheme', JSON.stringify(theme));
            
            // Update active theme button
            this.updateActiveThemeButton();
        });
    },
    
    setupThemeButtons() {
        const btnContainer = document.querySelector(".theme-btn-container");
        if (!btnContainer) return;
        
        // Clear existing buttons
        btnContainer.innerHTML = '';
        
        // Create theme buttons with event delegation
        const fragment = document.createDocumentFragment();
        
        themes.forEach((theme, index) => {
            const div = document.createElement("div");
            div.className = "theme-btn";
            div.dataset.themeIndex = index;
            div.style.background = theme.background;
            fragment.appendChild(div);
        });
        
        btnContainer.appendChild(fragment);
        
        // Use event delegation for better performance
        btnContainer.addEventListener("click", (e) => {
            const themeBtn = e.target.closest('.theme-btn');
            if (!themeBtn) return;
            
            const themeIndex = parseInt(themeBtn.dataset.themeIndex);
            this.setTheme(themes[themeIndex]);
        });
        
        this.updateActiveThemeButton();
    },
    
    updateActiveThemeButton() {
        const buttons = document.querySelectorAll('.theme-btn');
        const currentThemeIndex = themes.findIndex(t => 
            t.background === this.currentTheme.background && 
            t.primaryColor === this.currentTheme.primaryColor
        );
        
        buttons.forEach((btn, i) => {
            btn.classList.toggle('active', i === currentThemeIndex);
        });
    }
};

document.addEventListener("DOMContentLoaded", function() {
    // Initialize theme manager
    ThemeManager.init();
    
    document.body.classList.add('login-page');
    
    // Add animation to form container
    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
        formContainer.style.opacity = '0';
        formContainer.style.transform = 'translateY(20px)';
        formContainer.style.transition = 'opacity 0.6s ease, transform 0.8s ease';
        
        // Use requestAnimationFrame for smoother animations
        requestAnimationFrame(() => {
            setTimeout(() => {
                formContainer.style.opacity = '1';
                formContainer.style.transform = 'translateY(0)';
            }, 100);
        });
    }
    
    // Add form validation if login form exists
    const loginForm = document.querySelector('form[action="/login"]');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            const emailInput = this.querySelector('input[name="email"]');
            const passwordInput = this.querySelector('input[name="password"]');
            
            if (emailInput && !emailInput.value.trim()) {
                e.preventDefault();
                showError(emailInput, 'Email is required');
                return false;
            }
            
            if (passwordInput && !passwordInput.value.trim()) {
                e.preventDefault();
                showError(passwordInput, 'Password is required');
                return false;
            }
        });
    }
    
    function showError(input, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.color = 'var(--accent)';
        errorDiv.style.fontSize = '0.8rem';
        errorDiv.style.marginTop = '5px';
        
        // Remove existing error messages
        const existingError = input.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        input.parentNode.appendChild(errorDiv);
        input.style.borderColor = 'var(--accent)';
        
        // Clear error when input changes
        input.addEventListener('input', function() {
            const error = this.parentNode.querySelector('.error-message');
            if (error) {
                error.remove();
                this.style.borderColor = '';
            }
        });
    }
});

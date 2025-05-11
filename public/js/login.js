/**
 * Theme switching functionality for RateMyFit login page
 * Allows users to select from multiple color themes
 */

const themes = [
    {
        background: "#1A1A2E",
        color: "#FFFFFF",
        primaryColor: "#ff4d4d"  // Default - your app's original accent color
    },
    {
        background: "#461220", 
        color: "#FFFFFF",
        primaryColor: "#E94560"  // Red theme
    },
    {
        background: "#192A51",
        color: "#FFFFFF",
        primaryColor: "#967AA1"  // Blue theme
    },
    {
        background: "#F7B267",
        color: "#000000",
        primaryColor: "#F4845F"  // Orange theme
    }
];

// Function to set theme variables
const setTheme = (theme) => {
    const root = document.querySelector(":root");
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--color", theme.color);
    root.style.setProperty("--primary-color", theme.primaryColor);
    
    // Apply background gradient
    document.body.style.background = theme.background;
    document.body.style.backgroundImage = `linear-gradient(135deg, ${theme.background}, #121212)`;
    
    // Store the selected theme in local storage
    localStorage.setItem('rateMyFitTheme', JSON.stringify(theme));
    
    // Update circles with the new primary color
    document.querySelectorAll('.circle').forEach(circle => {
        circle.style.backgroundColor = theme.primaryColor;
    });
    
    // Update form background based on theme
    document.querySelector('.form-container').style.backgroundColor = 
        theme.background === "#1A1A2E" ? 'rgba(30, 30, 46, 0.5)' : 'rgba(0, 0, 0, 0.2)';
};

// Function to create theme selector buttons
const displayThemeButtons = () => {
    const btnContainer = document.querySelector(".theme-btn-container");
    if (!btnContainer) return; // Safety check
    
    // Clear existing buttons if any
    btnContainer.innerHTML = '';
    
    themes.forEach((theme, index) => {
        const div = document.createElement("div");
        div.className = "theme-btn";
        div.style.background = theme.background;
        
        // Mark first theme as active by default
        if (index === 0) {
            div.classList.add('active');
        }
        
        btnContainer.appendChild(div);
        
        div.addEventListener("click", () => {
            // Remove active class from all buttons
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            div.classList.add('active');
            setTheme(theme);
        });
    });
};

// Check for saved theme in local storage
document.addEventListener("DOMContentLoaded", () => {
    displayThemeButtons();
    
    // Apply saved theme if it exists
    const savedTheme = localStorage.getItem('rateMyFitTheme');
    if (savedTheme) {
        setTheme(JSON.parse(savedTheme));
    } else {
        // Otherwise use default theme (first one)
        setTheme(themes[0]);
    }
    
    // Set body class
    document.body.classList.add('login-page');
    
    // Add a subtle animation to the form container
    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
        formContainer.style.opacity = '0';
        formContainer.style.transform = 'translateY(20px)';
        formContainer.style.transition = 'opacity 0.6s ease, transform 0.8s ease';
        
        setTimeout(() => {
            formContainer.style.opacity = '1';
            formContainer.style.transform = 'translateY(0)';
        }, 200);
    }
});

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

function setTheme(theme) {
    let root = document.querySelector(":root");
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--color", theme.color);
    root.style.setProperty("--primary-color", theme.primaryColor);
    
    document.body.style.background = theme.background;
    document.body.style.backgroundImage = `linear-gradient(135deg, ${theme.background}, #121212)`;
    
    localStorage.setItem('rateMyFitTheme', JSON.stringify(theme));
    
    let circles = document.querySelectorAll('.circle');
    for (let i = 0; i < circles.length; i++) {
        circles[i].style.backgroundColor = theme.primaryColor;
    }
    
    let formBgColor = theme.background === "#1A1A2E" ? 'rgba(30, 30, 46, 0.5)' : 'rgba(0, 0, 0, 0.2)';
    document.querySelector('.form-container').style.backgroundColor = formBgColor;
};

function displayThemeButtons() {
    let btnContainer = document.querySelector(".theme-btn-container");
    if (!btnContainer) return;
    
    btnContainer.innerHTML = '';
    
    for (let i = 0; i < themes.length; i++) {
        let theme = themes[i];
        let div = document.createElement("div");
        div.className = "theme-btn";
        div.style.background = theme.background;
        
        if (i === 0) {
            div.classList.add('active');
        }
        
        btnContainer.appendChild(div);
        
        div.addEventListener("click", function() {
            let buttons = document.querySelectorAll('.theme-btn');
            for (let j = 0; j < buttons.length; j++) {
                buttons[j].classList.remove('active');
            }
            
            div.classList.add('active');
            setTheme(theme);
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    displayThemeButtons();
    
    let savedTheme = localStorage.getItem('rateMyFitTheme');
    if (savedTheme) {
        setTheme(JSON.parse(savedTheme));
    } else {
        setTheme(themes[0]);
    }
    
    document.body.classList.add('login-page');
    
    let formContainer = document.querySelector('.form-container');
    if (formContainer) {
        formContainer.style.opacity = '0';
        formContainer.style.transform = 'translateY(20px)';
        formContainer.style.transition = 'opacity 0.6s ease, transform 0.8s ease';
        
        setTimeout(function() {
            formContainer.style.opacity = '1';
            formContainer.style.transform = 'translateY(0)';
        }, 200);
    }
});

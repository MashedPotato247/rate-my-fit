  document.addEventListener("DOMContentLoaded", function() {
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const body = document.body;
  
  // Check if sidebar state is saved in localStorage
  const isSidebarOpen = localStorage.getItem('sidebarOpen') === 'true';
  
  // Set initial state based on localStorage
  if (isSidebarOpen) {
    sidebar.classList.add("active");
    overlay.classList.add("active");
    body.classList.add("sidebar-active");
  }
  
  // Function to toggle sidebar
  function toggleSidebar() {
    const isOpen = sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
    body.classList.toggle("sidebar-active");
    
    // Save state to localStorage
    localStorage.setItem('sidebarOpen', isOpen);
  }
  
  // Toggle sidebar when button is clicked
  if(sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }
  
  // Close sidebar when clicking overlay
  if(overlay) {
    overlay.addEventListener("click", toggleSidebar);
  }
  
  // Close sidebar with Escape key
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && sidebar.classList.contains("active")) {
      toggleSidebar();
    }
  });
  
  // Highlight current page in sidebar
  const currentPath = window.location.pathname;
  const sidebarLinks = document.querySelectorAll(".sidebar-links a");
  
  sidebarLinks.forEach(link => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    }
  });
});
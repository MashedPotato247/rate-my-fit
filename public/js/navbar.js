document.addEventListener("DOMContentLoaded", function() {
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const body = document.body;

  const SidebarManager = {
    init() {
      this.loadSidebarState();
      this.setupEventListeners();
      this.highlightCurrentPage();
      this.setupResponsiveBehavior();
    },

    loadSidebarState() {
      const isSidebarOpen = localStorage.getItem('sidebarOpen') === 'true';
      if (isSidebarOpen) {
        this.openSidebar();
      }
    },

    openSidebar() {
      if (!sidebar) return;
      sidebar.classList.add("active");
      if (overlay) overlay.classList.add("active");
      body.classList.add("sidebar-active");
      localStorage.setItem('sidebarOpen', 'true');
    },

    closeSidebar() {
      if (!sidebar) return;
      sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
      body.classList.remove("sidebar-active");
      localStorage.setItem('sidebarOpen', 'false');
    },

    toggleSidebar() {
      if (sidebar && sidebar.classList.contains("active")) {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    },

    setupEventListeners() {
      if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => this.toggleSidebar());
      }

      if (overlay) {
        overlay.addEventListener("click", () => this.closeSidebar());
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sidebar && sidebar.classList.contains("active")) {
          this.closeSidebar();
        }
      });

      const sidebarLinks = document.querySelectorAll(".sidebar-links a");
      if (window.innerWidth < 768) {
        sidebarLinks.forEach(link => {
          link.addEventListener("click", () => {
            this.closeSidebar();
          });
        });
      }
    },

    highlightCurrentPage() {
      const currentPath = window.location.pathname;
      // Ensure this selector matches your sidebar links, '.sidebar-links a' is common
      const sidebarLinks = document.querySelectorAll('.sidebar-links a');

      sidebarLinks.forEach(link => {
        link.classList.remove('active'); // Important: Remove active class from all links first

        const linkHref = link.getAttribute('href');

        if (!linkHref) { // Skip if a link somehow doesn't have an href
          return;
        }

        // Check for exact match
        if (linkHref === currentPath) {
          link.classList.add('active');
        } 
        // Check if currentPath starts with linkHref (for parent active states like /dashboard and /dashboard/settings)
        // Make sure linkHref is not just '/' for this condition, as that's handled by exact match.
        else if (linkHref !== '/' && currentPath.startsWith(linkHref)) {
          link.classList.add('active');
        }
      });
    },

    setupResponsiveBehavior() {
      const mediaQuery = window.matchMedia('(min-width: 992px)');

      const handleResize = (e) => {
        if (e.matches && window.innerWidth >= 992) {
          if (document.body.classList.contains('mobile-view')) {
            this.closeSidebar();
          }
          document.body.classList.remove('mobile-view');
        } else {
          document.body.classList.add('mobile-view');
        }
      };

      handleResize(mediaQuery);
      mediaQuery.addEventListener('change', handleResize);
    }
  };

  SidebarManager.init();

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});
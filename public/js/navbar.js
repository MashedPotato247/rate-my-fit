  document.addEventListener("DOMContentLoaded", function() {
  var menuToggle = document.getElementById("menu-toggle");
  var menuCircle = document.querySelector(".menu-circle");

  if(menuToggle) {
    menuToggle.onclick = function() {
      menuCircle.classList.toggle("active");
    };
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menu-toggle");
  const menuCircle = document.querySelector(".menu-circle");

  menuToggle.addEventListener("click", () => {
    menuCircle.classList.toggle("active");
  });
});
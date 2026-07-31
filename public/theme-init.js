// Set the theme before first paint so there's no light-mode flash on a
// dark-preference load. Reads the saved choice, else the OS preference.
// Served as a static file and injected render-blocking into <head> via a
// beforeInteractive <Script src> — inline scripts trip a React warning.
(function () {
  try {
    var t = localStorage.getItem("mv-theme");
    if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var toggle = document.querySelector('.nav-toggle');
        var wrapper = document.querySelector('.nav-menu-wrapper');
        var overlay = document.querySelector('.nav-overlay');

        if (!toggle || !wrapper) return;

        function openMenu() {
            toggle.classList.add('open');
            wrapper.classList.add('open');
            document.body.classList.add('nav-open');
            toggle.setAttribute('aria-expanded', 'true');
            if (overlay) overlay.classList.add('open');
        }

        function closeMenu() {
            toggle.classList.remove('open');
            wrapper.classList.remove('open');
            document.body.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            if (overlay) overlay.classList.remove('open');
        }

        toggle.addEventListener('click', function () {
            if (wrapper.classList.contains('open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        if (overlay) overlay.addEventListener('click', closeMenu);

        wrapper.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        // Ferme le menu si l'écran repasse en desktop (ex: rotation de l'appareil)
        window.addEventListener('resize', function () {
            if (window.innerWidth > 780) closeMenu();
        });
    });
})();

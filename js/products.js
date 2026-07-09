(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var overlay = document.getElementById('productModalOverlay');
        if (!overlay) return; // page sans modale produit

        var closeBtn = document.getElementById('productModalClose');
        var imgEl = document.getElementById('productModalImg');
        var photoWrap = document.getElementById('productModalPhoto');
        var nameEl = document.getElementById('productModalName');
        var tagEl = document.getElementById('productModalTag');
        var priceEl = document.getElementById('productModalPrice');
        var descEl = document.getElementById('productModalDesc');

        function openModal(card) {
            var name = card.getAttribute('data-name') || '';
            var tag = card.getAttribute('data-tag') || '';
            var price = card.getAttribute('data-price') || '';
            var desc = card.getAttribute('data-desc') || '';
            var img = card.getAttribute('data-img') || '';

            nameEl.textContent = name;
            tagEl.textContent = tag;
            priceEl.textContent = price;
            descEl.textContent = desc;

            photoWrap.classList.remove('photo-missing');
            imgEl.src = img;
            imgEl.alt = name;
            imgEl.onerror = function () {
                photoWrap.classList.add('photo-missing');
            };

            overlay.classList.add('open');
            document.body.classList.add('nav-open');
        }

        function closeModal() {
            overlay.classList.remove('open');
            document.body.classList.remove('nav-open');
        }

        document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var card = btn.closest('.product-plaque');
                if (card) openModal(card);
            });
        });

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    });
})();

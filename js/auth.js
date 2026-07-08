/*
 * AVOLAZA — mini système de compte côté client.
 * IMPORTANT : ceci est un système de démonstration. Les comptes sont stockés
 * dans le navigateur (localStorage), pas sur un serveur. Il ne faut PAS
 * l'utiliser tel quel pour de vraies données sensibles en production —
 * pour un vrai site, il faudra un backend (ex: Firebase, Supabase, ou une
 * API maison) qui stocke les comptes côté serveur.
 */
(function () {
    var STORAGE_KEY = 'avolaza_users';
    var SESSION_KEY = 'avolaza_session';

    async function hash(text) {
        var enc = new TextEncoder().encode(text);
        var buf = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf)).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function getUsers() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch (e) { return []; }
    }

    function saveUsers(users) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }

    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
        catch (e) { return null; }
    }

    function setSession(email) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email: email }));
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    async function registerUser(nom, email, password) {
        email = (email || '').trim().toLowerCase();
        nom = (nom || '').trim();
        if (!nom || !email || !password) {
            throw new Error('Merci de remplir tous les champs.');
        }
        if (password.length < 6) {
            throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
        }
        var users = getUsers();
        if (users.some(function (u) { return u.email === email; })) {
            throw new Error('Un compte existe déjà avec cet email.');
        }
        var passwordHash = await hash(password);
        users.push({ nom: nom, email: email, passwordHash: passwordHash });
        saveUsers(users);
        setSession(email);
    }

    async function loginUser(email, password) {
        email = (email || '').trim().toLowerCase();
        var users = getUsers();
        var user = users.find(function (u) { return u.email === email; });
        if (!user) throw new Error('Aucun compte trouvé avec cet email.');
        var passwordHash = await hash(password || '');
        if (passwordHash !== user.passwordHash) throw new Error('Mot de passe incorrect.');
        setSession(email);
    }

    function logoutUser() {
        clearSession();
    }

    function getCurrentUser() {
        var session = getSession();
        if (!session) return null;
        var users = getUsers();
        return users.find(function (u) { return u.email === session.email; }) || null;
    }

    // Prévient le reste du site (ex: page "Mon compte") qu'une connexion /
    // inscription / déconnexion vient de se produire, sans recharger la page.
    function notifyAuthChange() {
        window.dispatchEvent(new CustomEvent('avolaza:authchange'));
    }

    window.AvolazaAuth = {
        registerUser: registerUser,
        loginUser: loginUser,
        logoutUser: logoutUser,
        getCurrentUser: getCurrentUser,
        notifyAuthChange: notifyAuthChange
    };

    /* =========================================================
       POPUP DE CONNEXION / INSCRIPTION
       Injectée dans toutes les pages qui chargent auth.js, et
       ouverte au clic sur le bouton "Se connecter" du menu.
       ========================================================= */

    var modalOverlay, modalLoginForm, modalRegisterForm, modalMessage, tabButtons;

    function buildModal() {
        if (document.getElementById('authModalOverlay')) return;

        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="auth-modal-overlay" id="authModalOverlay">' +
                '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">' +
                    '<button type="button" class="auth-modal-close" id="authModalClose" aria-label="Fermer">&times;</button>' +
                    '<h2 id="authModalTitle" class="contact-label" style="margin-bottom:18px;">Espace client</h2>' +
                    '<div class="auth-modal-tabs">' +
                        '<button type="button" class="auth-tab active" data-tab="login">Se connecter</button>' +
                        '<button type="button" class="auth-tab" data-tab="register">Créer un compte</button>' +
                    '</div>' +
                    '<div id="authModalMessage"></div>' +
                    '<form id="modalLoginForm" class="auth-modal-form" novalidate>' +
                        '<div class="form-field">' +
                            '<label for="modalLoginEmail">Email</label>' +
                            '<input type="email" id="modalLoginEmail" placeholder="vous@exemple.com" required>' +
                        '</div>' +
                        '<div class="form-field">' +
                            '<label for="modalLoginPassword">Mot de passe</label>' +
                            '<input type="password" id="modalLoginPassword" placeholder="••••••••" required>' +
                        '</div>' +
                        '<button type="submit" class="btn-submit">Se connecter</button>' +
                    '</form>' +
                    '<form id="modalRegisterForm" class="auth-modal-form" novalidate hidden>' +
                        '<div class="form-field">' +
                            '<label for="modalRegisterNom">Nom</label>' +
                            '<input type="text" id="modalRegisterNom" placeholder="Votre nom" required>' +
                        '</div>' +
                        '<div class="form-field">' +
                            '<label for="modalRegisterEmail">Email</label>' +
                            '<input type="email" id="modalRegisterEmail" placeholder="vous@exemple.com" required>' +
                        '</div>' +
                        '<div class="form-field">' +
                            '<label for="modalRegisterPassword">Mot de passe</label>' +
                            '<input type="password" id="modalRegisterPassword" placeholder="6 caractères minimum" minlength="6" required>' +
                        '</div>' +
                        '<div class="form-field">' +
                            '<label for="modalRegisterPasswordConfirm">Confirmer le mot de passe</label>' +
                            '<input type="password" id="modalRegisterPasswordConfirm" placeholder="••••••••" minlength="6" required>' +
                        '</div>' +
                        '<button type="submit" class="btn-submit">Créer mon compte</button>' +
                    '</form>' +
                '</div>' +
            '</div>';

        document.body.appendChild(wrap.firstChild);

        modalOverlay = document.getElementById('authModalOverlay');
        modalLoginForm = document.getElementById('modalLoginForm');
        modalRegisterForm = document.getElementById('modalRegisterForm');
        modalMessage = document.getElementById('authModalMessage');
        tabButtons = modalOverlay.querySelectorAll('.auth-tab');

        document.getElementById('authModalClose').addEventListener('click', closeAuthModal);
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeAuthModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeAuthModal();
        });

        tabButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                showAuthTab(btn.getAttribute('data-tab'));
            });
        });

        function setModalMessage(text, type) {
            modalMessage.innerHTML = text ? '<div class="form-message ' + type + '">' + text + '</div>' : '';
        }

        modalLoginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('modalLoginEmail').value;
            var password = document.getElementById('modalLoginPassword').value;

            loginUser(email, password).then(function () {
                setModalMessage('Connexion réussie.', 'success');
                updateSignInButton();
                notifyAuthChange();
                setTimeout(closeAuthModal, 500);
            }).catch(function (err) {
                setModalMessage(err.message, 'error');
            });
        });

        modalRegisterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var nom = document.getElementById('modalRegisterNom').value;
            var email = document.getElementById('modalRegisterEmail').value;
            var password = document.getElementById('modalRegisterPassword').value;
            var passwordConfirm = document.getElementById('modalRegisterPasswordConfirm').value;

            if (password !== passwordConfirm) {
                setModalMessage('Les mots de passe ne correspondent pas.', 'error');
                return;
            }

            registerUser(nom, email, password).then(function () {
                setModalMessage('Compte créé avec succès.', 'success');
                updateSignInButton();
                notifyAuthChange();
                setTimeout(closeAuthModal, 500);
            }).catch(function (err) {
                setModalMessage(err.message, 'error');
            });
        });
    }

    function showAuthTab(tab) {
        tabButtons.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        modalMessage.innerHTML = '';
        if (tab === 'register') {
            modalLoginForm.hidden = true;
            modalRegisterForm.hidden = false;
        } else {
            modalRegisterForm.hidden = true;
            modalLoginForm.hidden = false;
        }
    }

    function openAuthModal(tab) {
        buildModal();
        showAuthTab(tab || 'login');
        modalOverlay.classList.add('open');
        document.body.classList.add('nav-open');
        setTimeout(function () {
            var firstInput = modalOverlay.querySelector('form:not([hidden]) input');
            if (firstInput) firstInput.focus();
        }, 50);
    }

    function closeAuthModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('open');
        document.body.classList.remove('nav-open');
    }

    window.AvolazaAuth.openModal = openAuthModal;
    window.AvolazaAuth.closeModal = closeAuthModal;

    // Met à jour le bouton "Se connecter" du menu selon l'état de connexion.
    function updateSignInButton() {
        var actions = document.querySelector('.nav-actions');
        if (!actions) return;
        var btn = actions.querySelector('.btn-signin');
        if (!btn) return;

        var user = getCurrentUser();
        if (user) {
            btn.textContent = 'Mon compte';
            btn.setAttribute('href', actions.getAttribute('data-account-href') || '#');
        } else {
            btn.textContent = 'Se connecter';
            btn.setAttribute('href', actions.getAttribute('data-login-href') || '#');
        }
    }

    // Garde le bouton du menu synchronisé avec l'état de connexion,
    // peu importe d'où vient le changement (popup, page dédiée, déconnexion).
    window.addEventListener('avolaza:authchange', updateSignInButton);

    document.addEventListener('DOMContentLoaded', function () {
        updateSignInButton();
        buildModal();

        // Le clic sur "Se connecter" ouvre la popup au lieu de naviguer —
        // sauf sur les pages qui contiennent déjà un formulaire de
        // connexion / inscription complet (login.html, register.html),
        // où la navigation normale reste plus logique.
        var actions = document.querySelector('.nav-actions');
        if (!actions) return;
        var btn = actions.querySelector('.btn-signin');
        if (!btn) return;

        var hasOwnAuthForm = !!(document.getElementById('loginForm') || document.getElementById('registerForm'));

        btn.addEventListener('click', function (e) {
            var user = getCurrentUser();
            if (!user && !hasOwnAuthForm) {
                e.preventDefault();
                openAuthModal('login');
            }
        });
    });
})();

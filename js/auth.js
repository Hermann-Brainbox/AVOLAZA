/*
 * AVOLAZA — système de compte, propulsé par Supabase Auth.
 *
 * CONFIGURATION REQUISE : remplace les deux valeurs ci-dessous par
 * celles de ton projet Supabase (Project Settings → API).
 */
(function () {
    var SUPABASE_URL = 'https://axrrvoufvifcyqdzebdr.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_GWA79gbgcWsImmQLWuA9dA_01AImuoh';

    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Traduit les messages d'erreur Supabase (en anglais) en français.
    function translateError(error) {
        var msg = (error && error.message) || '';
        if (/already registered|already exists/i.test(msg)) {
            return 'Un compte existe déjà avec cet email.';
        }
        if (/invalid login credentials/i.test(msg)) {
            return 'Email ou mot de passe incorrect.';
        }
        if (/email not confirmed/i.test(msg)) {
            return 'Merci de confirmer votre email avant de vous connecter (vérifiez votre boîte mail).';
        }
        if (/password should be at least/i.test(msg)) {
            return 'Le mot de passe doit contenir au moins 6 caractères.';
        }
        if (/unable to validate email address|invalid email/i.test(msg)) {
            return 'Adresse email invalide.';
        }
        return msg || "Une erreur est survenue. Merci de réessayer.";
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

        var result = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { nom: nom } }
        });

        if (result.error) throw new Error(translateError(result.error));

        // Si la confirmation par email est activée dans Supabase, aucune
        // session n'est ouverte tant que le lien reçu par mail n'a pas été cliqué.
        return { needsConfirmation: !result.data.session };
    }

    async function loginUser(email, password) {
        email = (email || '').trim().toLowerCase();
        var result = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (result.error) throw new Error(translateError(result.error));
    }

    async function logoutUser() {
        await supabaseClient.auth.signOut();
    }

    // Calcule l'URL absolue de la page reset-password.html, où que se
    // trouve la page actuelle (racine ou dossier /pages/), en réutilisant
    // le même repère que data-login-href sur .nav-actions.
    function getResetRedirectUrl() {
        var actions = document.querySelector('.nav-actions');
        var loginHref = (actions && actions.getAttribute('data-login-href')) || 'pages/login.html';
        var relative = loginHref.replace('login.html', 'reset-password.html');
        return new URL(relative, window.location.href).href;
    }

    async function requestPasswordReset(email) {
        email = (email || '').trim().toLowerCase();
        if (!email) throw new Error('Merci de renseigner votre email.');

        var result = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: getResetRedirectUrl()
        });
        if (result.error) throw new Error(translateError(result.error));
    }

    async function updatePassword(newPassword) {
        if (!newPassword || newPassword.length < 6) {
            throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
        }
        var result = await supabaseClient.auth.updateUser({ password: newPassword });
        if (result.error) throw new Error(translateError(result.error));
    }

    async function getCurrentUser() {
        var result = await supabaseClient.auth.getSession();
        var session = result.data && result.data.session;
        if (!session) return null;
        var user = session.user;
        return {
            nom: (user.user_metadata && user.user_metadata.nom) || user.email,
            email: user.email
        };
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
        requestPasswordReset: requestPasswordReset,
        updatePassword: updatePassword,
        notifyAuthChange: notifyAuthChange
    };

    /* =========================================================
       POPUP DE CONNEXION / INSCRIPTION
       Injectée dans toutes les pages qui chargent auth.js, et
       ouverte au clic sur le bouton "Se connecter" du menu.
       ========================================================= */

    var modalOverlay, modalLoginForm, modalRegisterForm, modalForgotForm, modalMessage, tabButtons, modalTabsRow;

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
                        '<p class="auth-switch" style="margin-top:16px;"><a href="#" id="modalForgotLink">Mot de passe oublié ?</a></p>' +
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
                    '<form id="modalForgotForm" class="auth-modal-form" novalidate hidden>' +
                        '<div class="form-field">' +
                            '<label for="modalForgotEmail">Email</label>' +
                            '<input type="email" id="modalForgotEmail" placeholder="vous@exemple.com" required>' +
                        '</div>' +
                        '<button type="submit" class="btn-submit">Envoyer le lien de réinitialisation</button>' +
                        '<p class="auth-switch" style="margin-top:16px;"><a href="#" id="modalForgotBack">Retour à la connexion</a></p>' +
                    '</form>' +
                '</div>' +
            '</div>';

        document.body.appendChild(wrap.firstChild);

        modalOverlay = document.getElementById('authModalOverlay');
        modalLoginForm = document.getElementById('modalLoginForm');
        modalRegisterForm = document.getElementById('modalRegisterForm');
        modalForgotForm = document.getElementById('modalForgotForm');
        modalMessage = document.getElementById('authModalMessage');
        tabButtons = modalOverlay.querySelectorAll('.auth-tab');
        modalTabsRow = modalOverlay.querySelector('.auth-modal-tabs');

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

        document.getElementById('modalForgotLink').addEventListener('click', function (e) {
            e.preventDefault();
            showAuthTab('forgot');
        });
        document.getElementById('modalForgotBack').addEventListener('click', function (e) {
            e.preventDefault();
            showAuthTab('login');
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

            registerUser(nom, email, password).then(function (result) {
                if (result.needsConfirmation) {
                    setModalMessage('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.', 'success');
                    setTimeout(function () { showAuthTab('login'); }, 2200);
                } else {
                    setModalMessage('Compte créé avec succès.', 'success');
                    updateSignInButton();
                    notifyAuthChange();
                    setTimeout(closeAuthModal, 500);
                }
            }).catch(function (err) {
                setModalMessage(err.message, 'error');
            });
        });

        modalForgotForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('modalForgotEmail').value;

            requestPasswordReset(email).then(function () {
                setModalMessage('Un lien de réinitialisation a été envoyé à ' + email + '. Vérifiez votre boîte mail.', 'success');
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
        modalTabsRow.style.display = (tab === 'forgot') ? 'none' : '';
        modalLoginForm.hidden = tab !== 'login';
        modalRegisterForm.hidden = tab !== 'register';
        modalForgotForm.hidden = tab !== 'forgot';
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
    async function updateSignInButton() {
        var actions = document.querySelector('.nav-actions');
        if (!actions) return;
        var btn = actions.querySelector('.btn-signin');
        if (!btn) return;

        var user = await getCurrentUser();
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
        if (hasOwnAuthForm) return; // navigation par défaut conservée

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var href = btn.getAttribute('href');
            getCurrentUser().then(function (user) {
                if (user) {
                    window.location.href = href;
                } else {
                    openAuthModal('login');
                }
            });
        });
    });
})();

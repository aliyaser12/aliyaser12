/* =========================================================
   VANTA 2.0 — APP CORE
   Authentication + Session + UI
   ========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       SUPABASE
    --------------------------------------------------------- */

    const config = window.VANTA_SUPABASE_CONFIG;

    if (!config || !config.url || !config.key) {
        console.error("VANTA: Supabase configuration is missing.");
        return;
    }

    if (!window.supabase) {
        console.error("VANTA: Supabase library is missing.");
        return;
    }

    const supabaseClient = window.supabase.createClient(
        config.url,
        config.key,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage
            }
        }
    );

    window.VANTA_SUPABASE = supabaseClient;


    /* ---------------------------------------------------------
       HELPERS
    --------------------------------------------------------- */

    const $ = (selector) =>
        document.querySelector(selector);

    const $$ = (selector) =>
        document.querySelectorAll(selector);


    function setStatus(message, type = "normal") {

        const elements = $$(".auth-status");

        elements.forEach((element) => {

            element.textContent = message || "";

            element.dataset.type = type;
        });
    }


    function getAuthModal() {
        return $("#authModal");
    }


    /* ---------------------------------------------------------
       AUTH MODAL
    --------------------------------------------------------- */

    function openAuth(mode = "login") {

        const modal = getAuthModal();

        if (!modal) return;

        modal.classList.add("show");

        document.body.classList.add("modal-open");

        showAuthMode(mode);

        setTimeout(() => {

            const input =
                mode === "signup"
                    ? $("#signupEmail")
                    : $("#loginEmail");

            if (input) input.focus();

        }, 100);
    }


    function closeAuth() {

        const modal = getAuthModal();

        if (!modal) return;

        modal.classList.remove("show");

        document.body.classList.remove("modal-open");

        setStatus("");
    }


    function showAuthMode(mode) {

        const loginView = $("#loginView");
        const signupView = $("#signupView");

        if (!loginView || !signupView) return;

        loginView.classList.toggle(
            "active",
            mode === "login"
        );

        signupView.classList.toggle(
            "active",
            mode === "signup"
        );

        setStatus("");
    }


    window.openAuth = openAuth;
    window.closeAuth = closeAuth;
    window.showAuthMode = showAuthMode;


    /* ---------------------------------------------------------
       CLOSE MODAL
    --------------------------------------------------------- */

    document.addEventListener("click", (event) => {

        const modal = getAuthModal();

        if (!modal) return;

        if (event.target === modal) {
            closeAuth();
        }

    });


    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {
            closeAuth();
        }

    });


    /* ---------------------------------------------------------
       LOGIN
    --------------------------------------------------------- */

    async function loginUser(email, password) {

        email = String(email || "").trim();

        password = String(password || "");

        if (!email || !password) {

            throw new Error(
                "أدخل البريد الإلكتروني وكلمة المرور."
            );
        }

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {

            const message =
                error.message?.toLowerCase() || "";

            if (
                message.includes("email not confirmed") ||
                message.includes("email_not_confirmed")
            ) {
                throw new Error(
                    "يجب تأكيد بريدك الإلكتروني أولًا."
                );
            }

            if (
                message.includes("invalid login") ||
                message.includes("invalid credentials")
            ) {
                throw new Error(
                    "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                );
            }

            throw new Error(
                error.message ||
                "تعذر تسجيل الدخول."
            );
        }

        return data.user;
    }


    async function loginUserUI(event) {

        if (event) event.preventDefault();

        const emailInput = $("#loginEmail");
        const passwordInput = $("#loginPassword");
        const button = $("#loginSubmit");

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (button) {
            button.disabled = true;
            button.textContent = "جاري الدخول...";
        }

        setStatus("جاري التحقق من الحساب...");

        try {

            const user =
                await loginUser(
                    email,
                    password
                );

            setStatus(
                "تم تسجيل الدخول بنجاح.",
                "success"
            );

            updateAuthUI(user);

            setTimeout(() => {
                closeAuth();
            }, 700);

        } catch (error) {

            console.error(
                "VANTA login error:",
                error
            );

            setStatus(
                error.message ||
                "حدث خطأ أثناء تسجيل الدخول.",
                "error"
            );

        } finally {

            if (button) {

                button.disabled = false;

                button.textContent =
                    "دخول إلى VANTA";
            }
        }
    }


    /* ---------------------------------------------------------
       SIGN UP
    --------------------------------------------------------- */

    async function registerUser(
        email,
        password,
        username
    ) {

        email = String(email || "").trim();

        password = String(password || "");

        username = String(username || "").trim();


        if (!email || !password) {

            throw new Error(
                "أدخل البريد الإلكتروني وكلمة المرور."
            );
        }


        if (password.length < 6) {

            throw new Error(
                "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
            );
        }


        const redirectUrl =
            window.location.origin;


        const { data, error } =
            await supabaseClient.auth.signUp({

                email,

                password,

                options: {
                    emailRedirectTo:
                        redirectUrl,

                    data: {
                        username:
                            username || null
                    }
                }

            });


        if (error) {

            const message =
                error.message?.toLowerCase() || "";

            if (
                message.includes("already registered") ||
                message.includes("already exists")
            ) {
                throw new Error(
                    "هذا البريد الإلكتروني مسجل بالفعل."
                );
            }

            throw new Error(
                error.message ||
                "تعذر إنشاء الحساب."
            );
        }


        return data;
    }


    async function registerUserUI(event) {

        if (event) event.preventDefault();

        const usernameInput =
            $("#signupUsername");

        const emailInput =
            $("#signupEmail");

        const passwordInput =
            $("#signupPassword");

        const termsInput =
            $("#signupTerms");

        const button =
            $("#signupSubmit");


        const username =
            usernameInput
                ? usernameInput.value.trim()
                : "";

        const email =
            emailInput
                ? emailInput.value.trim()
                : "";

        const password =
            passwordInput
                ? passwordInput.value
                : "";


        if (
            termsInput &&
            !termsInput.checked
        ) {

            setStatus(
                "يجب الموافقة على الشروط أولًا.",
                "error"
            );

            return;
        }


        if (button) {

            button.disabled = true;

            button.textContent =
                "جاري إنشاء الحساب...";
        }


        setStatus(
            "جاري إنشاء حساب VANTA..."
        );


        try {

            const result =
                await registerUser(
                    email,
                    password,
                    username
                );


            /*
             * Supabase may return a user without
             * a session when email confirmation
             * is enabled.
             */

            if (
                result.user &&
                !result.session
            ) {

                setStatus(
                    "تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد.",
                    "success"
                );

                return;
            }


            if (result.user) {

                updateAuthUI(
                    result.user
                );

                setStatus(
                    "تم إنشاء حسابك بنجاح.",
                    "success"
                );

                setTimeout(() => {
                    closeAuth();
                }, 800);
            }


        } catch (error) {

            console.error(
                "VANTA signup error:",
                error
            );

            setStatus(
                error.message ||
                "تعذر إنشاء الحساب.",
                "error"
            );

        } finally {

            if (button) {

                button.disabled = false;

                button.textContent =
                    "إنشاء حساب VANTA";
            }
        }
    }


    /* ---------------------------------------------------------
       LOGOUT
    --------------------------------------------------------- */

    async function logoutUser() {

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {

            console.error(
                "VANTA logout error:",
                error
            );

            throw error;
        }

        updateAuthUI(null);

        window.location.href = "/";
    }


    /* ---------------------------------------------------------
       CURRENT USER
    --------------------------------------------------------- */

    async function getCurrentUser() {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();

        if (error) {
            return null;
        }

        return data.user || null;
    }


    async function getSession() {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();

        if (error) {
            return null;
        }

        return data.session || null;
    }


    /* ---------------------------------------------------------
       AUTH UI
    --------------------------------------------------------- */

    function updateAuthUI(user) {

        const loginButtons =
            $$(".open-login");

        const signupButtons =
            $$(".open-signup");

        const loggedButtons =
            $$(".logged-in-only");

        const userElements =
            $$(".user-email");

        const guestElements =
            $$(".logged-out-only");


        if (user) {

            loginButtons.forEach(
                (element) => {
                    element.style.display =
                        "none";
                }
            );

            signupButtons.forEach(
                (element) => {
                    element.style.display =
                        "none";
                }
            );

            guestElements.forEach(
                (element) => {
                    element.style.display =
                        "none";
                }
            );

            loggedButtons.forEach(
                (element) => {
                    element.style.display =
                        "";
                }
            );

            userElements.forEach(
                (element) => {
                    element.textContent =
                        user.email || "حساب VANTA";
                }
            );

        } else {

            loginButtons.forEach(
                (element) => {
                    element.style.display =
                        "";
                }
            );

            signupButtons.forEach(
                (element) => {
                    element.style.display =
                        "";
                }
            );

            guestElements.forEach(
                (element) => {
                    element.style.display =
                        "";
                }
            );

            loggedButtons.forEach(
                (element) => {
                    element.style.display =
                        "none";
                }
            );

            userElements.forEach(
                (element) => {
                    element.textContent =
                        "";
                }
            );
        }
    }


    /* ---------------------------------------------------------
       AUTH STATE
    --------------------------------------------------------- */

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            const user =
                session?.user || null;

            console.log(
                "VANTA auth:",
                event
            );

            updateAuthUI(user);


            /*
             * Keep the session available
             * across refresh/reopening.
             */

            if (event === "SIGNED_IN") {

                document.documentElement
                    .dataset.authenticated =
                    "true";
            }


            if (event === "SIGNED_OUT") {

                delete document
                    .documentElement
                    .dataset
                    .authenticated;
            }

        }
    );


    /* ---------------------------------------------------------
       FORM EVENTS
    --------------------------------------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            const loginForm =
                $("#loginForm");

            const signupForm =
                $("#signupForm");


            if (loginForm) {

                loginForm.addEventListener(
                    "submit",
                    loginUserUI
                );
            }


            if (signupForm) {

                signupForm.addEventListener(
                    "submit",
                    registerUserUI
                );
            }


            const user =
                await getCurrentUser();

            updateAuthUI(user);
        }
    );


    /* ---------------------------------------------------------
       GLOBAL API
    --------------------------------------------------------- */

    window.VANTA_AUTH = {

        client:
            supabaseClient,

        login:
            loginUser,

        register:
            registerUser,

        logout:
            logoutUser,

        getCurrentUser:
            getCurrentUser,

        getSession:
            getSession,

        updateUI:
            updateAuthUI,

        openAuth:
            openAuth,

        closeAuth:
            closeAuth

    };


    console.log(
        "VANTA 2.0 App Core initialized."
    );

})();
